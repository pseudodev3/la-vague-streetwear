import express from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler, APIError } from '../middleware/errorHandler.js';
import { csrfProtection } from '../middleware/csrf.js';
import { validateCreateOrder } from '../middleware/validation.js';
import { createOrder, lookupOrder } from '../services/orderService.js';
import {
    markOrderPaid,
    verifyTransaction,
    transactionMatchesOrder
} from '../services/paymentService.js';
import { query, USE_POSTGRES } from '../config/db.js';
import { sendOrderConfirmation, isEmailConfigured } from '../../email-templates/index.js';

const router = express.Router();

const orderLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { success: false, error: 'Too many orders, please try again later.' }
});

const lookupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, error: 'Too many lookup attempts, please try again later.' }
});

const EMAIL_ENABLED = process.env.EMAIL_TEST_MODE !== 'true' && isEmailConfigured();
const EMAIL_TEST_MODE = process.env.EMAIL_TEST_MODE === 'true';

async function sendOrderConfirmationSafely(order) {
    if (EMAIL_TEST_MODE) {
        console.log('[EMAIL TEST MODE] Would send confirmation email:', {
            to: order.customer_email || order.customerEmail,
            orderId: order.id
        });
        return { success: true, testMode: true };
    }

    if (!EMAIL_ENABLED) return { success: false, reason: 'email_not_configured' };

    try {
        await sendOrderConfirmation(order);
        return { success: true };
    } catch (error) {
        console.error('[EMAIL] Failed to send:', error.message);
        return { success: false, error: error.message };
    }
}

export default function orderRoutes(productService, inventoryService) {
    router.post(
        '/',
        orderLimiter,
        csrfProtection,
        validateCreateOrder,
        asyncHandler(async (req, res) => {
            const result = await createOrder(
                req.body,
                productService,
                inventoryService,
                req.headers.origin
            );
            res.json({ success: true, ...result });
        })
    );

    router.post(
        '/lookup',
        lookupLimiter,
        asyncHandler(async (req, res) => {
            const { orderId, email } = req.body;
            const order = await lookupOrder(orderId, email);
            res.json({ success: true, order });
        })
    );

    router.post(
        '/validate-coupon',
        orderLimiter,
        csrfProtection,
        asyncHandler(async (req, res) => {
            const { code, cartTotal } = req.body;
            if (!code || !Number.isFinite(Number(cartTotal))) {
                throw new APIError('Coupon code and cart total are required', 400);
            }

            const isActive = USE_POSTGRES ? true : 1;
            const result = await query(
                'SELECT * FROM coupons WHERE code = $1 AND is_active = $2',
                [String(code).trim().toUpperCase(), isActive]
            );

            if (result.rows.length === 0) {
                return res.status(400).json({ valid: false, error: 'Invalid coupon code' });
            }

            const coupon = result.rows[0];
            const numericCartTotal = Number(cartTotal);

            if (coupon.usage_limit && Number(coupon.usage_count) >= Number(coupon.usage_limit)) {
                return res.status(400).json({
                    valid: false,
                    error: 'Coupon usage limit has been reached'
                });
            }

            const now = new Date();
            if (coupon.start_date && new Date(coupon.start_date) > now) {
                return res.status(400).json({ valid: false, error: 'Coupon is not yet active' });
            }
            if (coupon.end_date && new Date(coupon.end_date) < now) {
                return res.status(400).json({ valid: false, error: 'Coupon has expired' });
            }

            if (numericCartTotal < Number(coupon.min_order_amount || 0)) {
                return res.status(400).json({
                    valid: false,
                    error: `Minimum order amount is ₦${Number(coupon.min_order_amount).toLocaleString()}`
                });
            }

            let discount = 0;
            if (coupon.type === 'percentage') {
                discount = Math.round(numericCartTotal * (Number(coupon.value) / 100));
            } else if (coupon.type !== 'free_shipping') {
                discount = Number(coupon.value) || 0;
            }

            if (coupon.max_discount_amount) {
                discount = Math.min(discount, Number(coupon.max_discount_amount));
            }

            res.json({
                valid: true,
                coupon: {
                    id: coupon.id,
                    code: coupon.code,
                    type: coupon.type,
                    discount: Math.max(0, discount)
                }
            });
        })
    );

    router.post(
        '/verify-payment',
        orderLimiter,
        csrfProtection,
        asyncHandler(async (req, res) => {
            const { orderId, reference } = req.body;
            if (!orderId) throw new APIError('Order ID is required', 400);

            const orderResult = await query('SELECT * FROM orders WHERE id = $1', [orderId]);
            const order = orderResult.rows[0];
            if (!order) throw new APIError('Order not found', 404);

            if (!process.env.PAYSTACK_SECRET_KEY) {
                return res.json({
                    success: true,
                    status: order.payment_status,
                    orderId: order.id,
                    verified: false,
                    message: 'Paystack not configured'
                });
            }

            const paystackRef = reference || order.payment_reference || String(order.id);
            if (
                order.payment_reference &&
                paystackRef !== order.payment_reference &&
                paystackRef !== String(order.id)
            ) {
                throw new APIError(
                    'Payment reference does not belong to this order',
                    400,
                    'PAYMENT_MISMATCH'
                );
            }

            let transaction;
            try {
                transaction = await verifyTransaction(paystackRef);
            } catch (error) {
                console.error('[PAYMENT VERIFY] Paystack verification failed:', error.message);
                throw new APIError(
                    'Payment verification failed',
                    502,
                    'PAYMENT_VERIFY_ERROR'
                );
            }

            if (!transactionMatchesOrder(transaction, order)) {
                throw new APIError(
                    'Payment details do not match this order',
                    400,
                    'PAYMENT_MISMATCH'
                );
            }

            const result = await markOrderPaid(
                order,
                transaction.reference,
                inventoryService
            );

            if (result.transitioned) {
                await sendOrderConfirmationSafely({
                    ...order,
                    items: result.items,
                    shipping_address: result.shippingAddress,
                    payment_status: 'paid',
                    payment_reference: transaction.reference
                });
            }

            return res.json({
                success: true,
                status: 'paid',
                orderId: order.id,
                verified: true
            });
        })
    );

    return router;
}
