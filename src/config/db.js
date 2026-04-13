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

        // Determine the correct path to ca.pem (project root)
        const caPath = path.join(__dirname, '../../ca.pem');

        let sslConfig;
        if (fs.existsSync(caPath)) {
            try {
                const caContent = fs.readFileSync(caPath).toString();
                sslConfig = {
                    ca: caContent,
                    rejectUnauthorized: true, // Enforce proper validation
                };
                console.log('✅ Using Aiven CA certificate (secure SSL)');
            } catch (err) {
                console.warn('⚠️ CA certificate file exists but could not be read:', err.message);
                sslConfig = { rejectUnauthorized: false };
            }
        } else {
            console.warn('⚠️ CA certificate not found. Using rejectUnauthorized: false (INSECURE – for development only)');
            sslConfig = { rejectUnauthorized: false };
        }

        db = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: sslConfig,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        // Test connection on startup
        try {
            const client = await db.connect();
            const res = await client.query('SELECT NOW()');
            client.release();
            console.log('✅ PostgreSQL connected successfully at', res.rows[0].now);
        } catch (err) {
            console.error('❌ PostgreSQL connection failed:', err.message);
            throw err;
        }
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
