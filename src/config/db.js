import dotenv from 'dotenv';

dotenv.config();

const USE_POSTGRES = Boolean(process.env.DATABASE_URL);
let db;

function getPostgresSSLConfig() {
    if (process.env.PG_SSL === 'false') return false;

    const rejectUnauthorized = process.env.PG_SSL_REJECT_UNAUTHORIZED !== 'false';
    return { rejectUnauthorized };
}

async function getDB() {
    if (db) return db;

    if (USE_POSTGRES) {
        const { default: pkg } = await import('pg');
        const { Pool } = pkg;

        db = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: getPostgresSSLConfig(),
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000
        });

        const client = await db.connect();
        try {
            const result = await client.query('SELECT NOW()');
            console.log('✅ PostgreSQL connected successfully at', result.rows[0].now);
        } finally {
            client.release();
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

export async function query(sql, params = []) {
    try {
        if (!/^\s*(SELECT|INSERT|UPDATE|DELETE)\s/i.test(sql)) {
            throw new Error('Invalid query type');
        }

        if (USE_POSTGRES) return dbInstance.query(sql, params);

        const sqliteSql = sql.replace(/\$\d+/g, '?');
        const placeholderCount = (sqliteSql.match(/\?/g) || []).length;

        if (placeholderCount !== params.length) {
            console.error('[DB ERROR] Parameter mismatch:', {
                sql,
                sqliteSql,
                paramsCount: params.length,
                placeholderCount
            });
            throw new Error(`Parameter mismatch: expected ${placeholderCount}, got ${params.length}`);
        }

        const stmt = dbInstance.prepare(sqliteSql);
        if (sqliteSql.trim().toLowerCase().startsWith('select')) {
            return { rows: stmt.all(...params) };
        }

        return stmt.run(...params);
    } catch (error) {
        console.error('[DB ERROR] Query failed:', sql.substring(0, 100), 'Error:', error.message);
        throw error;
    }
}
