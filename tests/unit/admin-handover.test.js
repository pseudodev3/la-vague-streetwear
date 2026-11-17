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
vi.mock('../../email-templates/index.js', () => ({
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
    sendReviewConfirmationEmail: vi.fn(async () => {}),
    sendNewReviewNotification: vi.fn(async () => {}),
    sendContactNotification: vi.fn(async () => {}),
    emailService: {}
}));
vi.mock('../../src/utils/audit.js', () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock('../../src/services/cloudinary.js', () => ({
    uploadImage: vi.fn(async () => ({ secure_url: 'stub' })),
    deleteImage: vi.fn(async () => {})
}));

let db;
let server;
let base;

beforeAll(async () => {
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('ADMIN_PASSWORD', 'initial-setup-password-123');
    ({ db } = await import('../../src/config/db.js'));

    db.exec(`
        CREATE TABLE settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE admin_sessions (
            session_key TEXT PRIMARY KEY,
            expires_at TEXT NOT NULL,
            session_generation INTEGER NOT NULL DEFAULT 1
        );
    `);

    const express = (await import('express')).default;
    const cookieParser = (await import('cookie-parser')).default;
    const { globalErrorHandler, notFoundHandler } = await import('../../src/middleware/errorHandler.js');
    const adminRouterFactory = (await import('../../src/routes/admin.js')).default;
    const configRouter = (await import('../../src/routes/config.js')).default;

    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/admin', adminRouterFactory({}, {}));
    app.use('/api/config', configRouter);
    app.use(notFoundHandler);
    app.use(globalErrorHandler);

    server = app.listen(0);
    const { port } = server.address();
    base = `http://127.0.0.1:${port}`;
});

afterAll(() => {
    server?.close();
});

function extractSessionCookie(res) {
    const setCookie = res.headers.get('set-cookie') || '';
    const match = setCookie.match(/la_vague_admin_session=([a-f0-9]{64})/);
    return match ? `la_vague_admin_session=${match[1]}` : '';
}

describe('Admin handover & launch countdown', () => {
    it('allows initial login, rotates to owner password, disables setup password, and revokes other sessions', async () => {
        // Two sessions sign in with initial setup password
        const login1 = await fetch(`${base}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: 'initial-setup-password-123' })
        });
        expect(login1.status).toBe(200);
        const cookie1 = extractSessionCookie(login1);
        expect(cookie1).not.toBe('');

        const login2 = await fetch(`${base}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: 'initial-setup-password-123' })
        });
        expect(login2.status).toBe(200);
        const cookie2 = extractSessionCookie(login2);

        // Session reports customPasswordConfigured = false initially
        const sessBefore = await fetch(`${base}/api/admin/session`, {
            headers: { Cookie: cookie1 }
        });
        expect((await sessBefore.json()).customPasswordConfigured).toBe(false);

        // Rejects wrong current password
        const wrongCurrent = await fetch(`${base}/api/admin/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie1 },
            body: JSON.stringify({
                currentPassword: 'wrong-password',
                newPassword: 'owner-private-password-999'
            })
        });
        expect(wrongCurrent.status).toBe(401);

        // Owner rotates password
        const changeRes = await fetch(`${base}/api/admin/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie1 },
            body: JSON.stringify({
                currentPassword: 'initial-setup-password-123',
                newPassword: 'owner-private-password-999'
            })
        });
        expect(changeRes.status).toBe(200);

        // Current session stays valid and reports customPasswordConfigured = true
        const sessAfter = await fetch(`${base}/api/admin/session`, {
            headers: { Cookie: cookie1 }
        });
        expect(sessAfter.status).toBe(200);
        expect((await sessAfter.json()).customPasswordConfigured).toBe(true);

        // Other session (developer's) is revoked
        const otherSess = await fetch(`${base}/api/admin/session`, {
            headers: { Cookie: cookie2 }
        });
        expect(otherSess.status).toBe(401);

        // Initial setup password no longer works
        const oldLogin = await fetch(`${base}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: 'initial-setup-password-123' })
        });
        expect(oldLogin.status).toBe(401);

        // New owner password works
        const newLogin = await fetch(`${base}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: 'owner-private-password-999' })
        });
        expect(newLogin.status).toBe(200);

        // GET /admin/settings does not leak admin_password_hash
        const settingsRes = await fetch(`${base}/api/admin/settings`, {
            headers: { Cookie: cookie1 }
        });
        const settingsData = await settingsRes.json();
        expect(settingsData.settings.admin_password_hash).toBeUndefined();
    });

    it('exposes launchCountdown in /api/config/settings and persists admin updates', async () => {
        const defaultRes = await fetch(`${base}/api/config/settings`);
        expect(defaultRes.status).toBe(200);
        const defaultData = await defaultRes.json();
        expect(defaultData.settings.launchCountdown.enabled).toBe(true);
        expect(defaultData.settings.launchCountdown.title).toBe('DROP 001 LAUNCHES IN');

        const login = await fetch(`${base}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: 'owner-private-password-999' })
        });
        const cookie = extractSessionCookie(login);

        const updateRes = await fetch(`${base}/api/admin/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({
                settings: {
                    launchCountdownEnabled: 'true',
                    launchCountdownTitle: 'CAPSULE 02 DROPS IN',
                    launchCountdownTarget: '2027-01-15T18:00:00.000Z'
                }
            })
        });
        expect(updateRes.status).toBe(200);

        const updatedRes = await fetch(`${base}/api/config/settings`);
        const updatedData = await updatedRes.json();
        expect(updatedData.settings.launchCountdown).toEqual({
            enabled: true,
            title: 'CAPSULE 02 DROPS IN',
            targetDate: '2027-01-15T18:00:00.000Z'
        });
    });
});
