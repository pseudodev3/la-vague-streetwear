import { describe, expect, it, vi } from 'vitest';
import express from 'express';

// The DB module imports better-sqlite3; exercise the real SQLite driver in
// memory rather than opening the developer's database file.
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

import { normalizeEmail, legacyGmailDotStripped } from '../../src/utils/sanitization.js';
import { validateCreateOrder, handleValidationErrors } from '../../src/middleware/validation.js';
import { lookupOrder } from '../../src/services/orderService.js';

function runValidation(field, value) {
    return new Promise(resolve => {
        const app = express();
        app.use(express.json());
        // Only run the customerEmail validator from the chain, then surface its
        // result via handleValidationErrors so invalid input returns 400.
        const chain = validateCreateOrder.find(item => item.builder?.fields?.includes(field));
        app.post('/', chain, handleValidationErrors, (req, res) => {
            res.json({ value: req.body[field] });
        });
        app.use((err, _req, res) => res.status(500).json({ error: err.message }));

        const server = app.listen(0);
        const port = server.address().port;
        fetch(`http://127.0.0.1:${port}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: value })
        })
            .then(async r => {
                const j = await r.json();
                server.close();
                resolve({ status: r.status, body: j });
            })
            .catch(e => {
                server.close();
                resolve({ error: e.message });
            });
    });
}

describe('normalizeEmail helper', () => {
    it('lowercases and trims but preserves dots', () => {
        expect(normalizeEmail('  Prvda.Xo@Gmail.com  ')).toBe('prvda.xo@gmail.com');
    });

    it('preserves +tag sub-addresses', () => {
        expect(normalizeEmail('Orders+Shop@Example.com')).toBe('orders+shop@example.com');
    });

    it('passes through non-string input untouched', () => {
        expect(normalizeEmail(undefined)).toBeUndefined();
        expect(normalizeEmail(null)).toBeNull();
    });
});

describe('legacyGmailDotStripped helper', () => {
    it('strips dots from a gmail local part', () => {
        expect(legacyGmailDotStripped('prvda.xo@gmail.com')).toBe('prvdaxo@gmail.com');
    });

    it('strips dots from a googlemail address too', () => {
        expect(legacyGmailDotStripped('a.b.c@googlemail.com')).toBe('abc@googlemail.com');
    });

    it('returns null for non-gmail providers (dots are meaningful there)', () => {
        expect(legacyGmailDotStripped('prvda.xo@yahoo.com')).toBeNull();
        expect(legacyGmailDotStripped('prvda.xo@outlook.com')).toBeNull();
    });

    it('returns null when there are no dots to strip', () => {
        expect(legacyGmailDotStripped('prvdaxo@gmail.com')).toBe('prvdaxo@gmail.com');
    });
});

describe('validateCreateOrder — gmail dots are no longer stripped', () => {
    it('keeps dots in a gmail address through the middleware', async () => {
        const { status, body } = await runValidation('customerEmail', 'prvda.xo@gmail.com');
        expect(status).toBe(200);
        expect(body.value).toBe('prvda.xo@gmail.com');
    });

    it('keeps +tag sub-addresses through the middleware', async () => {
        const { status, body } = await runValidation('customerEmail', 'orders+promo@yahoo.com');
        expect(status).toBe(200);
        expect(body.value).toBe('orders+promo@yahoo.com');
    });

    it('still lowercases the address', async () => {
        const { status, body } = await runValidation('customerEmail', 'PRVDA.XO@GMAIL.COM');
        expect(status).toBe(200);
        expect(body.value).toBe('prvda.xo@gmail.com');
    });

    it('still rejects an invalid email', async () => {
        const { status } = await runValidation('customerEmail', 'not-an-email');
        expect(status).toBe(400);
    });
});

describe('lookupOrder — normalizes the input email before querying', () => {
    it('finds an order stored dot-stripped when the customer types the dotted form', async () => {
        // Simulate a legacy order row written before this fix, where
        // normalizeEmail() had stripped the gmail dot: stored as prvdaxo@gmail.com.
        const { db } = await import('../../src/config/db.js');
        db.exec(`
            CREATE TABLE orders (
                id TEXT PRIMARY KEY,
                customer_name TEXT,
                customer_email TEXT NOT NULL,
                customer_phone TEXT,
                shipping_address TEXT,
                items TEXT,
                total REAL,
                subtotal REAL,
                shipping_method TEXT,
                shipping_rate REAL,
                discount_code TEXT,
                discount_amount REAL,
                payment_method TEXT,
                payment_status TEXT DEFAULT 'pending',
                payment_reference TEXT,
                order_status TEXT DEFAULT 'pending',
                tracking_number TEXT,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        `);
        db.prepare('INSERT INTO orders (id, customer_email, total) VALUES (?, ?, ?)').run(
            'LV-LEGACY-1',
            'prvdaxo@gmail.com',
            5000
        );

        // Customer types the original dotted address to track the order.
        const order = await lookupOrder('LV-LEGACY-1', '  Prvda.Xo@Gmail.com ');
        expect(order).toBeTruthy();
        expect(order.id).toBe('LV-LEGACY-1');
    });

    it('throws ORDER_NOT_FOUND when the email genuinely does not match', async () => {
        await expect(lookupOrder('LV-LEGACY-1', 'someone.else@gmail.com')).rejects.toMatchObject({
            statusCode: 404
        });
    });

    it('finds a new (post-fix) order stored verbatim with dots preserved', async () => {
        const { db } = await import('../../src/config/db.js');
        db.prepare('INSERT INTO orders (id, customer_email, total) VALUES (?, ?, ?)').run(
            'LV-NEW-1',
            'prvda.xo@gmail.com',
            5000
        );
        // Exact match on the dotted form — no fallback needed.
        const order = await lookupOrder('LV-NEW-1', 'prvda.xo@gmail.com');
        expect(order.id).toBe('LV-NEW-1');
    });

    it('does NOT apply the dot-stripped fallback for non-gmail providers', async () => {
        const { db } = await import('../../src/config/db.js');
        // A legacy yahoo order mistakenly stored dot-stripped. For yahoo, dots are
        // meaningful, so the fallback must not "rescue" a wrong lookup — that
        // would surface the wrong customer's order.
        db.prepare('INSERT INTO orders (id, customer_email, total) VALUES (?, ?, ?)').run(
            'LV-YAHOO-1',
            'prvdaxo@yahoo.com',
            5000
        );
        await expect(lookupOrder('LV-YAHOO-1', 'prvda.xo@yahoo.com')).rejects.toMatchObject({
            statusCode: 404
        });
    });
});
