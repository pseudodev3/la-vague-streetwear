import crypto from 'crypto';
import { db, query, USE_POSTGRES } from '../config/db.js';
import { APIError } from '../middleware/errorHandler.js';
import { initializeTransaction } from './paymentService.js';

export async function createOrder(orderData, productService, inventoryService, origin) {
    const orderId = 'LV-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const { 
        customerName, customerEmail, customerPhone, shippingAddress, items, 
        subtotal: requestSubtotal, shippingCost, discount: requestDiscount,
        total: requestTotal, paymentMethod, discountCode, notes
    } = orderData;

    let calculatedSubtotal = 0;
    const validatedItems = [];

    for (const item of items) {
        const product = await productService.getById(item.id);
        if (!product) throw new APIError(`Product not found: ${item.name}`, 400, 'INVALID_PRODUCT');
        
        calculatedSubtotal += product.price * item.quantity;
        validatedItems.push({ ...item, price: product.price, name: product.name });
    }

    let calculatedDiscount = 0;
    if (discountCode) {
        const coupon = (await query('SELECT * FROM coupons WHERE code = $1 AND is_active = true', [discountCode.toUpperCase()])).rows[0];
        if (coupon) {
            const now = new Date();
            const isWithinDates = (!coupon.start_date || new Date(coupon.start_date) <= now) && 
                                 (!coupon.end_date || new Date(coupon.end_date) >= now);
            const isUnderLimit = !coupon.usage_limit || coupon.usage_count < coupon.usage_limit;

            if (isWithinDates && isUnderLimit) {
                calculatedDiscount = coupon.type === 'percentage' 
                    ? Math.round(calculatedSubtotal * (coupon.value / 100)) 
                    : coupon.value;
                
                if (coupon.max_discount_amount && calculatedDiscount > coupon.max_discount_amount) {
                    calculatedDiscount = coupon.max_discount_amount;
                }
            }
        }
    }

    const calculatedTotal = calculatedSubtotal + shippingCost - calculatedDiscount;
    if (Math.abs(calculatedTotal - requestTotal) > 100) {
        throw new APIError('Price mismatch detected.', 400, 'PRICE_MISMATCH');
    }

    try {
        await inventoryService.reserveItems(items, orderId);
        
        const shippingAddressStr = JSON.stringify(shippingAddress);
        const itemsStr = JSON.stringify(validatedItems);

        await query(`
            INSERT INTO orders (id, customer_name, customer_email, customer_phone, shipping_address, 
                items, subtotal, shipping_cost, discount, total, payment_method, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [orderId, customerName, customerEmail, customerPhone, shippingAddressStr,
            itemsStr, calculatedSubtotal, shippingCost, calculatedDiscount, calculatedTotal, paymentMethod, notes || '']);
        
        if (discountCode && calculatedDiscount > 0) {
            const coupon = (await query('SELECT id FROM coupons WHERE code = $1', [discountCode.toUpperCase()])).rows[0];
            if (coupon) {
                await query('UPDATE coupons SET usage_count = usage_count + 1 WHERE id = $1', [coupon.id]);
                await query('INSERT INTO coupon_usage (coupon_id, order_id, customer_email, discount_amount) VALUES ($1, $2, $3, $4)', 
                    [coupon.id, orderId, customerEmail, calculatedDiscount]);
            }
        }

        await inventoryService.confirmReservation(orderId, items);

        let paystackData = null;
        if (paymentMethod === 'paystack') {
            paystackData = await initializeTransaction(orderId, customerEmail, calculatedTotal, origin);
        }

        return { orderId, paystack: paystackData };
    } catch (error) {
        await inventoryService.cancelReservation(orderId);
        throw error;
    }
}

export async function lookupOrder(orderId, email) {
    const order = (await query('SELECT * FROM orders WHERE id = $1 AND customer_email = $2', [orderId, email])).rows[0];
    if (!order) throw new APIError('Order not found.', 404, 'ORDER_NOT_FOUND');
    
    return {
        ...order,
        items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
        shippingAddress: typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : order.shipping_address
    };
}
