import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { getActiveAnnouncement, validateAnnouncementSettings } from '../../src/utils/announcements.js';

const queryMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/config/db.js', () => ({ query: queryMock, db: {}, USE_POSTGRES: false }));
vi.mock('../../email-templates/index.js', () => ({
    ...Object.fromEntries([
        'sendContactNotification', 'sendOrderConfirmation', 'sendOrderStatusUpdate',
        'previewEmail', 'testEmailConfig', 'getEmailQueueStats', 'getEmailConfig',
        'sendReviewConfirmationEmail', 'sendNewReviewNotification', 'sendTestEmail'
    ].map(name => [name, vi.fn()])),
    isEmailConfigured: () => false
}));

const now = Date.parse('2026-11-12T12:00:00Z');
const campaign = {
    announcementEnabled: 'true',
    announcementMessage: 'New collection lands today',
    announcementStartsAt: '2026-11-12T11:00:00Z',
    announcementEndsAt: '2026-11-12T13:00:00Z'
};

describe('announcement scheduling', () => {
    it('publishes an active campaign with normalized timestamps', () => {
        expect(getActiveAnnouncement(campaign, now)).toEqual({
            message: campaign.announcementMessage,
            startsAt: '2026-11-12T11:00:00.000Z',
            endsAt: '2026-11-12T13:00:00.000Z'
        });
    });

    it.each([
        ['disabled', { announcementEnabled: 'false' }],
        ['scheduled', { announcementStartsAt: '2026-11-12T12:30:00Z' }],
        ['expired', { announcementEndsAt: '2026-11-12T12:00:00Z' }],
        ['missing an end', { announcementEndsAt: '' }],
        ['missing a message', { announcementMessage: '  ' }],
        ['invalid', { announcementEndsAt: 'not-a-date' }]
    ])('does not publish a %s campaign', (_name, overrides) => {
        expect(getActiveAnnouncement({ ...campaign, ...overrides }, now)).toBeNull();
    });

    it('starts at the exact scheduled time and ends at the exact deadline', () => {
        expect(getActiveAnnouncement(campaign, Date.parse(campaign.announcementStartsAt))).not.toBeNull();
        expect(getActiveAnnouncement(campaign, Date.parse(campaign.announcementEndsAt))).toBeNull();
    });

    it('requires a future deadline when enabling a campaign', () => {
        expect(() => validateAnnouncementSettings({ ...campaign, announcementEndsAt: '2026-11-12T11:30:00Z' }, now))
            .toThrow('future');
        expect(() => validateAnnouncementSettings({ ...campaign, announcementEndsAt: '' }, now))
            .toThrow('end date');
    });

    it('allows disabling an expired campaign without erasing its draft', () => {
        const expired = { ...campaign, announcementEnabled: 'false', announcementEndsAt: '2026-11-12T11:30:00Z' };
        expect(validateAnnouncementSettings(expired, now).announcementEnabled).toBe('false');
    });

    it('rejects invalid calendar dates, reversed schedules and oversized copy', () => {
        expect(() => validateAnnouncementSettings({ ...campaign, announcementEndsAt: '2027-02-30T12:00:00Z' }, now)).toThrow('valid date');
        expect(() => validateAnnouncementSettings({ ...campaign, announcementStartsAt: campaign.announcementEndsAt }, now)).toThrow('after');
        expect(() => validateAnnouncementSettings({ ...campaign, announcementMessage: 'x'.repeat(81) }, now)).toThrow('80');
        expect(() => validateAnnouncementSettings({ ...campaign, announcementEnabled: 'yes' }, now)).toThrow('true or false');
    });

    it('requires an explicit timezone and normalizes timezone offsets', () => {
        expect(() => validateAnnouncementSettings({ ...campaign, announcementEndsAt: '2026-11-12T13:00' }, now)).toThrow('timezone');
        expect(validateAnnouncementSettings({ ...campaign, announcementEndsAt: '2026-11-12T14:00:00+01:00' }, now).announcementEndsAt)
            .toBe('2026-11-12T13:00:00.000Z');
    });

    it('leaves announcement copy as plain text for the browser to render safely', () => {
        const message = '<img src=x onerror=alert(1)>';
        expect(getActiveAnnouncement({ ...campaign, announcementMessage: message }, now).message).toBe(message);
    });
});

