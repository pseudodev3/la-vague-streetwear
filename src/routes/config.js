import crypto from 'crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../middleware/errorHandler.js';
import { csrfProtection } from '../middleware/csrf.js';
import { query } from '../config/db.js';
import { validateContactForm } from '../middleware/validation.js';
import { sendContactNotification } from '../../email-templates/index.js';
import { getActiveAnnouncement } from '../utils/announcements.js';

const router = express.Router();

const PRELAUNCH_COOKIE = 'la_vague_prelaunch_access';
const DEFAULT_LAUNCH_TARGET = '2026-12-01T12:00:00+01:00';

const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { success: false, error: 'Too many messages, please try again later.', code: 'RATE_LIMIT' }
});

const prelaunchLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    skipSuccessfulRequests: true,
    message: { success: false, error: 'Too many access attempts, please try again later.', code: 'RATE_LIMIT' }
});

function getPrelaunchSecret() {
    const seed = process.env.PRELAUNCH_COOKIE_SECRET || process.env.ADMIN_PASSWORD || process.env.DATABASE_URL || 'la-vague-prelaunch-secret';
    return crypto.createHash('sha256').update(`prelaunch:${seed}`).digest();
}

function isPrelaunchLocked(settings) {
    if (settings.prelaunchLockEnabled !== 'true') return false;
    const targetMs = new Date(settings.launchCountdownTarget || DEFAULT_LAUNCH_TARGET).getTime();
    return Number.isFinite(targetMs) && targetMs > Date.now();
}

function signPrelaunchToken(version) {
    const payload = `v${version || '1'}`;
    const sig = crypto.createHmac('sha256', getPrelaunchSecret()).update(payload).digest('hex');
    return `${payload}.${sig}`;
}

function hasValidPrelaunchCookie(req, settings) {
    const raw = req.cookies?.[PRELAUNCH_COOKIE];
    if (typeof raw !== 'string' || !raw.includes('.')) return false;
    const expected = signPrelaunchToken(settings.prelaunch_password_version || '1');
    const a = Buffer.from(raw);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifyPrelaunchPassword(candidate, settings) {
    if (typeof candidate !== 'string' || !candidate) return false;
    const storedRaw = settings.prelaunch_password_hash;
    if (storedRaw) {
        try {
            const parsed = JSON.parse(storedRaw);
            if (parsed && typeof parsed.salt === 'string' && typeof parsed.hash === 'string') {
                const expected = Buffer.from(parsed.hash, 'hex');
                const derived = crypto.scryptSync(candidate, parsed.salt, 64);
                return expected.length === derived.length && crypto.timingSafeEqual(derived, expected);
            }
        } catch {
            return false;
        }
    }
    const envPass = process.env.PRELAUNCH_PASSWORD;
    if (!envPass) return false;
    const a = crypto.createHash('sha256').update(candidate).digest();
    const b = crypto.createHash('sha256').update(envPass).digest();
    return crypto.timingSafeEqual(a, b);
}

router.get('/paystack', (req, res) => {
    const publicKey = process.env.PAYSTACK_PUBLIC_KEY;
    if (!publicKey) {
        return res.status(503).json({ success: false, error: 'Paystack not configured', configured: false });
    }
    // Only the public key is needed by the checkout flow. Previously this also
    // returned `testMode` derived from the key prefix, which leaked whether the
    // store is running on test keys to any anonymous visitor. The frontend
    // never consumed that flag, so it is dropped here.
    res.json({
        success: true,
        publicKey: publicKey,
        configured: true
    });
});

router.get(
    '/settings',
    asyncHandler(async (req, res) => {
        const result = await query('SELECT * FROM settings');
        const settings = {};
        result.rows.forEach(row => {
            settings[row.key] = row.value;
        });

        const amount = (value, fallback) => {
            const parsed = Number.parseInt(value, 10);
            return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
        };
        res.set('Cache-Control', 'no-store');
        res.json({
            success: true,
            settings: {
                shippingRate: amount(settings.standardShippingRate, 10000),
                expressShippingRate: amount(settings.expressShippingRate, 25000),
                freeShippingThreshold: amount(settings.freeShippingThreshold, 150000),
                storeName: settings.storeName || 'LA VAGUE',
                announcement: getActiveAnnouncement(settings),
                launchCountdown: {
                    enabled: settings.launchCountdownEnabled !== 'false',
                    title: settings.launchCountdownTitle || 'WEBSITE LAUNCHES IN',
                    targetDate: settings.launchCountdownTarget || DEFAULT_LAUNCH_TARGET,
                    lockEnabled: isPrelaunchLocked(settings),
                    unlocked: !isPrelaunchLocked(settings) || hasValidPrelaunchCookie(req, settings)
                }
            }
        });
    })
);

router.post(
    '/prelaunch-unlock',
    csrfProtection,
    prelaunchLimiter,
    asyncHandler(async (req, res) => {
        const { password } = req.body || {};
        const result = await query('SELECT * FROM settings');
        const settings = {};
        result.rows.forEach(row => {
            settings[row.key] = row.value;
        });

        if (!isPrelaunchLocked(settings)) {
            return res.json({ success: true, unlocked: true });
        }

        if (!verifyPrelaunchPassword(password, settings)) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
            return res.status(401).json({ success: false, error: 'Invalid access password' });
        }

        const token = signPrelaunchToken(settings.prelaunch_password_version || '1');
        res.cookie(PRELAUNCH_COOKIE, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/'
        });
        res.json({ success: true, unlocked: true });
    })
);

router.post(
    '/contact',
    contactLimiter,
    validateContactForm,
    asyncHandler(async (req, res) => {
        const { name, email, subject, message } = req.body;
        await sendContactNotification({ name, email, subject, message });
        res.json({ success: true, message: 'Message sent successfully' });
    })
);

export default router;
