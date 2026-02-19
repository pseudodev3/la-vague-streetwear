import { db, USE_POSTGRES, query } from '../config/db.js';
import { InventoryService } from './inventory.js';
import { ProductService } from './productService.js';

export async function initDatabase() {
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                average_rating DECIMAL(2,1) DEFAULT 0,
                review_count INTEGER DEFAULT 0
            )
        `);
        
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
        
        await db.query(`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON admin_sessions(expires_at)`);
        
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
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                average_rating REAL DEFAULT 0,
                review_count INTEGER DEFAULT 0
            )
        `);
        
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
    }
    
    await seedProducts();
    await initAuditTables();
    await seedSettings();
    
    const inventoryService = new InventoryService(db, USE_POSTGRES);
    const productService = new ProductService(db, USE_POSTGRES);
    
    // Start periodic cleanup
    setInterval(() => {
        inventoryService.cleanupExpiredReservations();
    }, 5 * 60 * 1000);
    
    console.log('✅ Database initialized');
    return { inventoryService, productService };
}

async function initAuditTables() {
    if (USE_POSTGRES) {
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
        
        await db.query(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await db.query(`
            CREATE TABLE IF NOT EXISTS coupons (
                id TEXT PRIMARY KEY,
                code TEXT UNIQUE NOT NULL,
                type TEXT NOT NULL,
                value INTEGER NOT NULL,
                min_order_amount INTEGER DEFAULT 0,
                max_discount_amount INTEGER,
                usage_limit INTEGER,
                usage_count INTEGER DEFAULT 0,
                per_customer_limit INTEGER DEFAULT 1,
                start_date DATE,
                end_date DATE,
                applicable_categories JSONB,
                applicable_products JSONB,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active)`);
        
        await db.query(`
            CREATE TABLE IF NOT EXISTS reviews (
                id TEXT PRIMARY KEY,
                product_id TEXT NOT NULL,
                order_id TEXT,
                customer_email TEXT NOT NULL,
                customer_name TEXT,
                rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
                title TEXT,
                review_text TEXT,
                photos JSONB,
                verified_purchase BOOLEAN DEFAULT false,
                status TEXT DEFAULT 'pending',
                helpful_count INTEGER DEFAULT 0,
                admin_response TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status)`);
        
        await db.query(`
            CREATE TABLE IF NOT EXISTS waitlist (
                id SERIAL PRIMARY KEY,
                product_id TEXT NOT NULL,
                customer_email TEXT NOT NULL,
                customer_name TEXT,
                variant_key TEXT,
                status TEXT DEFAULT 'waiting',
                notified_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await db.query(`
            CREATE TABLE IF NOT EXISTS coupon_usage (
                id SERIAL PRIMARY KEY,
                coupon_id TEXT NOT NULL,
                order_id TEXT NOT NULL,
                customer_email TEXT NOT NULL,
                discount_amount INTEGER NOT NULL,
                used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await db.query(`
            CREATE TABLE IF NOT EXISTS webhook_logs (
                id SERIAL PRIMARY KEY,
                event_type TEXT NOT NULL,
                reference TEXT,
                amount INTEGER,
                customer_email TEXT,
                raw_data JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    } else {
        // SQLite
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
        db.exec(`
            CREATE TABLE IF NOT EXISTS order_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT NOT NULL,
                note TEXT NOT NULL,
                is_internal BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        db.exec(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        db.exec(`
            CREATE TABLE IF NOT EXISTS coupons (
                id TEXT PRIMARY KEY,
                code TEXT UNIQUE NOT NULL,
                type TEXT NOT NULL,
                value INTEGER NOT NULL,
                min_order_amount INTEGER DEFAULT 0,
                max_discount_amount INTEGER,
                usage_limit INTEGER,
                usage_count INTEGER DEFAULT 0,
                per_customer_limit INTEGER DEFAULT 1,
                start_date DATE,
                end_date DATE,
                applicable_categories TEXT,
                applicable_products TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        db.exec(`
            CREATE TABLE IF NOT EXISTS reviews (
                id TEXT PRIMARY KEY,
                product_id TEXT NOT NULL,
                order_id TEXT,
                customer_email TEXT NOT NULL,
                customer_name TEXT,
                rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
                title TEXT,
                review_text TEXT,
                photos TEXT,
                verified_purchase BOOLEAN DEFAULT 0,
                status TEXT DEFAULT 'pending',
                helpful_count INTEGER DEFAULT 0,
                admin_response TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        db.exec(`
            CREATE TABLE IF NOT EXISTS waitlist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id TEXT NOT NULL,
                customer_email TEXT NOT NULL,
                customer_name TEXT,
                variant_key TEXT,
                status TEXT DEFAULT 'waiting',
                notified_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        db.exec(`
            CREATE TABLE IF NOT EXISTS coupon_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                coupon_id TEXT NOT NULL,
                order_id TEXT NOT NULL,
                customer_email TEXT NOT NULL,
                discount_amount INTEGER NOT NULL,
                used_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        db.exec(`
            CREATE TABLE IF NOT EXISTS webhook_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                reference TEXT,
                amount INTEGER,
                customer_email TEXT,
                raw_data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }
}

async function seedSettings() {
    const defaultSettings = [
        { key: 'storeName', value: 'LA VAGUE' },
        { key: 'supportEmail', value: 'support@la-vague.store' },
        { key: 'freeShippingThreshold', value: '150000' },
        { key: 'standardShippingRate', value: '10000' },
        { key: 'expressShippingRate', value: '25000' },
        { key: 'currency_rates', value: JSON.stringify({ USD: 1, NGN: 1550, EUR: 0.94, GBP: 0.80 }) }
    ];

    if (USE_POSTGRES) {
        for (const s of defaultSettings) {
            await db.query(
                'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP',
                [s.key, s.value]
            );
        }
    } else {
        const insert = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now"))');
        for (const s of defaultSettings) {
            insert.run(s.key, s.value);
        }
    }
}

async function seedProducts() {
    const products = [
        {
            id: 'lv-hoodie-001',
            name: 'Classic Oversized Hoodie',
            slug: 'classic-oversized-hoodie',
            category: 'hoodies',
            price: 35000,
            compare_at_price: null,
            description: 'Crafted from 450gsm heavyweight cotton, our signature hoodie features a relaxed oversized fit, dropped shoulders, and our embroidered wave logo.',
            features: JSON.stringify(['450gsm Organic Cotton', 'Double-layered hood', 'Embroidered logo']),
            images: JSON.stringify([{ src: './assets/hoodie.jpg', alt: 'Classic Oversized Hoodie' }]),
            colors: JSON.stringify([{ name: 'Black', value: '#0a0a0a' }, { name: 'Ash Grey', value: '#8a8a8a' }]),
            sizes: JSON.stringify(['S', 'M', 'L', 'XL']),
            inventory: JSON.stringify({ 'Black-S': 10, 'Black-M': 15, 'Ash Grey-L': 8 }),
            tags: JSON.stringify(['bestseller', 'signature']),
            badge: 'Bestseller'
        },
        {
            id: 'lv-tee-001',
            name: 'Wave Box Logo Tee',
            slug: 'wave-box-logo-tee',
            category: 'tees',
            price: 18500,
            compare_at_price: null,
            description: 'The essential LA VAGUE tee. Heavyweight 240gsm cotton with our iconic box logo print.',
            features: JSON.stringify(['240gsm heavyweight cotton', 'Pre-shrunk', 'Screen printed logo']),
            images: JSON.stringify([{ src: './assets/tshirts.jpg', alt: 'Wave Box Logo Tee' }]),
            colors: JSON.stringify([{ name: 'White', value: '#ffffff' }, { name: 'Black', value: '#0a0a0a' }]),
            sizes: JSON.stringify(['S', 'M', 'L', 'XL']),
            inventory: JSON.stringify({ 'White-M': 20, 'Black-L': 15 }),
            tags: JSON.stringify(['bestseller', 'essential']),
            badge: 'Essential'
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
                `, [p.id, p.name, p.slug, p.category, p.price, p.compare_at_price, p.description,
                    p.features, p.images, p.colors, p.sizes, p.inventory, p.tags, p.badge]);
            }
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
        }
    }
}
