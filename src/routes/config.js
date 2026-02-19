import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { query } from '../config/db.js';

const router = express.Router();

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

export default router;
