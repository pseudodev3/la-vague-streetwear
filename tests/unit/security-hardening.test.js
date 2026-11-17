import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

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
vi.mock('../../src/middleware/csrf.js', () => ({
    csrfProtection: (req, res, next) => next(),
    generateCSRFToken: () => 'stub'
}));

const emailMocks = {
    sendReviewConfirmationEmail: vi.fn(async () => {}),
    sendNewReviewNotification: vi.fn(async () => {})
};
vi.mock('../../email-templates/index.js', () => ({
    ...emailMocks,
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
    sendContactNotification: vi.fn(async () => {}),
    emailService: {}
}));

let db;
let server;
let base;

beforeAll(async () => {
    vi.stubEnv('DATABASE_URL', '');
    ({ db } = await import('../../src/config/db.js'));

    db.exec(`
        CREATE TABLE products (
            id TEXT PRIMARY KEY,
            slug TEXT,
            name TEXT,
            average_rating REAL DEFAULT 0,
            review_count INTEGER DEFAULT 0
        );
        CREATE TABLE orders (
            id TEXT PRIMARY KEY,
            customer_email TEXT NOT NULL,
            payment_status TEXT DEFAULT 'pending',
            items TEXT NOT NULL
        );
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
    `);

    db.prepare(`INSERT INTO products (id, slug, name) VALUES (?, ?, ?)`).run(
        'prod-1',
        'wave-hoodie',
        'Wave Hoodie'
    );
    db.prepare(`INSERT INTO orders (id, customer_email, payment_status, items) VALUES (?, ?, ?, ?)`).run(
        'ORD-PAID-1',
        'buyer@example.com',
        'paid',
        JSON.stringify([{ id: 'prod-1', name: 'Wave Hoodie', quantity: 1 }])
    );
    db.prepare(`INSERT INTO orders (id, customer_email, payment_status, items) VALUES (?, ?, ?, ?)`).run(
        'ORD-UNPAID-1',
        'unpaid@example.com',
        'pending',
        JSON.stringify([{ id: 'prod-1', name: 'Wave Hoodie', quantity: 1 }])
    );
    db.prepare(`INSERT INTO orders (id, customer_email, payment_status, items) VALUES (?, ?, ?, ?)`).run(
        'ORD-OTHER-PROD',
        'buyer@example.com',
        'paid',
        JSON.stringify([{ id: 'prod-99', name: 'Other Item', quantity: 1 }])
    );
    db.prepare(`
        INSERT INTO reviews (id, product_id, order_id, customer_email, customer_name, rating, title, review_text, photos, verified_purchase, status, admin_response)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        'rvw-approved',
        'prod-1',
        'ORD-PAID-1',
        'secret@example.com',
        'Alice',
        5,
        'Great',
        'Love it',
        '[]',
        1,
        'approved',
        'Thanks!'
    );
    db.prepare(`
        INSERT INTO reviews (id, product_id, order_id, customer_email, customer_name, rating, title, review_text, photos, verified_purchase, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        'rvw-pending',
        'prod-1',
        'ORD-PAID-1',
        'pending@example.com',
        'Bob',
        2,
        'Pending',
        'Hidden',
        '[]',
        0,
        'pending'
    );

    const express = (await import('express')).default;
    const { globalErrorHandler, notFoundHandler } = await import('../../src/middleware/errorHandler.js');
    const productsRouter = (await import('../../src/routes/products.js')).default;
    const { validateCreateOrder } = await import('../../src/middleware/validation.js');

    const app = express();
    app.use(express.json());
    app.use('/api/products', productsRouter);
    app.post('/api/test-order-validation', validateCreateOrder, (req, res) => {
        res.json({ success: true });
    });
    app.use(notFoundHandler);
    app.use(globalErrorHandler);

    server = app.listen(0);
    const { port } = server.address();
    base = `http://127.0.0.1:${port}`;
});

afterAll(() => {
    server?.close();
});

describe('Security hardening', () => {
    it('GET /:id/reviews returns only approved reviews and strips customer_email & order_id', async () => {
        for (const qs of ['', '?status=pending', '?status=']) {
            const res = await fetch(`${base}/api/products/prod-1/reviews${qs}`);
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.reviews).toHaveLength(1);
            const review = data.reviews[0];
            expect(review.id).toBe('rvw-approved');
            expect(review.customer_name).toBe('Alice');
            expect(review.admin_response).toBe('Thanks!');
            expect(review.customer_email).toBeUndefined();
            expect(review.order_id).toBeUndefined();
        }
    });

    it('POST /:id/reviews validates input fields', async () => {
        const res = await fetch(`${base}/api/products/prod-1/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customerEmail: 'not-an-email',
                customerName: 'Test',
                rating: 9,
                reviewText: 'Bad rating'
            })
        });
        expect(res.status).toBe(400);
    });

    it('POST /:id/reviews grants verified_purchase only for matching paid order with product', async () => {
        // Fake orderId -> verified_purchase = 0
        const fakeRes = await fetch(`${base}/api/products/prod-1/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId: 'ORD-FAKE-999',
                customerEmail: 'buyer@example.com',
                customerName: 'Buyer',
                rating: 5,
                title: 'Nice',
                reviewText: 'Great hoodie'
            })
        });
        expect(fakeRes.status).toBe(200);
        const fakeData = await fakeRes.json();
        const fakeRow = db.prepare('SELECT verified_purchase FROM reviews WHERE id = ?').get(fakeData.reviewId);
        expect(fakeRow.verified_purchase).toBe(0);

        // Unpaid order -> verified_purchase = 0
        const unpaidRes = await fetch(`${base}/api/products/prod-1/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId: 'ORD-UNPAID-1',
                customerEmail: 'unpaid@example.com',
                customerName: 'Unpaid',
                rating: 5,
                reviewText: 'Not paid yet'
            })
        });
        expect(unpaidRes.status).toBe(200);
        const unpaidData = await unpaidRes.json();
        const unpaidRow = db.prepare('SELECT verified_purchase FROM reviews WHERE id = ?').get(unpaidData.reviewId);
        expect(unpaidRow.verified_purchase).toBe(0);

        // Paid order for different product -> verified_purchase = 0
        const otherProdRes = await fetch(`${base}/api/products/prod-1/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId: 'ORD-OTHER-PROD',
                customerEmail: 'buyer@example.com',
                customerName: 'Buyer',
                rating: 5,
                reviewText: 'Wrong product'
            })
        });
        expect(otherProdRes.status).toBe(200);
        const otherProdData = await otherProdRes.json();
        const otherProdRow = db.prepare('SELECT verified_purchase FROM reviews WHERE id = ?').get(otherProdData.reviewId);
        expect(otherProdRow.verified_purchase).toBe(0);

        // Matching paid order containing prod-1 -> verified_purchase = 1
        const validRes = await fetch(`${base}/api/products/prod-1/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId: 'ORD-PAID-1',
                customerEmail: 'BUYER@example.com',
                customerName: 'Buyer',
                rating: 5,
                reviewText: 'Verified!'
            })
        });
        expect(validRes.status).toBe(200);
        const validData = await validRes.json();
        expect(validData.reviewId).toMatch(/^rvw-[0-9a-f]{12}$/);
        const validRow = db.prepare('SELECT verified_purchase FROM reviews WHERE id = ?').get(validData.reviewId);
        expect(validRow.verified_purchase).toBe(1);
    });

    it('validateCreateOrder rejects manual and cash payment methods, allows paystack', async () => {
        const baseOrder = {
            customerEmail: 'buyer@example.com',
            customerName: 'John Doe',
            customerPhone: '+15551234567',
            shippingAddress: {
                address: '123 Test St',
                city: 'New York',
                state: 'NY',
                zip: '10001'
            },
            shippingMethod: 'standard',
            shippingCost: 10,
            subtotal: 100,
            total: 110,
            items: [{ id: 'prod-1', name: 'Wave Hoodie', color: 'Black', size: 'L', price: 100, quantity: 1 }]
        };

        for (const method of ['manual', 'cash']) {
            const res = await fetch(`${base}/api/test-order-validation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...baseOrder, paymentMethod: method })
            });
            expect(res.status).toBe(400);
        }

        const okRes = await fetch(`${base}/api/test-order-validation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...baseOrder, paymentMethod: 'paystack' })
        });
        expect(okRes.status).toBe(200);
    });
});
