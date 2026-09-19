import dotenv from 'dotenv';

dotenv.config();

const USE_POSTGRES = Boolean(process.env.DATABASE_URL);
let db;

function getPostgresSSLConfig() {
    if (process.env.PG_SSL === 'false') return false;

    const rejectUnauthorized = process.env.PG_SSL_REJECT_UNAUTHORIZED !== 'false';
    return { rejectUnauthorized };
}

function readPositiveInt(name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
    const parsed = Number.parseInt(process.env[name] || '', 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function verifyPostgresConnection(pool) {
    const maxAttempts = readPositiveInt('PG_CONNECT_RETRIES', 6, { max: 12 });
    const baseDelayMs = readPositiveInt('PG_CONNECT_RETRY_BASE_MS', 2000, { max: 30000 });

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        let client;

        try {
            client = await pool.connect();
            const result = await client.query('SELECT NOW()');
            console.log(
                `✅ PostgreSQL connected successfully at ${result.rows[0].now} (attempt ${attempt}/${maxAttempts})`
            );
            return;
        } catch (error) {
            if (client) {
                client.release(error);
                client = null;
            }

            console.error(
                `[DB] PostgreSQL connection attempt ${attempt}/${maxAttempts} failed: ${error.message}`
            );

            if (attempt === maxAttempts) throw error;

            const delayMs = Math.min(baseDelayMs * 2 ** (attempt - 1), 10000);
            await sleep(delayMs);
        } finally {
            if (client) client.release();
        }
    }
}

async function getDB() {
    if (db) return db;

    if (USE_POSTGRES) {
        const { default: pkg } = await import('pg');
        const { Pool } = pkg;

        db = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: getPostgresSSLConfig(),
            max: readPositiveInt('PG_POOL_MAX', 10, { max: 50 }),
            idleTimeoutMillis: readPositiveInt('PG_IDLE_TIMEOUT_MS', 30000, { max: 300000 }),
            connectionTimeoutMillis: readPositiveInt('PG_CONNECTION_TIMEOUT_MS', 10000, { max: 60000 })
        });

        // node-postgres emits idle-client failures on the Pool. Without a listener,
        // EventEmitter treats the error as uncaught and can terminate the process.
        db.on('error', error => {
            console.error('[DB POOL] Unexpected idle PostgreSQL client error:', error.message);
        });

        await verifyPostgresConnection(db);
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
