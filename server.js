import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import pinoHttp from 'pino-http';

import { db, query, USE_POSTGRES } from './src/config/db.js';
import { initDatabase } from './src/services/dbInit.js';
import { globalErrorHandler, notFoundHandler } from './src/middleware/errorHandler.js';
import { csrfToken } from './src/middleware/csrf.js';
import {
    initSentry,
    sentryRequestHandler,
    sentryTracingHandler
} from './src/config/sentry.js';
import logger from './src/utils/logger.js';

import productRoutes from './src/routes/products.js';
import orderRoutes from './src/routes/orders.js';
import gdprRoutes from './src/routes/gdpr.js';
import configRoutes from './src/routes/config.js';
import paymentRoutes from './src/routes/payment.js';
import adminRoutes from './src/routes/admin.js';

dotenv.config();
initSentry();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.set('trust proxy', 1);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function readPositiveInt(name, fallback, max = 10) {
    const parsed = Number.parseInt(process.env[name] || '', 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(1, parsed));
}

async function initializeDatabaseWithRetry() {
    const maxAttempts = readPositiveInt('DB_INIT_RETRIES', 3, 6);
    const baseDelayMs = readPositiveInt('DB_INIT_RETRY_BASE_MS', 2500, 30000);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            return await initDatabase();
        } catch (error) {
            logger.error({ err: error, attempt, maxAttempts }, 'Database initialization failed');

            if (attempt === maxAttempts) throw error;
            await sleep(Math.min(baseDelayMs * 2 ** (attempt - 1), 10000));
        }
    }

    throw new Error('Database initialization failed');
}

let services;
try {
    services = await initializeDatabaseWithRetry();
} catch (error) {
    logger.fatal({ err: error }, 'API startup aborted because the database could not initialize');
    process.exit(1);
}

const { inventoryService, productService } = services;

app.use(
    pinoHttp({
        logger,
        quietReqLogger: true,
        autoLogging: {
            ignore: req => req.url === '/api/health' || req.url === '/favicon.ico'
        },
        customLogLevel: (req, res, err) => {
            if (res.statusCode >= 500 || err) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'info';
        }
    })
);

app.use(sentryRequestHandler());
app.use(sentryTracingHandler());
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'none'"],
                frameAncestors: ["'none'"],
                baseUri: ["'none'"],
                formAction: ["'none'"]
            }
        },
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
    })
);

app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
    next();
});

if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        if (protocol !== 'https') {
            return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
        }
        next();
    });
}

const allowedOrigins =
    process.env.NODE_ENV === 'production'
        ? [
              process.env.FRONTEND_URL,
              'https://la-vague.store',
              'https://www.la-vague.store',
              /https:\/\/.+\.netlify\.app$/
          ].filter(Boolean)
        : [
              'http://localhost:3000',
              'http://localhost:5173',
              'http://127.0.0.1:3000',
              'http://127.0.0.1:5173'
          ];

app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'sentry-trace',
            'baggage',
            'X-CSRF-Token'
        ]
    })
);

app.use(compression());
app.use(cookieParser());
app.use(
    express.json({
        limit: '2mb',
        verify: (req, res, buf) => {
            if (req.originalUrl.startsWith('/api/payment/webhook')) {
                req.rawBody = Buffer.from(buf);
            }
        }
    })
);
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    // Infrastructure probes must never be blocked by the customer-facing API budget.
    // Render treats non-2xx/3xx health responses as failures and can restart an
    // otherwise healthy instance after sustained failed checks.
    skip: req =>
        req.originalUrl === '/api/health' ||
        req.originalUrl === '/api/ready',
    message: { success: false, error: 'Too many requests.', code: 'RATE_LIMIT' }
});
app.use('/api/', apiLimiter);

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
        database: USE_POSTGRES ? 'postgresql' : 'sqlite'
    });
});

app.get('/api/ready', async (req, res) => {
    try {
        await query('SELECT 1');
        res.json({
            status: 'ready',
            timestamp: new Date().toISOString(),
            database: 'reachable'
        });
    } catch (error) {
        logger.error({ err: error }, 'Database readiness check failed');
        res.status(503).json({
            status: 'not_ready',
            timestamp: new Date().toISOString(),
            database: 'unavailable'
        });
    }
});

app.get('/api/csrf-token', csrfToken, (req, res) => {
    res.json({ success: true, csrfToken: req.csrfToken });
});

app.get('/api/sitemap.xml', async (req, res, next) => {
    const baseUrl = (process.env.FRONTEND_URL || 'https://la-vague.store').replace(/\/$/, '');
    const staticPaths = [
        '/',
        '/shop',
        '/contact',
        '/faq',
        '/shipping',
        '/returns',
        '/refund-policy',
        '/privacy-policy',
        '/terms-of-service'
    ];

    const escapeXml = value =>
        String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');

    try {
        const result = await query('SELECT slug FROM products ORDER BY created_at DESC');
        const productPaths = result.rows
            .map(product => product.slug)
            .filter(Boolean)
            .map(slug => `/product?slug=${encodeURIComponent(slug)}`);
        const urls = [...staticPaths, ...productPaths];
        const today = new Date().toISOString().slice(0, 10);
        const xml = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            ...urls.map(path =>
                `  <url><loc>${escapeXml(`${baseUrl}${path}`)}</loc><lastmod>${today}</lastmod></url>`
            ),
            '</urlset>'
        ].join('\n');

        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
        res.send(xml);
    } catch (error) {
        next(error);
    }
});

app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes(productService, inventoryService));
app.use('/api/gdpr', gdprRoutes);
app.use('/api/config', configRoutes);
app.use('/api/payment', paymentRoutes(inventoryService));
app.use('/api/admin', adminRoutes(productService, inventoryService));

app.use(notFoundHandler);
app.use(globalErrorHandler);

const server = app.listen(PORT, () => {
    logger.info(`API server running on port ${PORT}`);
});

let shuttingDown = false;
const shutdown = signal => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info(`${signal} signal received. Shutting down gracefully...`);

    const forceExitTimer = setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    server.close(async () => {
        logger.info('HTTP server closed.');

        try {
            if (db) {
                if (USE_POSTGRES) await db.end();
                else db.close();
            }
            logger.info('Database connection closed.');
            process.exit(0);
        } catch (error) {
            logger.error({ error }, 'Failed to close database cleanly');
            process.exit(1);
        }
    });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', reason => {
    logger.error({ reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', error => {
    logger.error({ error }, 'Uncaught exception');
    shutdown('uncaughtException');
});
