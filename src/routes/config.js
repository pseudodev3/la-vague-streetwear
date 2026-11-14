import express from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../middleware/errorHandler.js';
import { query } from '../config/db.js';
import { validateContactForm } from '../middleware/validation.js';
import { sendContactNotification } from '../../email-templates/index.js';
import { getActiveAnnouncement } from '../utils/announcements.js';

const router = express.Router();

const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { success: false, error: 'Too many messages, please try again later.', code: 'RATE_LIMIT' }
});

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
                announcement: getActiveAnnouncement(settings)
            }
        });
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
