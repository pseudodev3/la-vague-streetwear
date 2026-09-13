import crypto from 'crypto';
import Paystack from 'paystack-api';
import { query } from '../config/db.js';
import { logWebhookEvent } from '../utils/audit.js';
import { sendOrderConfirmation, isEmailConfigured } from '../../email-templates/index.js';
import { captureException, captureMessage } from '../config/sentry.js';

const secretKey = process.env.PAYSTACK_SECRET_KEY;
const paystack = secretKey ? Paystack(secretKey) : null;

const EMAIL_ENABLED = process.env.EMAIL_TEST_MODE !== 'true' && isEmailConfigured();
const EMAIL_TEST_MODE = process.env.EMAIL_TEST_MODE === 'true';

async function sendOrderEmailSafely(order) {
    if (EMAIL_TEST_MODE) {
        console.log('[EMAIL TEST MODE] Would send email:', {
            to: order.customer_email || order.customerEmail,
            type: 'confirmation',
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

function parseOrderItems(order) {
    return typeof order.items === 'string' ? JSON.parse(order.items) : order.items || [];
}

function parseShippingAddress(order) {
    return typeof order.shipping_address === 'string'
        ? JSON.parse(order.shipping_address)
        : order.shipping_address || {};
}

function affectedRows(result) {
    return Number(result?.rowCount ?? result?.changes ?? 0);
}

export function verifyPaystackSignature(body, signature) {
    if (!secretKey || !signature) return false;

    const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
    const hash = crypto.createHmac('sha512', secretKey).update(payload).digest('hex');

    const expected = Buffer.from(hash, 'utf8');
    const received = Buffer.from(String(signature), 'utf8');
    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

export async function verifyTransaction(reference) {
    if (!secretKey) throw new Error('Paystack not configured');
    if (!reference) throw new Error('Payment reference is required');

    const response = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: { Authorization: `Bearer ${secretKey}` } }
    );
    const payload = await response.json();

    if (!response.ok || !payload?.status || !payload?.data) {
        throw new Error(payload?.message || 'Unable to verify Paystack transaction');
    }

    return payload.data;
}

export function transactionMatchesOrder(transaction, order) {
    if (!transaction || !order) return false;

    const expectedAmount = Math.round(Number(order.total) * 100);
    const paidAmount = Number(transaction.amount);
    const metadataOrderId = transaction.metadata?.order_id;
    const referenceMatches =
        transaction.reference === order.payment_reference ||
        transaction.reference === String(order.id);
    const metadataMatches =
        !metadataOrderId || String(metadataOrderId) === String(order.id);
    const amountMatches = Number.isFinite(expectedAmount) && paidAmount === expectedAmount;
    const currencyMatches = String(transaction.currency || '').toUpperCase() === 'NGN';

    return (
        transaction.status === 'success' &&
        referenceMatches &&
        metadataMatches &&
        amountMatches &&
        currencyMatches
    );
}

export async function finalizeInventoryForPayment(order, inventoryService) {
    const items = parseOrderItems(order);
    let confirmation = await inventoryService.confirmReservation(order.id);

    if (confirmation?.alreadyConfirmed && order.payment_status !== 'paid') {
        await inventoryService.reserveItems(items, order.id);
        confirmation = await inventoryService.confirmReservation(order.id);
    }

    return { items, confirmation };
}

export async function markOrderPaid(order, reference, inventoryService) {
    const { items } = await finalizeInventoryForPayment(order, inventoryService);

    const updateResult = await query(
        `UPDATE orders
         SET payment_status = 'paid',
             payment_reference = $1,
             order_status = CASE WHEN order_status = 'pending' THEN 'processing' ELSE order_status END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND payment_status <> 'paid'`,
        [reference, order.id]
    );

    const transitioned = affectedRows(updateResult) > 0;

    if (transitioned && order.payment_method === 'paystack') {
        await query(
            `UPDATE coupons
             SET usage_count = usage_count + 1
             WHERE id IN (
                 SELECT coupon_id FROM coupon_usage WHERE order_id = $1
             )`,
            [order.id]
        );
    }

    return {
        transitioned,
        items,
        shippingAddress: parseShippingAddress(order)
    };
}

export async function processWebhook(event, inventoryService) {
    const eventType = event?.event;
    const data = event?.data;

    if (!eventType || !data) throw new Error('Invalid Paystack webhook payload');

    await logWebhookEvent(eventType, data);

    switch (eventType) {
        case 'charge.success':
            await handleChargeSuccess(data, inventoryService);
            break;
        case 'charge.failed':
            await handleChargeFailed(data, inventoryService);
            break;
        case 'refund.processed':
            await handleRefundProcessed(data);
            break;
        default:
            break;
    }
}

async function findOrderForTransaction(reference, metadataOrderId) {
    if (metadataOrderId) {
        const byId = await query('SELECT * FROM orders WHERE id = $1', [metadataOrderId]);
        if (byId.rows.length > 0) return byId.rows[0];
    }

    const byReference = await query(
        'SELECT * FROM orders WHERE payment_reference = $1',
        [reference]
    );
    return byReference.rows[0] || null;
}

async function handleChargeSuccess(data, inventoryService) {
    const { reference, amount, metadata } = data;
    const order = await findOrderForTransaction(reference, metadata?.order_id);

    if (!order) {
        captureMessage(`Payment received but order not found: ${reference}`, {
            level: 'warning',
            extra: { reference, amount }
        });
        return;
    }

    if (!transactionMatchesOrder(data, order)) {
        captureMessage(`Rejected mismatched payment for order ${order.id}`, {
            level: 'warning',
            extra: {
                orderId: order.id,
                reference,
                expectedAmount: Math.round(Number(order.total) * 100),
                paidAmount: amount,
                currency: data.currency,
                metadataOrderId: metadata?.order_id
            }
        });
        return;
    }

    try {
        const result = await markOrderPaid(order, reference, inventoryService);

        if (result.transitioned) {
            await sendOrderEmailSafely({
                ...order,
                items: result.items,
                shipping_address: result.shippingAddress,
                payment_status: 'paid',
                payment_reference: reference
            });
            captureMessage(`Payment confirmed for order ${order.id}`, { level: 'info' });
        }
    } catch (error) {
        captureException(error, { extra: { orderId: order.id, reference } });
        throw error;
    }
}

async function handleChargeFailed(data, inventoryService) {
    const { reference, metadata } = data;
    const order = await findOrderForTransaction(reference, metadata?.order_id);
    if (!order || order.payment_status === 'paid') return;

    await query(
        "UPDATE orders SET payment_status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND payment_status <> 'paid'",
        [order.id]
    );
    await inventoryService.cancelReservation(order.id);
}

async function handleRefundProcessed(data) {
    const { reference, transaction_reference } = data;
    const orderResult = await query(
        'SELECT * FROM orders WHERE payment_reference = $1',
        [transaction_reference]
    );
    if (orderResult.rows.length === 0) return;
    const order = orderResult.rows[0];

    await query(
        `UPDATE orders
         SET order_status = 'refunded',
             notes = COALESCE(notes, '') || ' | Refund processed: ' || $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [reference, order.id]
    );
}

export async function initializeTransaction(orderId, email, amount, origin) {
    if (!paystack) throw new Error('Paystack not configured');

    const amountInKobo = Math.round(Number(amount) * 100);
    if (!Number.isSafeInteger(amountInKobo) || amountInKobo <= 0) {
        throw new Error('Invalid transaction amount');
    }

    const frontendOrigin = process.env.FRONTEND_URL || origin;
    if (!frontendOrigin) throw new Error('Frontend URL is not configured');

    const paystackResponse = await paystack.transaction.initialize({
        email,
        amount: amountInKobo,
        currency: 'NGN',
        reference: String(orderId),
        callback_url: `${frontendOrigin.replace(/\/$/, '')}/order-confirmation?order=${encodeURIComponent(orderId)}&status=success`,
        metadata: {
            order_id: orderId,
            custom_fields: [
                { display_name: 'Order ID', variable_name: 'order_id', value: orderId }
            ]
        }
    });

    if (paystackResponse?.status && paystackResponse?.data?.reference) {
        await query('UPDATE orders SET payment_reference = $1 WHERE id = $2', [
            paystackResponse.data.reference,
            orderId
        ]);
        return {
            access_code: paystackResponse.data.access_code,
            authorization_url: paystackResponse.data.authorization_url,
            publicKey: process.env.PAYSTACK_PUBLIC_KEY
        };
    }

    throw new Error(paystackResponse?.message || 'Paystack initialization failed');
}
