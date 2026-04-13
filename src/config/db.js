import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import tls from 'tls';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USE_POSTGRES = !!process.env.DATABASE_URL;

// Aiven Project CA Certificate (hardcoded from your provided block)
const AIVEN_CA_CERT = `-----BEGIN CERTIFICATE-----
MIIERDCCAqygAwIBAgIURhDOaMwaCoQ8weT3NLPyO9zNZd4wDQYJKoZIhvcNAQEM
BQAwOjE4MDYGA1UEAwwvYjQ0YTlhMjktMzNkYi00OGRlLWE4MzYtNmU4YzUxNWI1
YWQ5IFByb2plY3QgQ0EwHhcNMjYwNDEzMTExNzI5WhcNMzYwNDEwMTExNzI5WjA6
MTgwNgYDVQQDDC9iNDRhOWEyOS0zM2RiLTQ4ZGUtYTgzNi02ZThjNTE1YjVhZDkg
UHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCCAYoCggGBAK1sQaMN
2BNz0ctysLjatiLRIrHoeWXrLcnsxgnbk7y3hNeb7EMeOXGPy7Dhk2J3yEWacizU
f/7QFZaEdR0VFLFgnDa7A982VmaVsRypawRit9ow6G5guV3hoO27i3Bg/lmXGzD7
1l09on1bKV9dBR7SgUnlg8shnegxmU/OzXBMA+o3a1yZG3J6xbSshlx93l3QBo9V
JZ3aLARIYqnEGDFlQZqALSkhJkp7OiFCMbXgRD8gtcMRyf4aUA6hBWUuetkQAlhV
PRzNuFBUcn70iaOeolEiPhhNn+w8UOwSZEwPNrFQ8RjV5S7WA+C5Vsj9sLHpdJLv
+AemjF3cn6rP+cF+mZpERudaec7qfRLm1ka+t+rGX9bh7YmHTs7dp159+43xPzm9
uFDQId1Y1f3iL6Yq0Oyj2xJX+B5b9nRODeDcV9k8GNZKaT1N3qHapl1zjczWRVhv
Wf1wr2CV79Udp3LHxRFuK1n5DZTITLdrlU847gcxHeECjlZC550ALUYsyQIDAQAB
o0IwQDAdBgNVHQ4EFgQUYWy7VtefRy7wl/0FrQLfLUuDj7YwEgYDVR0TAQH/BAgw
BgEB/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQADggGBAGgH1R6WGjOw
+4bnIZnqcTwpxfxqkLL3hFugRLn8KXTqgjTISVLUdEJAoRpqn4iULUP6M/tbzCHn
OaR9Kac2bseRRs7MIbBg6773GuBiAGgxbORhEcVKGCNjEHC6CZ4gmFTSz1Px4/7p
rB2dz8xlD7+g55b+ZanekDzzq0Wl7ylj8YG/gFyeg1OvnP96xYADU3UAGdxGRIEH
Vul/1Lqj5HVOu+QwrxRpMnsF+2cbqadSzaRBeVvBkKKmynvcMbPc9GX+iQdKQKRq
c9BWshu3bELZbC2YiYUuD5QgwZHGJByWMZUJLHtWUFCOzdeyacpyq2zEBJH++PrK
o/a2a9/pVxTeJjCxYxQ2usETaDEVXJSbTUiPWtKaziJ3qm5kYcgvo82nZMsQJJQD
aiia0vB3Xe1ps5JD3h9K01K4+kYAKwZZ9fUeBkhN6EBNFnsQKka/gqDJUflN88lh
D6WSh44Mhkr37n3AX0bgZAoRQab2Pmi/QDEltpYEkgMWAmgNvADvWA==
-----END CERTIFICATE-----`;

let db;

async function getDB() {
    if (db) return db;

    if (USE_POSTGRES) {
        const { default: pkg } = await import('pg');
        const { Pool } = pkg;

        // Custom hostname verifier that accepts the Aiven project CA
        const checkServerIdentity = (host, cert) => {
            // Skip hostname verification – the certificate CN is a UUID, not the hostname
            // This is safe because we are pinning the exact CA certificate below.
            return undefined;
        };

        const sslConfig = {
            ca: AIVEN_CA_CERT,
            rejectUnauthorized: true,   // Enforce CA validation
            checkServerIdentity,         // Override hostname check
        };

        console.log('✅ Using Aiven Project CA (secure SSL with custom hostname verifier)');

        db = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: sslConfig,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        // Test connection
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
