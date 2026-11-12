import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Exercise the real SQLite driver without opening the developer's database file.
vi.mock('better-sqlite3', async importOriginal => {
    const { default: Database } = await importOriginal();
    return { default: class extends Database {
        constructor() { super(':memory:'); }
    } };
});
vi.mock('dotenv', () => ({ default: { config() {} } }));

let db;
let query;

beforeAll(async () => {
    vi.stubEnv('DATABASE_URL', '');
    ({ db, query } = await import('../../src/config/db.js'));
    db.exec('CREATE TABLE products (id TEXT PRIMARY KEY, slug TEXT, name TEXT)');
});

beforeEach(() => {
    db.exec('DELETE FROM products');
    db.prepare('INSERT INTO products VALUES (?, ?, ?)').run('lv-hoodie-001', 'classic-hoodie', 'Hoodie');
});

afterAll(() => {
    db.close();
    vi.unstubAllEnvs();
});

describe('SQLite query parameters', () => {
    it('reuses a numbered parameter for product lookup by slug or ID', async () => {
        const sql = 'SELECT name FROM products WHERE slug = $1 OR id = $1';
        expect((await query(sql, ['classic-hoodie'])).rows).toEqual([{ name: 'Hoodie' }]);
        expect((await query(sql, ['lv-hoodie-001'])).rows).toEqual([{ name: 'Hoodie' }]);
    });

    it('binds reordered parameters by their number', async () => {
        const result = await query('SELECT $2 AS second, $1 AS first, $2 AS repeated', ['one', 'two']);
        expect(result.rows).toEqual([{ second: 'two', first: 'one', repeated: 'two' }]);
    });

    it('uses the same binding behavior for writes', async () => {
        const result = await query('UPDATE products SET name = $2 WHERE id = $1 OR slug = $1', ['lv-hoodie-001', 'Updated']);
        expect(result.changes).toBe(1);
        expect(db.prepare('SELECT name FROM products').get()).toEqual({ name: 'Updated' });
    });

    it('continues to support anonymous SQLite parameters', async () => {
        expect((await query('SELECT name FROM products WHERE id = ? AND slug = ?', ['lv-hoodie-001', 'classic-hoodie'])).rows)
            .toEqual([{ name: 'Hoodie' }]);
    });

    it('ignores parameter-like text in SQL literals and comments', async () => {
        const result = await query("SELECT '? $2' AS literal, $1 AS value /* $3 ? */ -- $4 ?", ['bound']);
        expect(result.rows).toEqual([{ literal: '? $2', value: 'bound' }]);
    });

    it('keeps values containing SQL syntax parameterized', async () => {
        expect((await query('SELECT name FROM products WHERE slug = $1 OR id = $1', ["' OR 1=1 --"])).rows).toEqual([]);
    });

    it('rejects missing or extra values', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        await expect(query('SELECT $2 AS value', ['one'])).rejects.toThrow('expected 2, got 1');
        await expect(query('SELECT $1 AS value', ['one', 'two'])).rejects.toThrow('expected 1, got 2');
        await expect(query('SELECT ? AS value', [])).rejects.toThrow('expected 1, got 0');
    });
});
