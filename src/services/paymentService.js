import crypto from 'crypto';
import Paystack from 'paystack-api';
import { query, USE_POSTGRES } from '../config/db.js';
import { logWebhookEvent } from '../utils/audit.js';
import { sendOrderConfirmation } from '../../email-templates/index.js';
import { captureException, captureMessage } from '../config/sentry.js';

const secretKey = process.env.PAYSTACK_SECRET_KEY;
const paystack = secretKey ? Paystack(secretKey) : null;

export function verifyPaystackSignature(body, signature) {
    if (!secretKey) return false;
    const hash = crypto.createHmac('sha512', secretKey).update(body).digest('hex');
    return hash === signature;
}

export async function processWebhook(event, inventoryService) {
    const eventType = event.event;
    const data = event.data;
    
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
    }
}

async function handleChargeSuccess(data, inventoryService) {
    const { reference, amount, metadata } = data;
    const orderResult = await query(
        'SELECT * FROM orders WHERE payment_reference = $1 OR id = $2',
        [reference, metadata?.order_id || '']
    );
    
    if (orderResult.rows.length === 0) {
        captureMessage(`Payment received but order not found: ${reference}`, { level: 'warning', extra: { reference, amount } });
        return;
    }
    
    const order = orderResult.rows[0];
    if (order.payment_status === 'paid') return;

    try {
        await query(`
            UPDATE orders 
            SET payment_status = 'paid', 
                payment_reference = $1,
                order_status = CASE WHEN order_status = 'pending' THEN 'processing' ELSE order_status END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [reference, order.id]);
        
        const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        const shippingAddress = typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : order.shipping_address;

        await sendOrderConfirmation({
            ...order,
            items,
            shipping_address: shippingAddress,
            payment_status: 'paid'
        });
        
        await inventoryService.confirmReservation(order.id, items);
        captureMessage(`Payment confirmed for order ${order.id}`, { level: 'info' });
    } catch (error) {
        captureException(error, { extra: { orderId: order.id, reference } });
        throw error;
    }
}

async function handleChargeFailed(data, inventoryService) {
    const { reference, metadata } = data;
    const orderResult = await query('SELECT * FROM orders WHERE payment_reference = $1 OR id = $2', [reference, metadata?.order_id || '']);
    if (orderResult.rows.length === 0) return;
    const order = orderResult.rows[0];
    
    await query('UPDATE orders SET payment_status = "failed", updated_at = CURRENT_TIMESTAMP WHERE id = $1', [order.id]);
    await inventoryService.cancelReservation(order.id);
}

async function handleRefundProcessed(data) {
    const { reference, transaction_reference } = data;
    const orderResult = await query('SELECT * FROM orders WHERE payment_reference = $1', [transaction_reference]);
    if (orderResult.rows.length === 0) return;
    const order = orderResult.rows[0];
    
    await query(`
        UPDATE orders 
        SET order_status = 'refunded', 
            notes = COALESCE(notes, '') || ' | Refund processed: ' || $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
    `, [reference, order.id]);
}

export async function initializeTransaction(orderId, email, amount, origin) {
    if (!paystack) throw new Error('Paystack not configured');
    
    const amountInKobo = Math.round(amount * 100);
    const paystackResponse = await paystack.transaction.initialize({
        email,
        amount: amountInKobo,
        reference: orderId,
        callback_url: `${process.env.FRONTEND_URL || origin}/order-confirmation?order=${orderId}&status=success`,
        metadata: {
            order_id: orderId,
            custom_fields: [{ display_name: "Order ID", variable_name: "order_id", value: orderId }]
        }
    });

    if (paystackResponse && paystackResponse.status) {
        await query('UPDATE orders SET payment_reference = $1 WHERE id = $2', [paystackResponse.data.reference, orderId]);
        return {
            access_code: paystackResponse.data.access_code,
            authorization_url: paystackResponse.data.authorization_url,
            publicKey: process.env.PAYSTACK_PUBLIC_KEY
        };
    }
    throw new Error(paystackResponse?.message || 'Paystack initialization failed');
}
