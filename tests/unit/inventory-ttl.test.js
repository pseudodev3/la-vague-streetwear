import { describe, expect, it, vi } from 'vitest';
import { InventoryService, RESERVATION_TTL_MINUTES, RESERVATION_TTL_MS } from '../../src/services/inventory.js';

describe('InventoryService 10-minute reservation TTL', () => {
    it('sets local SQLite reservations to expire in 10 minutes', async () => {
        const fakeDb = {
            prepare: () => ({
                get: () => ({ inventory: JSON.stringify({ 'Black-L': 5 }) })
            })
        };
        const service = new InventoryService(fakeDb, false);
        const before = Date.now();

        await service.reserveItems(
            [{ id: 'prod-1', name: 'Hoodie', color: 'Black', size: 'L', quantity: 2 }],
            'ORD-1'
        );

        const after = Date.now();
        expect(RESERVATION_TTL_MINUTES).toBe(10);
        expect(RESERVATION_TTL_MS).toBe(10 * 60 * 1000);

        const entry = service.reservations.get('prod-1:Black-L:ORD-1');
        expect(entry).toBeDefined();
        expect(entry.expiresAt).toBeGreaterThanOrEqual(before + RESERVATION_TTL_MS);
        expect(entry.expiresAt).toBeLessThanOrEqual(after + RESERVATION_TTL_MS);
    });

    it('uses INTERVAL 10 minutes on PostgreSQL reservations', async () => {
        const queries = [];
        const fakeClient = {
            query: vi.fn(async (sql, params) => {
                queries.push({ sql, params });
                if (sql.includes('FROM inventory_reservations WHERE order_id')) return { rows: [] };
                if (sql.includes('SELECT inventory FROM products')) {
                    return { rows: [{ inventory: { 'Black-L': 5 } }] };
                }
                if (sql.includes('COALESCE(SUM(quantity)')) return { rows: [{ reserved: 0 }] };
                return { rows: [] };
            }),
            release: vi.fn()
        };
        const fakePool = { connect: vi.fn(async () => fakeClient) };
        const service = new InventoryService(fakePool, true);

        await service.reserveItems(
            [{ id: 'prod-1', name: 'Hoodie', color: 'Black', size: 'L', quantity: 1 }],
            'ORD-PG-1'
        );

        const insertQuery = queries.find(q => q.sql.includes('INSERT INTO inventory_reservations'));
        expect(insertQuery).toBeDefined();
        expect(insertQuery.sql).toContain("INTERVAL '10 minutes'");
    });
});
