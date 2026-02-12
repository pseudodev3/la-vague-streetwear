/**
 * LA VAGUE - Backend Server
 * Express.js API with PostgreSQL database (or SQLite for local dev)
 * ES Module version
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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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
        ssl: { rejectUnauthorized: false } // Required for Render
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

// Initialize database tables
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
        
        await db.query(`
            CREATE TABLE IF NOT EXISTS admin_sessions (
                id SERIAL PRIMARY KEY,
                session_key TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL
            )
        `);
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
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS admin_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_key TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL
            )
        `);
    }
    
    // Seed products if empty
    await seedProducts();
    console.log('✅ Database initialized');
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

// Database query helpers
async function query(sql, params = []) {
    try {
        if (USE_POSTGRES) {
            const result = await db.query(sql, params);
            return result;
        } else {
            const stmt = db.prepare(sql.replace(/\$\d+/g, '?'));
            if (sql.trim().toLowerCase().startsWith('select')) {
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

// Middleware
app.use(helmet());
app.use(cors({
    origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        callback(null, true);
    },
    credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Rate limiting
const orderLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { success: false, error: 'Too many orders from this IP, please try again later.' }
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
    next();
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), database: USE_POSTGRES ? 'postgresql' : 'sqlite' });
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
app.get('/api/products', async (req, res) => {
    try {
        const result = await query('SELECT * FROM products ORDER BY created_at DESC');
        const products = result.rows.map(p => {
            // PostgreSQL pg driver auto-parses JSON, SQLite returns strings
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
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch products' });
    }
});

// Get product by slug
app.get('/api/products/:slug', async (req, res) => {
    try {
        const result = await query('SELECT * FROM products WHERE slug = $1', [req.params.slug]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }
        const p = result.rows[0];
        // PostgreSQL pg driver auto-parses JSON, SQLite returns strings
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
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch product' });
    }
});

// Create order
app.post('/api/orders', orderLimiter, async (req, res) => {
    try {
        const orderId = 'LV-' + Math.random().toString(36).substring(2, 10).toUpperCase();
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

        console.log(`✅ Order created: ${orderId} for ${customerEmail}`);
        res.json({ success: true, orderId });
    } catch (error) {
        console.error('❌ Error creating order:', error);
        res.status(500).json({ success: false, error: 'Failed to create order' });
    }
});

// Test database connection endpoint
app.get('/api/db-test', async (req, res) => {
    try {
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
    } catch (error) {
        console.error('[DB TEST] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// ADMIN AUTHENTICATION (Secure)
// ==========================================

// Admin login - returns a session token
app.post('/api/admin/login', async (req, res) => {
    const { password } = req.body;
    
    // Get admin password from environment variable
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminPassword) {
        console.error('[ADMIN] ADMIN_PASSWORD not set in environment');
        return res.status(500).json({ success: false, error: 'Server configuration error' });
    }
    
    if (password !== adminPassword) {
        console.log('[ADMIN] Login failed - invalid password');
        return res.status(401).json({ success: false, error: 'Invalid password' });
    }
    
    // Generate a simple session token (in production, use JWT)
    const token = crypto.randomBytes(32).toString('hex');
    
    // Store session in database
    try {
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
    } catch (error) {
        console.error('[ADMIN] Session creation error:', error);
        res.status(500).json({ success: false, error: 'Session creation failed' });
    }
});

// Verify admin token middleware
async function verifyAdminToken(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ success: false, error: 'No token provided' });
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
            return res.status(401).json({ success: false, error: 'Invalid or expired token' });
        }
        
        req.adminToken = token;
        next();
    } catch (error) {
        console.error('[ADMIN] Token verification error:', error);
        res.status(500).json({ success: false, error: 'Token verification failed' });
    }
}

// Admin logout
app.post('/api/admin/logout', verifyAdminToken, async (req, res) => {
    try {
        if (USE_POSTGRES) {
            await db.query('DELETE FROM admin_sessions WHERE session_key = $1', [req.adminToken]);
        } else {
            db.prepare('DELETE FROM admin_sessions WHERE session_key = ?').run(req.adminToken);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('[ADMIN] Logout error:', error);
        res.status(500).json({ success: false, error: 'Logout failed' });
    }
});

// Update admin endpoints to use token instead of key query param
app.get('/api/admin/orders', verifyAdminToken, async (req, res) => {
    try {
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
    } catch (error) {
        console.error('[ADMIN] Error fetching orders:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch orders' });
    }
});

app.post('/api/admin/orders/:id/status', verifyAdminToken, async (req, res) => {
    try {
        const { status } = req.body;
        if (USE_POSTGRES) {
            await db.query('UPDATE orders SET order_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', 
                [status, req.params.id]);
        } else {
            db.prepare('UPDATE orders SET order_status = ?, updated_at = datetime("now") WHERE id = ?')
                .run(status, req.params.id);
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ success: false, error: 'Failed to update order' });
    }
});

app.get('/api/admin/stats', verifyAdminToken, async (req, res) => {
    try {
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
        
        res.json({
            success: true,
            stats: {
                totalOrders: parseInt(totalOrders.rows[0].count),
                pendingOrders: parseInt(pendingOrders.rows[0].count),
                totalRevenue: parseInt(totalRevenue.rows[0].sum || totalRevenue.rows[0].coalesce),
                recentOrders
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
});

// ==========================================
// CONTACT FORM
// ==========================================
app.post('/api/contact', async (req, res) => {
    const { name, email, subject, message } = req.body;
    
    // Validation
    if (!name || !email || !message) {
        return res.status(400).json({ 
            success: false, 
            error: 'Name, email, and message are required' 
        });
    }
    
    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid email address' 
        });
    }
    
    try {
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
            to: process.env.SMTP_USER, // Send to your own email
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
        
    } catch (error) {
        console.error('[CONTACT] Email error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to send message. Please try again later.' 
        });
    }
});

// Initialize and start server
async function startServer() {
    await initDatabase();
    
    // Log important info
    console.log('========================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Database: ${USE_POSTGRES ? 'PostgreSQL' : 'SQLite'}`);
    console.log(`🔑 ADMIN_PASSWORD: ${process.env.ADMIN_PASSWORD ? 'SET' : 'NOT SET - ADMIN LOGIN WILL FAIL!'}`);
    console.log(`🔗 FRONTEND_URL: ${process.env.FRONTEND_URL || 'not set'}`);
    console.log('========================================');
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log('Server is ready to accept connections');
    });
}

startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
