import express from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../middleware/errorHandler.js';
import { query } from '../config/db.js';
import { validateContactForm } from '../middleware/validation.js';
import { sendContactNotification } from '../../email-templates/index.js';

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
    res.json({
        success: true,
        publicKey: publicKey,
        configured: true,
        testMode: publicKey.startsWith('pk_test_')
    });
});

router.get('/settings', asyncHandler(async (req, res) => {
    const result = await query('SELECT * FROM settings');
    const settings = {};
    result.rows.forEach(row => { settings[row.key] = row.value; });
    
    res.json({
        success: true,
        settings: {
            shippingRate: parseInt(settings.standardShippingRate) || 10000,
            expressShippingRate: parseInt(settings.expressShippingRate) || 25000,
            freeShippingThreshold: parseInt(settings.freeShippingThreshold) || 150000,
            storeName: settings.storeName || 'LA VAGUE'
        }
    });
}));

const DEFAULT_RATES = { USD: 1, NGN: 1550, EUR: 0.94, GBP: 0.80 };

router.get('/currency-rates', asyncHandler(async (req, res) => {
    let rates = { ...DEFAULT_RATES };
    const result = await query("SELECT value FROM settings WHERE key = 'currency_rates'");
    if (result.rows.length > 0) rates = JSON.parse(result.rows[0].value);
    
    res.json({ success: true, rates, baseCurrency: 'USD', lastUpdated: new Date().toISOString() });
}));

router.post('/contact', contactLimiter, validateContactForm, asyncHandler(async (req, res) => {
    const { name, email, subject, message } = req.body;
    await sendContactNotification({ name, email, subject, message });
    res.json({ success: true, message: 'Message sent successfully' });
}));

export default router;
