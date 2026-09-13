import crypto from 'crypto';
import { query, USE_POSTGRES } from '../config/db.js';
import { APIError } from '../middleware/errorHandler.js';
import { initializeTransaction } from './paymentService.js';

async function getCheckoutSettings() {
    const result = await query(
        "SELECT key, value FROM settings WHERE key IN ('standardShippingRate', 'expressShippingRate', 'freeShippingThreshold')"
    );
    const settings = Object.fromEntries(result.rows.map(row => [row.key, Number(row.value)]));

    return {
        standardShippingRate: settings.standardShippingRate || 10000,
        expressShippingRate: settings.expressShippingRate || 25000,
        freeShippingThreshold: settings.freeShippingThreshold || 150000
    };
}

async function countCompletedCouponUses(couponId, customerEmail = null) {
    let sql = `
        SELECT COUNT(*) AS count
        FROM coupon_usage cu
        JOIN orders o ON o.id = cu.order_id
        WHERE cu.coupon_id = $1
          AND (o.payment_method <> 'paystack' OR o.payment_status = 'paid')
    `;
    const params = [couponId];

    if (customerEmail) {
        sql += ' AND cu.customer_email = $2';
        params.push(customerEmail);
    }

    const result = await query(sql, params);
    return Number(result.rows[0]?.count || 0);
}

async function getValidCoupon(discountCode, subtotal, customerEmail) {
    if (!discountCode) return null;

    const isActive = USE_POSTGRES ? true : 1;
    const result = await query(
        'SELECT * FROM coupons WHERE code = $1 AND is_active = $2',
        [String(discountCode).trim().toUpperCase(), isActive]
    );
    const coupon = result.rows[0];
    if (!coupon) throw new APIError('Invalid coupon code.', 400, 'INVALID_COUPON');

    const now = new Date();
    if (coupon.start_date && new Date(coupon.start_date) > now) {
        throw new APIError('Coupon is not yet active.', 400, 'INVALID_COUPON');
    }
    if (coupon.end_date && new Date(coupon.end_date) < now) {
        throw new APIError('Coupon has expired.', 400, 'INVALID_COUPON');
    }
    if (subtotal < Number(coupon.min_order_amount || 0)) {
        throw new APIError('Order does not meet the coupon minimum.', 400, 'INVALID_COUPON');
    }

    if (coupon.usage_limit) {
        const completedUses = await countCompletedCouponUses(coupon.id);
        if (completedUses >= Number(coupon.usage_limit)) {
            throw new APIError('Coupon usage limit has been reached.', 400, 'INVALID_COUPON');
        }
    }

    if (coupon.per_customer_limit) {
        const customerUses = await countCompletedCouponUses(coupon.id, customerEmail);
        if (customerUses >= Number(coupon.per_customer_limit)) {
            throw new APIError(
                'Coupon usage limit reached for this customer.',
                400,
                'INVALID_COUPON'
            );
        }
    }

    return coupon;
}

function calculateCouponDiscount(coupon, subtotal) {
    if (!coupon || coupon.type === 'free_shipping') return 0;

    let discount =
        coupon.type === 'percentage'
            ? Math.round(subtotal * (Number(coupon.value) / 100))
            : Number(coupon.value);

    if (coupon.max_discount_amount) {
        discount = Math.min(discount, Number(coupon.max_discount_amount));
    }

    return Math.max(0, Math.min(discount, subtotal));
}

async function rollbackCreatedOrder(orderId, couponId, couponCountIncremented, inventoryService) {
    await inventoryService.cancelReservation(orderId).catch(() => {});
    await query('DELETE FROM coupon_usage WHERE order_id = $1', [orderId]).catch(() => {});

    if (couponId && couponCountIncremented) {
        await query(
            'UPDATE coupons SET usage_count = CASE WHEN usage_count > 0 THEN usage_count - 1 ELSE 0 END WHERE id = $1',
            [couponId]
        ).catch(() => {});
    }

    await query('DELETE FROM orders WHERE id = $1', [orderId]).catch(() => {});
}

