import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';

// Import local modules
import { db, USE_POSTGRES } from './src/config/db.js';
import { initDatabase } from './src/services/dbInit.js';
import { 
    globalErrorHandler, 
    notFoundHandler,
    asyncHandler,
    APIError
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
            scriptSrc: ["'self'", "'unsafe-inline'", "https://js.paystack.co", "https://checkout.paystack.com", "https://browser.sentry-cdn.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "https:", "data:", "blob:", "res.cloudinary.com"],
            connectSrc: ["'self'", process.env.FRONTEND_URL || "*", "https://api.paystack.co", "https://browser.sentry-cdn.com", "*.sentry.io", "https://fonts.googleapis.com", "https://res.cloudinary.com"],
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

// ==========================================
// AUTOMATIC CACHE BUSTING
// ==========================================
const BUILD_ID = Date.now();

// Middleware to inject dynamic versioning into HTML files
app.get(['/', '/*.html'], (req, res, next) => {
    // Only handle GET requests for potential HTML files
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();

    let relativePath = req.path === '/' ? 'index.html' : req.path;
    if (relativePath.startsWith('/')) relativePath = relativePath.substring(1);
    if (!relativePath.endsWith('.html') && !relativePath.includes('.')) relativePath += '.html';

    const filePath = path.join(__dirname, relativePath);

    if (fs.existsSync(filePath) && !fs.lstatSync(filePath).isDirectory()) {
        try {
            let content = fs.readFileSync(filePath, 'utf8');
            // Automatically replace all ?v=... with the dynamic BUILD_ID
            content = content.replace(/\?v=[0-9.]+/g, `?v=${BUILD_ID}`);
            
            // Set headers to prevent HTML caching
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Content-Type', 'text/html');
            return res.send(content);
        } catch (error) {
            console.error('[CACHE-BUST] Error processing HTML:', error);
            next();
        }
    } else {
        next();
    }
});

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
        // Service worker must never be cached
        if (path.endsWith('sw.js')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Service-Worker-Allowed', '/');
        }
        // Web manifest should have reasonable cache
        if (path.endsWith('site.webmanifest')) {
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.setHeader('Content-Type', 'application/manifest+json');
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
    res.json({ status: 'ok', timestamp: new Date().toISOString(), database: USE_POSTGRES ? 'postgresql' : 'sqlite', version: '1.2.1', features: ['pwa', 'reviews'] });
});

// Debug endpoint to check admin routes are loaded
app.get('/api/debug/routes', (req, res) => {
    const routes = [];
    app._router.stack.forEach(middleware => {
        if (middleware.route) {
            routes.push({ path: middleware.route.path, methods: Object.keys(middleware.route.methods) });
        } else if (middleware.name === 'router') {
            middleware.handle.stack.forEach(handler => {
                if (handler.route) {
                    const path = handler.route.path;
                    const basePath = middleware.regexp.toString().includes('admin') ? '/api/admin' : '';
                    routes.push({ path: basePath + path, methods: Object.keys(handler.route.methods) });
                }
            });
        }
    });
    res.json({ routes: routes.filter(r => r.path.includes('admin') || r.path.includes('recalculate')) });
});

app.get('/api/db-test', asyncHandler(async (req, res) => {
    const result = await (USE_POSTGRES ? db.query('SELECT NOW() as time') : db.prepare('SELECT datetime("now") as time').get());
    res.json({ success: true, server_time: result.rows?.[0]?.time || result.time });
}));

// One-time fix: Recalculate all product ratings (requires secret key)
app.post('/api/fix/recalculate-ratings', asyncHandler(async (req, res) => {
    const secretKey = req.headers['x-fix-key'];
    if (secretKey !== process.env.ADMIN_PASSWORD) {
        throw new APIError('Unauthorized', 401, 'AUTH_ERROR');
    }
    
    const productsResult = await query('SELECT id FROM products');
    let updated = 0;
    
    for (const product of productsResult.rows) {
        const statsResult = await query(`
            SELECT 
                COALESCE(AVG(rating), 0) as average_rating,
                COUNT(*) as review_count
            FROM reviews 
            WHERE product_id = $1 AND status = 'approved'
        `, [product.id]);
        
        const averageRating = parseFloat(statsResult.rows[0].average_rating) || 0;
        const reviewCount = parseInt(statsResult.rows[0].review_count) || 0;
        
        await query(`
            UPDATE products 
            SET average_rating = $1, review_count = $2 
            WHERE id = $3
        `, [averageRating, reviewCount, product.id]);
        
        updated++;
    }
    
    res.json({ success: true, message: `Recalculated ratings for ${updated} products` });
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

// Backward Compatibility Aliases
app.get('/api/inventory/check/:productId', (req, res) => res.redirect(307, `/api/products/inventory/check/${req.params.productId}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`));
app.post('/api/inventory/check', (req, res) => res.redirect(307, '/api/products/inventory/check'));
app.post('/api/coupons/validate', (req, res) => res.redirect(307, '/api/orders/validate-coupon'));

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
