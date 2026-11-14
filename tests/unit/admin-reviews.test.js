import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Exercise the real SQLite driver without opening the developer's database file.
vi.mock('better-sqlite3', async importOriginal => {
    const { default: Database } = await importOriginal();
    return {
        default: class extends Database {
            constructor() {
                super(':memory:');
            }
        }
    };
});
vi.mock('dotenv', () => ({ default: { config() {} } }));

// Bypass auth + csrf for these route tests (we are testing route behavior,
// not the session guards, which have their own coverage elsewhere).
vi.mock('../../src/middleware/auth.js', () => ({
    verifyAdminSession: (req, res, next) => next(),
    setAdminSessionCookie: () => {},
    clearAdminSessionCookie: () => {}
}));
vi.mock('../../src/middleware/csrf.js', () => ({
    csrfProtection: (req, res, next) => next(),
    generateCSRFToken: () => 'stub'
}));

// Stub external-effect dependencies so the router can be imported in isolation.
vi.mock('../../email-templates/index.js', () => ({
    generateOrderEmail: vi.fn(() => ''),
    generateOrderConfirmationEmail: vi.fn(() => ''),
    generateOrderStatusEmail: vi.fn(() => ''),
    generateTestEmail: vi.fn(() => ''),
    sendOrderConfirmation: vi.fn(async () => {}),
    sendOrderStatusUpdate: vi.fn(async () => {}),
    testEmailConfig: vi.fn(async () => ({})),
    previewEmail: vi.fn(() => ''),
    sendTestEmail: vi.fn(async () => {}),
    getEmailQueueStats: vi.fn(() => ({})),
    isEmailConfigured: () => false,
    getEmailConfig: () => ({}),
    sendReviewConfirmationEmail: vi.fn(async () => {}),
    sendNewReviewNotification: vi.fn(async () => {}),
    sendContactNotification: vi.fn(async () => {}),
    emailService: {}
}));
vi.mock('../../src/utils/audit.js', () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock('../../src/services/cloudinary.js', () => ({
    uploadImage: vi.fn(async () => ({ secure_url: 'stub' })),
    deleteImage: vi.fn(async () => {})
}));

let db;
let app;
let server;
let base;

beforeAll(async () => {
    vi.stubEnv('DATABASE_URL', '');
    ({ db } = await import('../../src/config/db.js'));

    // Minimal schema covering what the review routes touch.
    db.exec(`
        CREATE TABLE reviews (
            id TEXT PRIMARY KEY,
            product_id TEXT NOT NULL,
            order_id TEXT,
            customer_email TEXT NOT NULL,
            customer_name TEXT,
            rating INTEGER NOT NULL,
            title TEXT,
            review_text TEXT,
            photos TEXT,
            verified_purchase INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            helpful_count INTEGER DEFAULT 0,
            admin_response TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE products (
            id TEXT PRIMARY KEY,
            slug TEXT,
            name TEXT,
            average_rating REAL DEFAULT 0,
            review_count INTEGER DEFAULT 0
        );
        CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
    `);

    const express = (await import('express')).default;
    const { globalErrorHandler, notFoundHandler } = await import('../../src/middleware/errorHandler.js');
    const adminRouterFactory = (await import('../../src/routes/admin.js')).default;

    app = express();
    app.use(express.json());
    app.use('/admin', adminRouterFactory({}, {}));
    app.use(notFoundHandler);
    app.use(globalErrorHandler);
    server = app.listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => {
    server?.close();
    db?.close();
    vi.unstubAllEnvs();
});

async function jget(path) {
    const r = await fetch(`${base}${path}`);
    return { status: r.status, body: await r.json() };
}
async function jdel(path) {
    const r = await fetch(`${base}${path}`, { method: 'DELETE' });
    return { status: r.status, body: await r.json() };
}

describe('admin review deletion', () => {
    it('deletes a review and recalculates the product rating', async () => {
        db.prepare('INSERT INTO products VALUES (?, ?, ?, ?, ?)').run('p1', 'slug-1', 'Hoodie', 0, 0);
        db.prepare('INSERT INTO reviews (id, product_id, customer_email, rating, status) VALUES (?, ?, ?, ?, ?)').run(
            'rev-1',
            'p1',
            'a@b.com',
            5,
            'approved'
        );

        const { status, body } = await jdel('/admin/reviews/rev-1');
        expect(status).toBe(200);
        expect(body).toEqual({ success: true, message: 'Review deleted' });

        // Row is gone.
        const stillThere = db.prepare('SELECT id FROM reviews WHERE id = ?').get('rev-1');
        expect(stillThere).toBeUndefined();

        // Product rating was recalculated (0 reviews => average 0, count 0).
        const prod = db.prepare('SELECT average_rating, review_count FROM products WHERE id = ?').get('p1');
        expect(prod.average_rating).toBe(0);
        expect(prod.review_count).toBe(0);
    });

    it('returns 404 when deleting a review that does not exist', async () => {
        const { status } = await jdel('/admin/reviews/nope');
        expect(status).toBe(404);
    });

    it('still exposes GET /admin/reviews (route list intact)', async () => {
        const { status } = await jget('/admin/reviews');
        expect(status).toBe(200);
    });
});

describe('paystack config no longer leaks testMode', () => {
    it('omits testMode for a test public key', async () => {
        vi.stubEnv('PAYSTACK_PUBLIC_KEY', 'pk_test_abc123');
        const configRouter = (await import('../../src/routes/config.js')).default;
        const express = (await import('express')).default;
        const a = express();
        a.use(express.json());
        a.use('/config', configRouter);
        const srv = a.listen(0);
        try {
            const r = await fetch(`http://127.0.0.1:${srv.address().port}/config/paystack`);
            const j = await r.json();
            expect(r.status).toBe(200);
            expect(j.publicKey).toBe('pk_test_abc123');
            expect(j.configured).toBe(true);
            expect(j).not.toHaveProperty('testMode');
        } finally {
            srv.close();
            vi.unstubAllEnvs();
        }
    });
});
