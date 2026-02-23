import express from 'express';
import { asyncHandler, APIError } from '../middleware/errorHandler.js';
import { csrfProtection } from '../middleware/csrf.js';
import { validateCreateOrder } from '../middleware/validation.js';
import { createOrder, lookupOrder } from '../services/orderService.js';
import { query, USE_POSTGRES } from '../config/db.js';
import rateLimit from 'express-rate-limit';

import { sendOrderConfirmation, sendOrderStatusUpdate, isEmailConfigured } from '../../email-templates/index.js';

const router = express.Router();

const orderLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { success: false, error: 'Too many orders, please try again later.' }
});

const safeParseJSON = (str, defaultValue = null) => {
    if (!str || str === 'null' || str === 'undefined') return defaultValue;
    try { return JSON.parse(str); } catch (e) { return defaultValue; }
};

const EMAIL_ENABLED = process.env.EMAIL_TEST_MODE !== 'true' && isEmailConfigured();
const EMAIL_TEST_MODE = process.env.EMAIL_TEST_MODE === 'true';

async function sendOrderEmailSafely(order, type = 'confirmation', status = null) {
    if (EMAIL_TEST_MODE) {
        console.log('[EMAIL TEST MODE] Would send email:', { to: order.customer_email || order.customerEmail, type, status, orderId: order.id });
        return { success: true, testMode: true };
    }
    if (!EMAIL_ENABLED) return { success: false, reason: 'email_not_configured' };
    try {
        if (type === 'confirmation') await sendOrderConfirmation(order);
        else if (type === 'status_update') await sendOrderStatusUpdate(order, status);
        return { success: true };
    } catch (error) {
        console.error('[EMAIL] Failed to send:', error.message);
        return { success: false, error: error.message };
    }
}

export default function(productService, inventoryService) {
    router.post('/', orderLimiter, csrfProtection, validateCreateOrder, asyncHandler(async (req, res) => {
        const result = await createOrder(req.body, productService, inventoryService, req.headers.origin);
        res.json({ success: true, ...result });
    }));

    router.post('/lookup', asyncHandler(async (req, res) => {
        const { orderId, email } = req.body;
        const order = await lookupOrder(orderId, email);
        res.json({ success: true, order });
    }));

    router.post('/validate-coupon', csrfProtection, asyncHandler(async (req, res) => {
        const { code, cartTotal, customerEmail } = req.body;
        const result = await query('SELECT * FROM coupons WHERE code = $1 AND is_active = true', [code.toUpperCase()]);
        if (result.rows.length === 0) return res.status(400).json({ valid: false, error: 'Invalid coupon code' });
        
        const coupon = result.rows[0];
        
        // Check Usage Limit
        if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
            return res.status(400).json({ valid: false, error: 'Coupon usage limit has been reached' });
        }

        // Check Dates
        const now = new Date();
        if (coupon.start_date && new Date(coupon.start_date) > now) {
            return res.status(400).json({ valid: false, error: 'Coupon is not yet active' });
        }
        if (coupon.end_date && new Date(coupon.end_date) < now) {
            return res.status(400).json({ valid: false, error: 'Coupon has expired' });
        }

        if (cartTotal < coupon.min_order_amount) return res.status(400).json({ valid: false, error: `Minimum order amount is ₦${coupon.min_order_amount.toLocaleString()}` });
        
        let discount = coupon.type === 'percentage' ? Math.round(cartTotal * (coupon.value / 100)) : coupon.value;
        if (coupon.max_discount_amount && discount > coupon.max_discount_amount) discount = coupon.max_discount_amount;
        
        res.json({ valid: true, coupon: { id: coupon.id, code: coupon.code, type: coupon.type, discount } });
    }));

    // Explicitly add /api/coupons/validate for backward compatibility if needed, 
    // though the above handles it within the order router scope.


    router.post('/verify-payment', orderLimiter, csrfProtection, asyncHandler(async (req, res) => {
        const { orderId, reference } = req.body;
        if (!orderId && !reference) throw new APIError('Order ID or payment reference is required', 400);
        
        let order;
        if (reference) order = (await query('SELECT * FROM orders WHERE payment_reference = $1 OR id = $2', [reference, orderId || ''])).rows[0];
        else order = (await query('SELECT * FROM orders WHERE id = $1', [orderId])).rows[0];
        
        if (!order) throw new APIError('Order not found', 404);
        if (order.payment_status === 'paid') return res.json({ success: true, status: 'paid', orderId: order.id, message: 'Payment confirmed' });
        
        if (!process.env.PAYSTACK_SECRET_KEY) return res.json({ success: true, status: order.payment_status, orderId: order.id, verified: false, message: 'Paystack not configured' });
        
        try {
            const paystackRef = reference || order.payment_reference;
            if (!paystackRef) return res.json({ success: true, status: order.payment_status, orderId: order.id, verified: false, message: 'No reference' });
            
            const response = await fetch(`https://api.paystack.co/transaction/verify/${paystackRef}`, {
                headers: { 'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
            });
            const paystackData = await response.json();
            
            if (!paystackData.status) return res.json({ success: false, status: order.payment_status, orderId: order.id, verified: false, message: paystackData.message });
            
            if (paystackData.data.status === 'success') {
                await query('UPDATE orders SET payment_status = \'paid\', payment_reference = $1, order_status = CASE WHEN order_status = \'pending\' THEN \'processing\' ELSE order_status END, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [paystackRef, order.id]);
                const items = safeParseJSON(order.items, []);
                await inventoryService.confirmReservation(order.id, items);
                await sendOrderEmailSafely({ ...order, payment_status: 'paid' }, 'confirmation');
                return res.json({ success: true, status: 'paid', orderId: order.id, verified: true });
            }
            res.json({ success: true, status: paystackData.data.status, orderId: order.id, verified: false });
        } catch (error) {
            throw new APIError('Verification failed', 500);
        }
    }));

    return router;
}
