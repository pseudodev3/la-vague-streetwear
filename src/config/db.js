import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USE_POSTGRES = !!process.env.DATABASE_URL;

let db;

async function getDB() {
    if (db) return db;

    if (USE_POSTGRES) {
        const { default: pkg } = await import('pg');
        const { Pool } = pkg;

        // Build SSL configuration
        let sslConfig = { rejectUnauthorized: false }; // fallback
        const caPath = path.join(__dirname, '../../ca.pem'); // adjust path if needed

        if (fs.existsSync(caPath)) {
            try {
                sslConfig = {
                    ca: fs.readFileSync(caPath).toString(),
                };
                console.log('✅ Using Aiven CA certificate for secure connection');
            } catch (err) {
                console.warn('⚠️ CA certificate found but could not be read, falling back to rejectUnauthorized: false');
            }
        } else {
            console.warn('⚠️ CA certificate not found. Using rejectUnauthorized: false (INSECURE – for development only)');
        }

        db = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: sslConfig,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
        console.log('✅ Using PostgreSQL database');
    } else {
        const { default: Database } = await import('better-sqlite3');
        db = new Database('database.sqlite');
        console.log('✅ Using SQLite database (local)');
    }
    return db;
}

const dbInstance = await getDB();

export { dbInstance as db, USE_POSTGRES };

/**
 * Secure database query helper with SQL injection protection
 */
export async function query(sql, params = []) {
    try {
        if (!/^\s*(SELECT|INSERT|UPDATE|DELETE)\s/i.test(sql)) {
            throw new Error('Invalid query type');
        }

        if (USE_POSTGRES) {
            const result = await dbInstance.query(sql, params);
            return result;
        } else {
            const placeholderCount = (sql.match(/\?/g) || []).length;
            if (placeholderCount !== params.length) {
                throw new Error(`Parameter mismatch: expected ${placeholderCount}, got ${params.length}`);
            }

            const stmt = dbInstance.prepare(sql);
            if (sql.trim().toLowerCase().startsWith('select')) {
                // Heuristic to decide between get() and all()
                if (sql.includes('LIMIT 1') || (sql.includes('WHERE') && sql.includes('= ?') && !sql.includes('IN'))) {
                    const res = stmt.get(...params);
                    return { rows: res ? [res] : [] };
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
