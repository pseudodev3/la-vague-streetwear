import dotenv from 'dotenv';

dotenv.config();

const USE_POSTGRES = !!process.env.DATABASE_URL;

let db;

async function getDB() {
    if (db) return db;

    if (USE_POSTGRES) {
        const { default: pkg } = await import('pg');
        const { Pool } = pkg;
        db = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
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
