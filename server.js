/**
 * LA VAGUE - Backend Server
 * Express.js API with PostgreSQL database (or SQLite for local dev)
 * ES Module version - SECURITY HARDENED
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import multer from 'multer';

// Import custom middleware and services
import { InventoryService } from './src/services/inventory.js';
import { ProductService } from './src/services/productService.js';
import { 
    validateCreateOrder, 
    validateAdminLogin, 
    validateUpdateOrderStatus, 
    validateContactForm 
} from './src/middleware/validation.js';
import { 
    globalErrorHandler, 
    asyncHandler, 
    notFoundHandler,
    APIError 
} from './src/middleware/errorHandler.js';

dotenv.config();

const app = express();

// Initialize services (will be set after DB connection)
let inventoryService;
let productService;
const PORT = process.env.PORT || 3000;

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 5 // Max 5 files
    },
    fileFilter: (req, file, cb) => {
        // Accept only images
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine database type
const USE_POSTGRES = !!process.env.DATABASE_URL;

let db;
if (USE_POSTGRES) {
    // PostgreSQL for production (Render)
    const { Pool } = await import('pg');
    db = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // Required for Render
        max: 10, // Connection pool limit
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });
    console.log('✅ Using PostgreSQL database');
} else {
    // SQLite for local development
    const { default: Database } = await import('better-sqlite3');
    db = new Database('database.sqlite');
    console.log('✅ Using SQLite database (local)');
}

// Trust proxy (required for rate limiting behind Render's load balancer)
app.set('trust proxy', 1);

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================

// Helmet with secure defaults
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "https:", "data:", "blob:"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            connectSrc: ["'self'", process.env.FRONTEND_URL || "*"],
        },
    },
    crossOriginEmbedderPolicy: false, // Allow images from external sources
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// CORS - Restrict to known origins in production
const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL || 'https://la-vague.store', 'https://la-vague.store']
    : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000'];

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Compression
app.use(compression());

// Body parsing with limits
app.use(express.json({ 
    limit: '10mb',
    strict: true // Only accept arrays and objects
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files with caching
app.use(express.static('public', {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    etag: true
}));

// ==========================================
// RATE LIMITING
// ==========================================

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many requests, please try again later.',
        code: 'RATE_LIMIT'
    }
});

// Stricter limiter for order creation
const orderLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many orders from this IP, please try again later.',
        code: 'RATE_LIMIT'
    }
});

// Auth rate limiter (prevents brute force)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful logins
    message: {
        success: false,
        error: 'Too many login attempts, please try again later.',
        code: 'RATE_LIMIT'
    }
});

// Apply general rate limiting to all API routes
app.use('/api/', apiLimiter);

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'} - IP: ${req.ip}`);
    next();
});

// ==========================================
// DATABASE FUNCTIONS
// ==========================================

// Initialize database tables with indexes
async function initDatabase() {
    if (USE_POSTGRES) {
        // PostgreSQL tables
        await db.query(`
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                category TEXT NOT NULL,
                price INTEGER NOT NULL,
                compare_at_price INTEGER,
                description TEXT,
                features JSONB,
                images JSONB,
                colors JSONB,
                sizes JSONB,
                inventory JSONB,
                tags JSONB,
                badge TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create indexes for better performance
        await db.query(`CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at DESC)`);
        
        await db.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                customer_name TEXT NOT NULL,
                customer_email TEXT NOT NULL,
                customer_phone TEXT,
                shipping_address JSONB NOT NULL,
                items JSONB NOT NULL,
                subtotal INTEGER NOT NULL,
                shipping_cost INTEGER NOT NULL,
                discount INTEGER DEFAULT 0,
                total INTEGER NOT NULL,
                payment_method TEXT NOT NULL,
                payment_status TEXT DEFAULT 'pending',
                payment_reference TEXT,
                order_status TEXT DEFAULT 'pending',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Order indexes
        await db.query(`CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC)`);
        
        await db.query(`
            CREATE TABLE IF NOT EXISTS admin_sessions (
                id SERIAL PRIMARY KEY,
                session_key TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL
            )
        `);
        
        // Session cleanup index
        await db.query(`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON admin_sessions(expires_at)`);
        
        // Inventory reservations table
        await db.query(`
            CREATE TABLE IF NOT EXISTS inventory_reservations (
                id SERIAL PRIMARY KEY,
                product_id TEXT NOT NULL,
                variant_key TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                order_id TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL
            )
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_reservations_order ON inventory_reservations(order_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_reservations_expires ON inventory_reservations(expires_at)`);
        
    } else {
        // SQLite tables
        db.exec(`
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                category TEXT NOT NULL,
                price INTEGER NOT NULL,
                compare_at_price INTEGER,
                description TEXT,
                features TEXT,
                images TEXT,
                colors TEXT,
                sizes TEXT,
                inventory TEXT,
                tags TEXT,
                badge TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // SQLite indexes
        db.exec(`CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`);
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                customer_name TEXT NOT NULL,
                customer_email TEXT NOT NULL,
                customer_phone TEXT,
                shipping_address TEXT NOT NULL,
                items TEXT NOT NULL,
                subtotal INTEGER NOT NULL,
                shipping_cost INTEGER NOT NULL,
                discount INTEGER DEFAULT 0,
                total INTEGER NOT NULL,
                payment_method TEXT NOT NULL,
                payment_status TEXT DEFAULT 'pending',
                payment_reference TEXT,
                order_status TEXT DEFAULT 'pending',
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        db.exec(`CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status)`);
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS admin_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_key TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL
            )
        `);
        
        db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON admin_sessions(expires_at)`);
        
        // Note: For SQLite, reservations are stored in-memory via InventoryService
    }
    
    // Seed products if empty
    await seedProducts();
    
    // Initialize audit tables
    await initAuditTables();
    
    // Initialize services
    inventoryService = new InventoryService(db, USE_POSTGRES);
    productService = new ProductService(db, USE_POSTGRES);
    
    // Start periodic cleanup of expired reservations (every 5 minutes)
    setInterval(() => {
        inventoryService.cleanupExpiredReservations();
    }, 5 * 60 * 1000);
    
    console.log('✅ Database initialized with indexes');
}

// ==========================================
// AUDIT LOGGING SYSTEM
// ==========================================

async function initAuditTables() {
    if (USE_POSTGRES) {
        // Audit logs table
        await db.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                action TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id TEXT,
                old_data JSONB,
                new_data JSONB,
                performed_by TEXT,
                ip_address TEXT,
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC)`);
        
        // Inventory movements table
        await db.query(`
            CREATE TABLE IF NOT EXISTS inventory_movements (
                id SERIAL PRIMARY KEY,
                product_id TEXT NOT NULL,
                variant_key TEXT NOT NULL,
                movement_type TEXT NOT NULL,
                quantity_change INTEGER NOT NULL,
                quantity_before INTEGER NOT NULL,
                quantity_after INTEGER NOT NULL,
                reference_id TEXT,
                reference_type TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON inventory_movements(created_at DESC)`);
        
        // Order notes table
        await db.query(`
            CREATE TABLE IF NOT EXISTS order_notes (
                id SERIAL PRIMARY KEY,
                order_id TEXT NOT NULL,
                note TEXT NOT NULL,
                is_internal BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_order_notes_order ON order_notes(order_id)`);
        
        // Settings table
        await db.query(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    } else {
        // SQLite versions
        db.exec(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id TEXT,
                old_data TEXT,
                new_data TEXT,
                performed_by TEXT,
                ip_address TEXT,
                user_agent TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id)`);
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS inventory_movements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id TEXT NOT NULL,
                variant_key TEXT NOT NULL,
                movement_type TEXT NOT NULL,
                quantity_change INTEGER NOT NULL,
                quantity_before INTEGER NOT NULL,
                quantity_after INTEGER NOT NULL,
                reference_id TEXT,
                reference_type TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id)`);
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS order_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT NOT NULL,
                note TEXT NOT NULL,
                is_internal BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_order_notes_order ON order_notes(order_id)`);
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }
    
    console.log('✅ Audit tables initialized');
}

// Audit logging function
async function logAudit(action, entityType, entityId, oldData, newData, req) {
    try {
        const performedBy = req?.adminToken ? 'admin' : 'system';
        const ipAddress = req?.ip || 'unknown';
        const userAgent = req?.headers?.['user-agent'] || 'unknown';
        
        if (USE_POSTGRES) {
            await db.query(`
                INSERT INTO audit_logs (action, entity_type, entity_id, old_data, new_data, performed_by, ip_address, user_agent)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [action, entityType, entityId, JSON.stringify(oldData), JSON.stringify(newData), performedBy, ipAddress, userAgent]);
        } else {
            db.prepare(`
                INSERT INTO audit_logs (action, entity_type, entity_id, old_data, new_data, performed_by, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(action, entityType, entityId, JSON.stringify(oldData), JSON.stringify(newData), performedBy, ipAddress, userAgent);
        }
    } catch (error) {
        console.error('[AUDIT] Failed to log:', error.message);
    }
}

// Log inventory movement
async function logInventoryMovement(productId, variantKey, movementType, quantityChange, quantityBefore, referenceId, referenceType, notes) {
    try {
        const quantityAfter = quantityBefore + quantityChange;
        
        if (USE_POSTGRES) {
            await db.query(`
                INSERT INTO inventory_movements (product_id, variant_key, movement_type, quantity_change, quantity_before, quantity_after, reference_id, reference_type, notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [productId, variantKey, movementType, quantityChange, quantityBefore, quantityAfter, referenceId, referenceType, notes]);
        } else {
            db.prepare(`
                INSERT INTO inventory_movements (product_id, variant_key, movement_type, quantity_change, quantity_before, quantity_after, reference_id, reference_type, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(productId, variantKey, movementType, quantityChange, quantityBefore, quantityAfter, referenceId, referenceType, notes);
        }
    } catch (error) {
        console.error('[INVENTORY] Failed to log movement:', error.message);
    }
}

// Seed sample products
async function seedProducts() {
    const products = [
        {
            id: 'prod-001',
            name: 'Classic White Shirt',
            slug: 'classic-white-shirt',
            category: 'shirts',
            price: 4500,
            compare_at_price: 5500,
            description: 'Premium cotton classic white shirt perfect for any occasion.',
            features: JSON.stringify(['100% Cotton', 'Breathable fabric', 'Classic fit']),
            images: JSON.stringify(['https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800']),
            colors: JSON.stringify(['White', 'Blue']),
            sizes: JSON.stringify(['S', 'M', 'L', 'XL']),
            inventory: JSON.stringify({S: 10, M: 15, L: 8, XL: 5}),
            tags: JSON.stringify(['classic', 'essential']),
            badge: 'bestseller'
        },
        {
            id: 'prod-002',
            name: 'Slim Fit Chinos',
            slug: 'slim-fit-chinos',
            category: 'pants',
            price: 6500,
            compare_at_price: null,
            description: 'Modern slim fit chinos for a sharp look.',
            features: JSON.stringify(['Stretch cotton', 'Slim fit', 'Classic design']),
            images: JSON.stringify(['https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800']),
            colors: JSON.stringify(['Khaki', 'Navy', 'Olive']),
            sizes: JSON.stringify(['30', '32', '34', '36']),
            inventory: JSON.stringify({'30': 8, '32': 12, '34': 10, '36': 6}),
            tags: JSON.stringify(['casual', 'versatile']),
            badge: null
        },
        {
            id: 'prod-003',
            name: 'Summer Floral Dress',
            slug: 'summer-floral-dress',
            category: 'dresses',
            price: 8500,
            compare_at_price: 10000,
            description: 'Beautiful floral dress perfect for summer days.',
            features: JSON.stringify(['Lightweight fabric', 'Floral print', 'A-line cut']),
            images: JSON.stringify(['https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800']),
            colors: JSON.stringify(['Pink Floral', 'Blue Floral']),
            sizes: JSON.stringify(['XS', 'S', 'M', 'L']),
            inventory: JSON.stringify({XS: 5, S: 10, M: 12, L: 8}),
            tags: JSON.stringify(['summer', 'floral']),
            badge: 'new'
        },
        {
            id: 'prod-004',
            name: 'Denim Jacket',
            slug: 'denim-jacket',
            category: 'jackets',
            price: 12000,
            compare_at_price: null,
            description: 'Classic denim jacket that never goes out of style.',
            features: JSON.stringify(['100% Denim', 'Classic cut', 'Durable']),
            images: JSON.stringify(['https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=800']),
            colors: JSON.stringify(['Light Blue', 'Dark Blue']),
            sizes: JSON.stringify(['S', 'M', 'L', 'XL']),
            inventory: JSON.stringify({S: 6, M: 10, L: 8, XL: 4}),
            tags: JSON.stringify(['classic', 'denim']),
            badge: null
        }
    ];
    
    if (USE_POSTGRES) {
        const result = await db.query('SELECT COUNT(*) FROM products');
        if (parseInt(result.rows[0].count) === 0) {
            for (const p of products) {
                await db.query(`
                    INSERT INTO products (id, name, slug, category, price, compare_at_price, description, 
                        features, images, colors, sizes, inventory, tags, badge)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                    ON CONFLICT (id) DO NOTHING
                `, [p.id, p.name, p.slug, p.category, p.price, p.compare_at_price, p.description,
                    p.features, p.images, p.colors, p.sizes, p.inventory, p.tags, p.badge]);
            }
            console.log('✅ Sample products seeded');
        }
    } else {
        const count = db.prepare('SELECT COUNT(*) as count FROM products').get();
        if (count.count === 0) {
            const insert = db.prepare(`
                INSERT INTO products (id, name, slug, category, price, compare_at_price, description, 
                    features, images, colors, sizes, inventory, tags, badge)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            for (const p of products) {
                insert.run(p.id, p.name, p.slug, p.category, p.price, p.compare_at_price, p.description,
                    p.features, p.images, p.colors, p.sizes, p.inventory, p.tags, p.badge);
            }
            console.log('✅ Sample products seeded');
        }
    }
}

// Secure database query helper with SQL injection protection
async function query(sql, params = []) {
    try {
        // Validate that sql only uses parameterized placeholders
        if (!/^\s*(SELECT|INSERT|UPDATE|DELETE)\s/i.test(sql)) {
            throw new Error('Invalid query type');
        }
        
        if (USE_POSTGRES) {
            const result = await db.query(sql, params);
            return result;
        } else {
            // For SQLite, validate parameter count matches
            const placeholderCount = (sql.match(/\?/g) || []).length;
            if (placeholderCount !== params.length) {
                throw new Error(`Parameter mismatch: expected ${placeholderCount}, got ${params.length}`);
            }
            
            const stmt = db.prepare(sql);
            if (sql.trim().toLowerCase().startsWith('select')) {
                if (sql.includes('LIMIT 1') || sql.match(/WHERE\s+\w+\s*=\s*\?/i)) {
                    return { rows: [stmt.get(...params)].filter(Boolean) };
                }
                return { rows: stmt.all(...params) };
            } else {
                return stmt.run(...params);
            }
        }
    } catch (error) {
        console.error('[DB ERROR] Query failed:', sql.substring(0, 100), 'Error:', error.message);
        throw error;
    }
}

// ==========================================
// API ROUTES
// ==========================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(), 
        database: USE_POSTGRES ? 'postgresql' : 'sqlite',
        version: '1.1.0'
    });
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'API is reachable',
        origin: req.headers.origin,
        timestamp: new Date().toISOString()
    });
});

// Get all products
app.get('/api/products', asyncHandler(async (req, res) => {
    const result = await query('SELECT * FROM products ORDER BY created_at DESC');
    const products = result.rows.map(p => {
        const parseJson = (val) => typeof val === 'string' ? JSON.parse(val || 'null') : val;
        return {
            ...p,
            features: parseJson(p.features) || [],
            images: parseJson(p.images) || [],
            colors: parseJson(p.colors) || [],
            sizes: parseJson(p.sizes) || [],
            inventory: parseJson(p.inventory) || {},
            tags: parseJson(p.tags) || []
        };
    });
    res.json({ success: true, products });
}));

// Get product by slug
app.get('/api/products/:slug', asyncHandler(async (req, res) => {
    const result = await query('SELECT * FROM products WHERE slug = $1', [req.params.slug]);
    if (result.rows.length === 0) {
        throw new APIError('Product not found', 404, 'NOT_FOUND');
    }
    const p = result.rows[0];
    const parseJson = (val) => typeof val === 'string' ? JSON.parse(val || 'null') : val;
    res.json({
        success: true,
        product: {
            ...p,
            features: parseJson(p.features) || [],
            images: parseJson(p.images) || [],
            colors: parseJson(p.colors) || [],
            sizes: parseJson(p.sizes) || [],
            inventory: parseJson(p.inventory) || {},
            tags: parseJson(p.tags) || []
        }
    });
}));

// Create order with validation and inventory check
app.post('/api/orders', orderLimiter, validateCreateOrder, asyncHandler(async (req, res) => {
    const orderId = 'LV-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const { 
        customerName, 
        customerEmail, 
        customerPhone, 
        shippingAddress, 
        items, 
        subtotal, 
        shippingCost, 
        discount,
        total,
        paymentMethod,
        notes
    } = req.body;

    console.log('[ORDER] Creating order:', { customerName, customerEmail, total, items: items?.length });

    // Check and reserve inventory
    try {
        await inventoryService.reserveItems(items, orderId);
        console.log(`[INVENTORY] Reserved stock for order ${orderId}`);
    } catch (error) {
        console.error(`[INVENTORY] Reservation failed: ${error.message}`);
        throw new APIError(error.message, 409, 'INSUFFICIENT_STOCK');
    }

    try {
        const shippingAddressStr = JSON.stringify(shippingAddress);
        const itemsStr = JSON.stringify(items);

        if (USE_POSTGRES) {
            await db.query(`
                INSERT INTO orders (id, customer_name, customer_email, customer_phone, shipping_address, 
                    items, subtotal, shipping_cost, discount, total, payment_method, notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `, [orderId, customerName, customerEmail, customerPhone, shippingAddressStr,
                itemsStr, subtotal, shippingCost, discount || 0, total, paymentMethod, notes || '']);
        } else {
            db.prepare(`
                INSERT INTO orders (id, customer_name, customer_email, customer_phone, shipping_address, 
                    items, subtotal, shipping_cost, discount, total, payment_method, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(orderId, customerName, customerEmail, customerPhone, shippingAddressStr,
                itemsStr, subtotal, shippingCost, discount || 0, total, paymentMethod, notes || '');
        }

        // Confirm the reservation (deduct from actual inventory)
        await inventoryService.confirmReservation(orderId, items);
        console.log(`[INVENTORY] Confirmed stock deduction for order ${orderId}`);

        console.log(`✅ Order created: ${orderId} for ${customerEmail}`);
        res.json({ success: true, orderId });
    } catch (error) {
        // Release reservation on error
        await inventoryService.cancelReservation(orderId);
        console.error(`[ORDER] Failed to create order, released reservation: ${error.message}`);
        throw error;
    }
}));

// Test database connection endpoint
app.get('/api/db-test', asyncHandler(async (req, res) => {
    if (USE_POSTGRES) {
        const result = await db.query('SELECT NOW() as time, COUNT(*) as order_count FROM orders');
        res.json({ 
            success: true, 
            database: 'postgresql',
            server_time: result.rows[0].time,
            order_count: parseInt(result.rows[0].order_count)
        });
    } else {
        const result = db.prepare('SELECT datetime("now") as time, COUNT(*) as order_count FROM orders').get();
        res.json({ 
            success: true, 
            database: 'sqlite',
            server_time: result.time,
            order_count: result.order_count
        });
    }
}));

// ==========================================
// ADMIN AUTHENTICATION
// ==========================================

// Admin login with rate limiting and validation
app.post('/api/admin/login', authLimiter, validateAdminLogin, asyncHandler(async (req, res) => {
    const { password } = req.body;
    
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminPassword) {
        console.error('[ADMIN] ADMIN_PASSWORD not set in environment');
        throw new APIError('Server configuration error', 500, 'CONFIG_ERROR');
    }
    
    // Use timing-safe comparison to prevent timing attacks
    const passwordBuffer = Buffer.from(password);
    const adminBuffer = Buffer.from(adminPassword);
    
    if (passwordBuffer.length !== adminBuffer.length || 
        !crypto.timingSafeEqual(passwordBuffer, adminBuffer)) {
        console.log('[ADMIN] Login failed - invalid password');
        throw new APIError('Invalid password', 401, 'AUTH_ERROR');
    }
    
    // Generate session token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Store session in database
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry
    
    if (USE_POSTGRES) {
        await db.query(
            'INSERT INTO admin_sessions (session_key, expires_at) VALUES ($1, $2)',
            [token, expiresAt]
        );
    } else {
        db.prepare('INSERT INTO admin_sessions (session_key, expires_at) VALUES (?, ?)')
            .run(token, expiresAt.toISOString());
    }
    
    console.log('[ADMIN] Login successful, token generated');
    res.json({ success: true, token });
}));

// Verify admin token middleware
async function verifyAdminToken(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
        return res.status(401).json({ success: false, error: 'Invalid token format', code: 'AUTH_ERROR' });
    }
    
    try {
        let session;
        
        if (USE_POSTGRES) {
            const result = await db.query(
                'SELECT * FROM admin_sessions WHERE session_key = $1 AND expires_at > NOW()',
                [token]
            );
            session = result.rows[0];
        } else {
            session = db.prepare(
                'SELECT * FROM admin_sessions WHERE session_key = ? AND expires_at > datetime("now")'
            ).get(token);
        }
        
        if (!session) {
            return res.status(401).json({ success: false, error: 'Invalid or expired token', code: 'AUTH_ERROR' });
        }
        
        req.adminToken = token;
        next();
    } catch (error) {
        console.error('[ADMIN] Token verification error:', error);
        throw new APIError('Token verification failed', 500, 'INTERNAL_ERROR');
    }
}

// Admin logout
app.post('/api/admin/logout', verifyAdminToken, asyncHandler(async (req, res) => {
    if (USE_POSTGRES) {
        await db.query('DELETE FROM admin_sessions WHERE session_key = $1', [req.adminToken]);
    } else {
        db.prepare('DELETE FROM admin_sessions WHERE session_key = ?').run(req.adminToken);
    }
    
    res.json({ success: true });
}));

// Get admin orders
app.get('/api/admin/orders', verifyAdminToken, asyncHandler(async (req, res) => {
    const result = await query('SELECT * FROM orders ORDER BY created_at DESC');
    console.log(`[ADMIN] Found ${result.rows.length} orders`);
    
    const orders = result.rows.map(o => {
        const shippingAddress = typeof o.shipping_address === 'string' 
            ? JSON.parse(o.shipping_address || '{}') 
            : (o.shipping_address || {});
        const items = typeof o.items === 'string' 
            ? JSON.parse(o.items || '[]') 
            : (o.items || []);
        return { ...o, shippingAddress, items };
    });
    res.json({ success: true, orders });
}));

// Update order status with validation
app.post('/api/admin/orders/:id/status', 
    verifyAdminToken, 
    validateUpdateOrderStatus, 
    asyncHandler(async (req, res) => {
        const { status } = req.body;
        const { id } = req.params;
        
        if (USE_POSTGRES) {
            await db.query('UPDATE orders SET order_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', 
                [status, id]);
        } else {
            db.prepare('UPDATE orders SET order_status = ?, updated_at = datetime("now") WHERE id = ?')
                .run(status, id);
        }
        
        console.log(`[ADMIN] Order ${id} status updated to: ${status}`);
        res.json({ success: true });
    })
);

// Get admin stats
app.get('/api/admin/stats', verifyAdminToken, asyncHandler(async (req, res) => {
    let totalOrders, pendingOrders, totalRevenue, recentOrdersResult;
    
    if (USE_POSTGRES) {
        totalOrders = await db.query('SELECT COUNT(*) FROM orders');
        pendingOrders = await db.query("SELECT COUNT(*) FROM orders WHERE order_status = 'pending'");
        totalRevenue = await db.query("SELECT COALESCE(SUM(total), 0) FROM orders WHERE payment_status = 'completed'");
        recentOrdersResult = await db.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5');
    } else {
        totalOrders = { rows: [{ count: db.prepare('SELECT COUNT(*) as count FROM orders').get().count }] };
        pendingOrders = { rows: [{ count: db.prepare("SELECT COUNT(*) as count FROM orders WHERE order_status = 'pending'").get().count }] };
        totalRevenue = { rows: [{ sum: db.prepare("SELECT COALESCE(SUM(total), 0) as sum FROM orders WHERE payment_status = 'completed'").get().sum }] };
        recentOrdersResult = { rows: db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5').all() };
    }
    
    const recentOrders = recentOrdersResult.rows.map(o => {
        const shippingAddress = typeof o.shipping_address === 'string' 
            ? JSON.parse(o.shipping_address || '{}') 
            : (o.shipping_address || {});
        const items = typeof o.items === 'string' 
            ? JSON.parse(o.items || '[]') 
            : (o.items || []);
        return { ...o, shippingAddress, items };
    });
    
    const stats = {
        totalOrders: parseInt(totalOrders.rows[0].count) || 0,
        pendingOrders: parseInt(pendingOrders.rows[0].count) || 0,
        totalRevenue: parseInt(totalRevenue.rows[0].sum || totalRevenue.rows[0].coalesce || 0),
        recentOrders
    };
    
    console.log('[ADMIN STATS]', stats);
    
    res.json({
        success: true,
        stats
    });
}));

// ==========================================
// PRODUCT MANAGEMENT (Admin Only)
// ==========================================

// Get all products (admin - with full details)
app.get('/api/admin/products', verifyAdminToken, asyncHandler(async (req, res) => {
    const { category, search, limit, offset } = req.query;
    const products = await productService.getAll({ category, search, limit, offset });
    res.json({ success: true, products });
}));

// Get product stats (MUST come before /:id route)
app.get('/api/admin/products/stats', verifyAdminToken, asyncHandler(async (req, res) => {
    const stats = await productService.getStats();
    res.json({ success: true, stats });
}));

// Get single product
app.get('/api/admin/products/:id', verifyAdminToken, asyncHandler(async (req, res) => {
    const product = await productService.getById(req.params.id);
    if (!product) {
        throw new APIError('Product not found', 404, 'NOT_FOUND');
    }
    res.json({ success: true, product });
}));

// Create product with image upload
app.post('/api/admin/products', 
    verifyAdminToken, 
    upload.array('images', 5),
    asyncHandler(async (req, res) => {
        try {
            const productData = {
                ...req.body,
                features: JSON.parse(req.body.features || '[]'),
                colors: JSON.parse(req.body.colors || '[]'),
                sizes: JSON.parse(req.body.sizes || '[]'),
                inventory: JSON.parse(req.body.inventory || '{}'),
                tags: JSON.parse(req.body.tags || '[]')
            };
            
            const product = await productService.create(productData, req.files);
            console.log(`[PRODUCT] Created: ${product.id} - ${product.name}`);
            res.status(201).json({ success: true, product });
        } catch (error) {
            console.error('[PRODUCT] Create error:', error.message);
            throw new APIError(`Failed to create product: ${error.message}`, 500, 'CREATE_ERROR');
        }
    })
);

// Update product with image upload
app.put('/api/admin/products/:id',
    verifyAdminToken,
    upload.array('images', 5),
    asyncHandler(async (req, res) => {
        const productData = {
            ...req.body,
            features: req.body.features ? JSON.parse(req.body.features) : undefined,
            colors: req.body.colors ? JSON.parse(req.body.colors) : undefined,
            sizes: req.body.sizes ? JSON.parse(req.body.sizes) : undefined,
            inventory: req.body.inventory ? JSON.parse(req.body.inventory) : undefined,
            tags: req.body.tags ? JSON.parse(req.body.tags) : undefined,
            keepImages: req.body.keepImages ? JSON.parse(req.body.keepImages) : []
        };
        
        const imagesToDelete = req.body.imagesToDelete 
            ? JSON.parse(req.body.imagesToDelete) 
            : [];
        
        const product = await productService.update(
            req.params.id, 
            productData, 
            req.files, 
            imagesToDelete
        );
        console.log(`[PRODUCT] Updated: ${product.id} - ${product.name}`);
        res.json({ success: true, product });
    })
);

// Delete product
app.delete('/api/admin/products/:id', verifyAdminToken, asyncHandler(async (req, res) => {
    const result = await productService.delete(req.params.id);
    console.log(`[PRODUCT] Deleted: ${req.params.id}`);
    res.json({ success: true, ...result });
}));

// ==========================================
// INVENTORY MANAGEMENT (Admin Only)
// ==========================================

// Get low stock items (MUST come before /:productId route)
app.get('/api/admin/inventory/low-stock', verifyAdminToken, asyncHandler(async (req, res) => {
    const threshold = parseInt(req.query.threshold) || 5;
    const lowStock = await inventoryService.getLowStock(threshold);
    res.json({ success: true, lowStock, threshold });
}));

// Release reservation (for cancelled orders)
app.post('/api/admin/inventory/release/:orderId', verifyAdminToken, asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    await inventoryService.cancelReservation(orderId);
    console.log(`[INVENTORY] Released reservation for order ${orderId}`);
    res.json({ success: true, message: 'Reservation released' });
}));

// Get stock for a product variant
app.get('/api/admin/inventory/:productId', verifyAdminToken, asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { color, size } = req.query;
    
    if (!color || !size) {
        throw new APIError('Color and size are required', 400, 'VALIDATION_ERROR');
    }
    
    const stock = await inventoryService.getStock(productId, color, size);
    res.json({ success: true, stock });
}));

// Update stock for a product variant
app.post('/api/admin/inventory/:productId', verifyAdminToken, asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { color, size, quantity } = req.body;
    
    if (!color || !size || quantity === undefined) {
        throw new APIError('Color, size, and quantity are required', 400, 'VALIDATION_ERROR');
    }
    
    const result = await inventoryService.updateStock(productId, color, size, quantity);
    console.log(`[INVENTORY] Updated stock for ${productId} (${color}/${size}): ${quantity}`);
    res.json({ success: true, ...result });
}));

// Check stock availability (public endpoint)
app.get('/api/inventory/check/:productId', asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { color, size } = req.query;
    
    if (!color || !size) {
        throw new APIError('Color and size are required', 400, 'VALIDATION_ERROR');
    }
    
    const stock = await inventoryService.getStock(productId, color, size);
    res.json({ 
        success: true, 
        available: stock.available,
        inStock: stock.available > 0
    });
}));

// ==========================================
// CONTACT FORM
// ==========================================
app.post('/api/contact', validateContactForm, asyncHandler(async (req, res) => {
    const { name, email, subject, message } = req.body;
    
    // Create transporter
    const transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
    
    // Send email
    await transporter.sendMail({
        from: `"LA VAGUE Contact Form" <${process.env.SMTP_USER}>`,
        to: process.env.SMTP_USER,
        replyTo: email,
        subject: `Contact Form: ${subject || 'New Message'}`,
        text: `
Name: ${name}
Email: ${email}
Subject: ${subject || 'N/A'}

Message:
${message}
        `,
        html: `
<h3>New Contact Form Submission</h3>
<p><strong>Name:</strong> ${name}</p>
<p><strong>Email:</strong> ${email}</p>
<p><strong>Subject:</strong> ${subject || 'N/A'}</p>
<hr>
<p><strong>Message:</strong></p>
<p>${message.replace(/\n/g, '<br>')}</p>
        `
    });
    
    console.log(`[CONTACT] Email sent from ${email}`);
    res.json({ success: true, message: 'Message sent successfully' });
}));

// ==========================================
// AUDIT LOGS (Admin Only)
// ==========================================

// Get audit logs with filtering
app.get('/api/admin/audit-logs', verifyAdminToken, asyncHandler(async (req, res) => {
    const { entityType, entityId, action, limit = 50, offset = 0 } = req.query;
    
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    
    if (entityType) {
        sql += ` AND entity_type = $${params.length + 1}`;
        params.push(entityType);
    }
    if (entityId) {
        sql += ` AND entity_id = $${params.length + 1}`;
        params.push(entityId);
    }
    if (action) {
        sql += ` AND action = $${params.length + 1}`;
        params.push(action);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    if (USE_POSTGRES) {
        sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        const result = await db.query(sql, params);
        res.json({ success: true, logs: result.rows });
    } else {
        sql += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const stmt = db.prepare(sql);
        res.json({ success: true, logs: stmt.all(...params) });
    }
}));

// ==========================================
// ANALYTICS (Admin Only)
// ==========================================

// Get sales analytics
app.get('/api/admin/analytics/sales', verifyAdminToken, asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;
    const days = parseInt(period) || 30;
    
    let result;
    if (USE_POSTGRES) {
        result = await db.query(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as orders,
                COALESCE(SUM(total), 0) as revenue,
                COALESCE(SUM(subtotal), 0) as subtotal,
                COALESCE(SUM(shipping_cost), 0) as shipping
            FROM orders
            WHERE created_at > NOW() - INTERVAL '${days} days'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `);
    } else {
        result = db.prepare(`
            SELECT 
                date(created_at) as date,
                COUNT(*) as orders,
                COALESCE(SUM(total), 0) as revenue,
                COALESCE(SUM(subtotal), 0) as subtotal,
                COALESCE(SUM(shipping_cost), 0) as shipping
            FROM orders
            WHERE created_at > datetime('now', '-${days} days')
            GROUP BY date(created_at)
            ORDER BY date DESC
        `).all();
        result = { rows: result };
    }
    
    res.json({ success: true, data: result.rows });
}));

// Get top products
app.get('/api/admin/analytics/top-products', verifyAdminToken, asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;
    
    // Get all orders and calculate product sales
    let orders;
    if (USE_POSTGRES) {
        const result = await db.query('SELECT items FROM orders WHERE created_at > NOW() - INTERVAL \'30 days\'');
        orders = result.rows;
    } else {
        orders = db.prepare("SELECT items FROM orders WHERE created_at > datetime('now', '-30 days')").all();
    }
    
    const productSales = {};
    orders.forEach(order => {
        const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        items.forEach(item => {
            if (!productSales[item.id]) {
                productSales[item.id] = { ...item, totalQty: 0, totalRevenue: 0 };
            }
            productSales[item.id].totalQty += item.quantity;
            productSales[item.id].totalRevenue += item.price * item.quantity;
        });
    });
    
    const topProducts = Object.values(productSales)
        .sort((a, b) => b.totalQty - a.totalQty)
        .slice(0, limit);
    
    res.json({ success: true, products: topProducts });
}));

// Get customer analytics
app.get('/api/admin/analytics/customers', verifyAdminToken, asyncHandler(async (req, res) => {
    let result;
    if (USE_POSTGRES) {
        result = await db.query(`
            SELECT 
                COUNT(DISTINCT customer_email) as total_customers,
                COUNT(DISTINCT CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN customer_email END) as new_customers,
                COUNT(DISTINCT CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN customer_email END) as recent_customers
            FROM orders
        `);
    } else {
        const row = db.prepare(`
            SELECT 
                COUNT(DISTINCT customer_email) as total_customers,
                COUNT(DISTINCT CASE WHEN created_at > datetime('now', '-30 days') THEN customer_email END) as new_customers,
                COUNT(DISTINCT CASE WHEN created_at > datetime('now', '-7 days') THEN customer_email END) as recent_customers
            FROM orders
        `).get();
        result = { rows: [row] };
    }
    
    res.json({ success: true, stats: result.rows[0] });
}));

// ==========================================
// CUSTOMER MANAGEMENT (Admin Only)
// ==========================================

// Get all customers (from orders)
app.get('/api/admin/customers', verifyAdminToken, asyncHandler(async (req, res) => {
    const { search, limit = 50, offset = 0 } = req.query;
    
    let sql = `
        SELECT 
            customer_email,
            customer_name,
            customer_phone,
            COUNT(*) as order_count,
            COALESCE(SUM(total), 0) as lifetime_value,
            MAX(created_at) as last_order_date,
            MIN(created_at) as first_order_date
        FROM orders
    `;
    const params = [];
    
    if (search) {
        sql += ` WHERE customer_email ILIKE $${params.length + 1} OR customer_name ILIKE $${params.length + 1}`;
        params.push(`%${search}%`);
    }
    
    sql += ' GROUP BY customer_email, customer_name, customer_phone ORDER BY last_order_date DESC';
    
    if (USE_POSTGRES) {
        sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        const result = await db.query(sql, params);
        res.json({ success: true, customers: result.rows });
    } else {
        sql += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const stmt = db.prepare(sql.replace(/ILIKE/g, 'LIKE'));
        res.json({ success: true, customers: stmt.all(...params) });
    }
}));

// Get single customer with order history
app.get('/api/admin/customers/:email', verifyAdminToken, asyncHandler(async (req, res) => {
    const email = decodeURIComponent(req.params.email);
    
    let customer, orders;
    if (USE_POSTGRES) {
        const customerResult = await db.query(`
            SELECT 
                customer_email,
                customer_name,
                customer_phone,
                COUNT(*) as order_count,
                COALESCE(SUM(total), 0) as lifetime_value,
                MAX(created_at) as last_order_date,
                MIN(created_at) as first_order_date
            FROM orders
            WHERE customer_email = $1
            GROUP BY customer_email, customer_name, customer_phone
        `, [email]);
        customer = customerResult.rows[0];
        
        const ordersResult = await db.query(`
            SELECT * FROM orders WHERE customer_email = $1 ORDER BY created_at DESC
        `, [email]);
        orders = ordersResult.rows;
    } else {
        customer = db.prepare(`
            SELECT 
                customer_email,
                customer_name,
                customer_phone,
                COUNT(*) as order_count,
                COALESCE(SUM(total), 0) as lifetime_value,
                MAX(created_at) as last_order_date,
                MIN(created_at) as first_order_date
            FROM orders
            WHERE customer_email = ?
            GROUP BY customer_email, customer_name, customer_phone
        `).get(email);
        
        orders = db.prepare('SELECT * FROM orders WHERE customer_email = ? ORDER BY created_at DESC').all(email);
    }
    
    if (!customer) {
        throw new APIError('Customer not found', 404, 'NOT_FOUND');
    }
    
    res.json({ success: true, customer, orders });
}));

// ==========================================
// ORDER NOTES (Admin Only)
// ==========================================

// Get notes for an order
app.get('/api/admin/orders/:id/notes', verifyAdminToken, asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    let result;
    if (USE_POSTGRES) {
        result = await db.query(
            'SELECT * FROM order_notes WHERE order_id = $1 ORDER BY created_at DESC',
            [id]
        );
    } else {
        result = db.prepare('SELECT * FROM order_notes WHERE order_id = ? ORDER BY created_at DESC').all(id);
        result = { rows: result };
    }
    
    res.json({ success: true, notes: USE_POSTGRES ? result.rows : result });
}));

// Add note to order
app.post('/api/admin/orders/:id/notes', verifyAdminToken, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { note, isInternal = true } = req.body;
    
    if (!note || note.trim().length === 0) {
        throw new APIError('Note is required', 400, 'VALIDATION_ERROR');
    }
    
    if (USE_POSTGRES) {
        await db.query(
            'INSERT INTO order_notes (order_id, note, is_internal) VALUES ($1, $2, $3)',
            [id, note, isInternal]
        );
    } else {
        db.prepare('INSERT INTO order_notes (order_id, note, is_internal) VALUES (?, ?, ?)')
            .run(id, note, isInternal ? 1 : 0);
    }
    
    await logAudit('ADD_NOTE', 'order', id, null, { note }, req);
    
    res.json({ success: true, message: 'Note added' });
}));

// ==========================================
// INVENTORY MOVEMENTS (Admin Only)
// ==========================================

// Get inventory movement history
app.get('/api/admin/inventory/movements', verifyAdminToken, asyncHandler(async (req, res) => {
    const { productId, limit = 50, offset = 0 } = req.query;
    
    let sql = 'SELECT * FROM inventory_movements';
    const params = [];
    
    if (productId) {
        sql += ` WHERE product_id = $${params.length + 1}`;
        params.push(productId);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    if (USE_POSTGRES) {
        sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        const result = await db.query(sql, params);
        res.json({ success: true, movements: result.rows });
    } else {
        sql += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const stmt = db.prepare(sql);
        res.json({ success: true, movements: stmt.all(...params) });
    }
}));

// ==========================================
// SETTINGS (Admin Only)
// ==========================================

// Get all settings
app.get('/api/admin/settings', verifyAdminToken, asyncHandler(async (req, res) => {
    let result;
    if (USE_POSTGRES) {
        result = await db.query('SELECT * FROM settings');
    } else {
        result = db.prepare('SELECT * FROM settings').all();
        result = { rows: result };
    }
    
    const settings = {};
    (USE_POSTGRES ? result.rows : result).forEach(row => {
        settings[row.key] = row.value;
    });
    
    res.json({ success: true, settings });
}));

// Update settings
app.post('/api/admin/settings', verifyAdminToken, asyncHandler(async (req, res) => {
    const { settings } = req.body;
    
    if (USE_POSTGRES) {
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            for (const [key, value] of Object.entries(settings)) {
                await client.query(
                    'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP',
                    [key, value]
                );
            }
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } else {
        const insert = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now"))');
        for (const [key, value] of Object.entries(settings)) {
            insert.run(key, value);
        }
    }
    
    await logAudit('UPDATE_SETTINGS', 'settings', null, null, settings, req);
    
    res.json({ success: true, message: 'Settings updated' });
}));

// ==========================================
// DATA EXPORT (Admin Only)
// ==========================================

// Export orders as CSV
app.get('/api/admin/export/orders', verifyAdminToken, asyncHandler(async (req, res) => {
    const { startDate, endDate, status } = req.query;
    
    let sql = 'SELECT * FROM orders WHERE 1=1';
    const params = [];
    
    if (startDate) {
        sql += ` AND created_at >= $${params.length + 1}`;
        params.push(startDate);
    }
    if (endDate) {
        sql += ` AND created_at <= $${params.length + 1}`;
        params.push(endDate);
    }
    if (status) {
        sql += ` AND order_status = $${params.length + 1}`;
        params.push(status);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    let orders;
    if (USE_POSTGRES) {
        const result = await db.query(sql, params);
        orders = result.rows;
    } else {
        const stmt = db.prepare(sql.replace(/\$\d+/g, '?'));
        orders = stmt.all(...params);
    }
    
    // Generate CSV
    const headers = ['Order ID', 'Customer', 'Email', 'Phone', 'Address', 'Items', 'Subtotal', 'Shipping', 'Total', 'Status', 'Date'];
    const rows = orders.map(o => {
        const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
        const address = typeof o.shipping_address === 'string' ? JSON.parse(o.shipping_address) : o.shipping_address;
        return [
            o.id,
            `"${o.customer_name || ''}"`,
            o.customer_email,
            o.customer_phone || '',
            `"${address?.address || ''}"`,
            items.length,
            o.subtotal,
            o.shipping_cost,
            o.total,
            o.order_status,
            o.created_at
        ].join(',');
    });
    
    const csv = [headers.join(','), ...rows].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
    res.send(csv);
}));

// Export products as CSV
app.get('/api/admin/export/products', verifyAdminToken, asyncHandler(async (req, res) => {
    let products;
    if (USE_POSTGRES) {
        const result = await db.query('SELECT * FROM products ORDER BY name');
        products = result.rows;
    } else {
        products = db.prepare('SELECT * FROM products ORDER BY name').all();
    }
    
    const headers = ['ID', 'Name', 'Slug', 'Category', 'Price', 'Compare At', 'Description', 'Inventory', 'Created'];
    const rows = products.map(p => [
        p.id,
        `"${p.name}"`,
        p.slug,
        p.category,
        p.price,
        p.compare_at_price || '',
        `"${(p.description || '').replace(/"/g, '""')}"`,
        `"${p.inventory}"`,
        p.created_at
    ].join(','));
    
    const csv = [headers.join(','), ...rows].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=products.csv');
    res.send(csv);
}));

// ==========================================
// ERROR HANDLING
// ==========================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(globalErrorHandler);

// ==========================================
// SERVER STARTUP
// ==========================================

async function startServer() {
    await initDatabase();
    
    console.log('========================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Database: ${USE_POSTGRES ? 'PostgreSQL' : 'SQLite'}`);
    console.log(`📦 Inventory: Stock tracking + Reservation system`);
    console.log(`🖼️  Cloudinary: Image upload service`);
    console.log(`🛍️  Products: Full CRUD with image management`);
    console.log(`🔑 ADMIN_PASSWORD: ${process.env.ADMIN_PASSWORD ? 'SET' : 'NOT SET - ADMIN LOGIN WILL FAIL!'}`);
    console.log(`🔗 FRONTEND_URL: ${process.env.FRONTEND_URL || 'not set'}`);
    console.log(`🛡️  Security: Helmet + Rate Limiting + Input Validation`);
    console.log('========================================');
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log('Server is ready to accept connections');
    });
}

startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
