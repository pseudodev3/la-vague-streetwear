import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Import local modules
import { db, USE_POSTGRES } from './src/config/db.js';
import { initDatabase } from './src/services/dbInit.js';
import { 
    globalErrorHandler, 
    notFoundHandler,
    asyncHandler 
} from './src/middleware/errorHandler.js';
import { csrfProtection, csrfToken } from './src/middleware/csrf.js';
import {
    initSentry,
    sentryRequestHandler,
    sentryTracingHandler,
} from './src/config/sentry.js';

// Import Routes
import productRoutes from './src/routes/products.js';
import orderRoutes from './src/routes/orders.js';
import gdprRoutes from './src/routes/gdpr.js';
import configRoutes from './src/routes/config.js';
import paymentRoutes from './src/routes/payment.js';
import adminRoutes from './src/routes/admin.js';

dotenv.config();

// Initialize Sentry
initSentry();

const app = express();
const PORT = process.env.PORT || 3000;

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Trust proxy
app.set('trust proxy', 1);

// Initialize database and services
const { inventoryService, productService } = await initDatabase();

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================
app.use(sentryRequestHandler());
app.use(sentryTracingHandler());
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://js.paystack.co", "https://checkout.paystack.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "https:", "data:", "blob:", "res.cloudinary.com"],
            connectSrc: ["'self'", process.env.FRONTEND_URL || "*", "https://api.paystack.co"],
            frameSrc: ["'self'", "https://checkout.paystack.com", "https://js.paystack.co"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
    crossOriginEmbedderPolicy: false, // Required for some third-party scripts like Paystack
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
}));

// Set Permissions-Policy header
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
    next();
});

const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL, 'https://la-vague.store', 'https://www.la-vague.store', /https:\/\/.+\.netlify\.app$/].filter(Boolean)
    : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000'];

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'sentry-trace', 'baggage', 'X-CSRF-Token']
}));

app.use(compression());
app.use(cookieParser());
app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
        if (req.originalUrl.includes('/api/payment/webhook')) {
            req.rawBody = buf;
        }
    }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files with specific cache rules
app.use(express.static('.', {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    etag: true,
    extensions: ['html'],
    setHeaders: (res, path) => {
        // Force browsers to check for new HTML files every time
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// ==========================================
// RATE LIMITING
// ==========================================
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, error: 'Too many requests.', code: 'RATE_LIMIT' }
});
app.use('/api/', apiLimiter);

// ==========================================
// ROUTES
// ==========================================
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), database: USE_POSTGRES ? 'postgresql' : 'sqlite', version: '1.2.0' });
});

app.get('/api/db-test', asyncHandler(async (req, res) => {
    const result = await (USE_POSTGRES ? db.query('SELECT NOW() as time') : db.prepare('SELECT datetime("now") as time').get());
    res.json({ success: true, server_time: result.rows?.[0]?.time || result.time });
}));

app.get('/api/csrf-token', csrfToken, (req, res) => {
    res.json({ success: true, csrfToken: req.csrfToken });
});

// Mount Routes
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes(productService, inventoryService));
app.use('/api/gdpr', gdprRoutes);
app.use('/api/config', configRoutes);
app.use('/api/payment', paymentRoutes(inventoryService));
app.use('/api/admin', adminRoutes(productService, inventoryService));

// ==========================================
// HTTPS ENFORCEMENT
// ==========================================
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        if (protocol !== 'https') return res.redirect(301, `https://${req.headers.host}${req.url}`);
        next();
    });
}

// Error handlers
app.use(notFoundHandler);
app.use(globalErrorHandler);

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