export async function createOrder(orderData, productService, inventoryService, origin) {
    const orderId = `LV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const {
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        items,
        total: requestTotal,
        paymentMethod,
        discountCode,
        notes,
        shippingMethod = 'standard'
    } = orderData;

    let calculatedSubtotal = 0;
    const validatedItems = [];

    for (const item of items) {
        const product = await productService.getById(item.id);
        if (!product) {
            throw new APIError(`Product not found: ${item.id}`, 400, 'INVALID_PRODUCT');
        }

        const quantity = Number(item.quantity);
        calculatedSubtotal += Number(product.price) * quantity;
        validatedItems.push({
            id: product.id,
            name: product.name,
            price: Number(product.price),
            quantity,
            color: item.color,
            size: item.size,
            image: item.image || product.images?.[0]?.src || ''
        });
    }

    const settings = await getCheckoutSettings();
    const normalizedShippingMethod = shippingMethod === 'express' ? 'express' : 'standard';
    const coupon = await getValidCoupon(discountCode, calculatedSubtotal, customerEmail);
    const calculatedDiscount = calculateCouponDiscount(coupon, calculatedSubtotal);

    let calculatedShipping;
    if (coupon?.type === 'free_shipping') {
        calculatedShipping = 0;
    } else if (normalizedShippingMethod === 'express') {
        calculatedShipping = settings.expressShippingRate;
    } else {
        calculatedShipping =
            calculatedSubtotal >= settings.freeShippingThreshold
                ? 0
                : settings.standardShippingRate;
    }

    const calculatedTotal = Math.max(
        0,
        calculatedSubtotal + calculatedShipping - calculatedDiscount
    );
    if (Number(requestTotal) !== calculatedTotal) {
        throw new APIError(
            'Price mismatch detected. Please refresh checkout.',
            400,
            'PRICE_MISMATCH'
        );
    }

    let couponCountIncremented = false;

    try {
        await inventoryService.reserveItems(validatedItems, orderId);

        await query(
            `INSERT INTO orders (
                id, customer_name, customer_email, customer_phone, shipping_address,
                items, subtotal, shipping_cost, discount, total, payment_method, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
                orderId,
                customerName,
                customerEmail,
                customerPhone,
                JSON.stringify(shippingAddress),
                JSON.stringify(validatedItems),
                calculatedSubtotal,
                calculatedShipping,
                calculatedDiscount,
                calculatedTotal,
                paymentMethod,
                notes || ''
            ]
        );

        if (coupon) {
            await query(
                'INSERT INTO coupon_usage (coupon_id, order_id, customer_email, discount_amount) VALUES ($1, $2, $3, $4)',
                [coupon.id, orderId, customerEmail, calculatedDiscount]
            );
        }

        let paystackData = null;
        if (paymentMethod === 'paystack') {
            paystackData = await initializeTransaction(
                orderId,
                customerEmail,
                calculatedTotal,
                origin
            );
        } else {
            await inventoryService.confirmReservation(orderId);
            if (coupon) {
                await query(
                    'UPDATE coupons SET usage_count = usage_count + 1 WHERE id = $1',
                    [coupon.id]
                );
                couponCountIncremented = true;
            }
        }

        return {
            orderId,
            paystack: paystackData,
            totals: {
                subtotal: calculatedSubtotal,
                shipping: calculatedShipping,
                discount: calculatedDiscount,
                total: calculatedTotal
            }
        };
    } catch (error) {
        await rollbackCreatedOrder(
            orderId,
            coupon?.id || null,
            couponCountIncremented,
            inventoryService
        );
        throw error;
    }
}

export async function lookupOrder(orderId, email) {
    const order = (
        await query(
            'SELECT * FROM orders WHERE id = $1 AND customer_email = $2',
            [orderId, email]
        )
    ).rows[0];

    if (!order) throw new APIError('Order not found.', 404, 'ORDER_NOT_FOUND');

    return {
        ...order,
        items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
        shippingAddress:
            typeof order.shipping_address === 'string'
                ? JSON.parse(order.shipping_address)
                : order.shipping_address
    };
}