describe('public announcement settings API', () => {
    let server;
    let baseURL;

    beforeAll(async () => {
        const { default: router } = await import('../../src/routes/config.js');
        const app = express();
        app.use('/api/config', router);
        await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
        baseURL = `http://127.0.0.1:${server.address().port}/api/config/settings`;
    });

    afterAll(async () => {
        await new Promise(resolve => server.close(resolve));
    });

    const setSettings = settings => queryMock.mockResolvedValue({ rows: Object.entries(settings).map(([key, value]) => ({ key, value })) });

    it('returns active copy without exposing arbitrary admin settings', async () => {
        const deadline = new Date(Date.now() + 60000).toISOString();
        setSettings({ ...campaign, announcementStartsAt: '', announcementEndsAt: deadline, supportEmail: 'internal@example.com' });
        const response = await fetch(baseURL);
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('no-store');
        const { settings } = await response.json();
        expect(settings.announcement).toEqual({ message: campaign.announcementMessage, startsAt: '', endsAt: deadline });
        expect(settings.supportEmail).toBeUndefined();
    });

    it('omits expired announcements and preserves a zero free-shipping threshold', async () => {
        setSettings({ ...campaign, announcementEndsAt: '2020-01-01T00:00:00Z', announcementStartsAt: '', freeShippingThreshold: '0' });
        const { settings } = await (await fetch(baseURL)).json();
        expect(settings.announcement).toBeNull();
        expect(settings.freeShippingThreshold).toBe(0);
    });
});

describe('protected announcement settings updates', () => {
    let server;
    let baseURL;
    let saved;
    const session = 'b'.repeat(64);
    const csrf = 'a'.repeat(64);

    beforeAll(async () => {
        const [{ default: adminRouter }, { default: configRouter }, { globalErrorHandler }] = await Promise.all([
            import('../../src/routes/admin.js'),
            import('../../src/routes/config.js'),
            import('../../src/middleware/errorHandler.js')
        ]);
        const app = express();
        app.use(express.json(), cookieParser());
        app.use('/api/admin', adminRouter({}, {}));
        app.use('/api/config', configRouter);
        app.use(globalErrorHandler);
        await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
        baseURL = `http://127.0.0.1:${server.address().port}`;
    });

    beforeEach(() => {
        saved = new Map([['storeName', 'LA VAGUE'], ['announcementEnabled', 'false']]);
        queryMock.mockImplementation(async (sql, params) => {
            if (sql.includes('FROM admin_sessions')) return { rows: [{ session_key: session }] };
            if (sql === 'SELECT * FROM settings') return { rows: [...saved].map(([key, value]) => ({ key, value })) };
            if (sql.startsWith('INSERT OR REPLACE INTO settings')) {
                saved.set(params[0], params[1]);
                return { changes: 1 };
            }
            throw new Error(`Unexpected query in settings API test: ${sql}`);
        });
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterAll(async () => {
        await new Promise(resolve => server.close(resolve));
    });

    const update = (settings, headers = {}) => fetch(`${baseURL}/api/admin/settings`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            cookie: `la_vague_admin_session=${session}; csrf_token=${csrf}`,
            'x-csrf-token': csrf,
            ...headers
        },
        body: JSON.stringify({ settings })
    });

    it('rejects invalid campaigns before writing any general or campaign settings', async () => {
        const response = await update({ storeName: 'Should not save', announcementEnabled: 'true', announcementMessage: 'A launch', announcementEndsAt: '' });
        expect(response.status).toBe(400);
        expect((await response.json()).code).toBe('VALIDATION_ERROR');
        expect([...saved]).toEqual([['storeName', 'LA VAGUE'], ['announcementEnabled', 'false']]);
    });

    it('persists valid campaigns and merges partial edits with their existing schedule', async () => {
        const endsAt = new Date(Date.now() + 60000).toISOString();
        const response = await update({ ...campaign, announcementStartsAt: '', announcementEndsAt: endsAt });
        expect(response.status).toBe(200);
        expect(saved.get('announcementEndsAt')).toBe(endsAt);
        expect((await update({ announcementMessage: 'Updated launch copy' })).status).toBe(200);
        expect(saved.get('announcementEndsAt')).toBe(endsAt);
        const { settings } = await (await fetch(`${baseURL}/api/config/settings`)).json();
        expect(settings.announcement).toEqual({ message: 'Updated launch copy', startsAt: '', endsAt });
    });

    it('allows an expired campaign to be disabled without changing its draft', async () => {
        Object.entries({ ...campaign, announcementStartsAt: '', announcementEndsAt: '2020-01-01T00:00:00Z' }).forEach(([key, value]) => saved.set(key, value));
        expect((await update({ announcementEnabled: 'false' })).status).toBe(200);
        expect(saved.get('announcementMessage')).toBe(campaign.announcementMessage);
        expect(saved.get('announcementEnabled')).toBe('false');
    });

    it('rejects malformed settings and retains admin authentication and CSRF protection', async () => {
        expect((await update([])).status).toBe(400);
        expect((await update({ announcementEnabled: 'false' }, { cookie: `csrf_token=${csrf}` })).status).toBe(401);
        expect((await update({ announcementEnabled: 'false' }, { 'x-csrf-token': '' })).status).toBe(403);
        expect([...saved]).toHaveLength(2);
    });
});
