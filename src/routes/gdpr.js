import express from 'express';
import { asyncHandler, APIError } from '../middleware/errorHandler.js';
import { query } from '../config/db.js';

const router = express.Router();

/**
 * Export all personal data for a customer (Right to Data Portability)
 */
router.post('/export', asyncHandler(async (req, res) => {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
        throw new APIError('Valid email is required', 400, 'VALIDATION_ERROR');
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    
    const exportData = {
        exportDate: new Date().toISOString(),
        customerEmail: normalizedEmail,
        data: {}
    };
    
    const ordersResult = await query(
        'SELECT * FROM orders WHERE customer_email = $1 ORDER BY created_at DESC',
        [normalizedEmail]
    );
    exportData.data.orders = ordersResult.rows.map(order => ({
        orderId: order.id,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        customerPhone: order.customer_phone,
        shippingAddress: typeof order.shipping_address === 'string' 
            ? JSON.parse(order.shipping_address) 
            : order.shipping_address,
        items: typeof order.items === 'string' 
            ? JSON.parse(order.items) 
            : order.items,
        subtotal: order.subtotal,
        shippingCost: order.shipping_cost,
        discount: order.discount,
        total: order.total,
        paymentMethod: order.payment_method,
        paymentStatus: order.payment_status,
        paymentReference: order.payment_reference,
        orderStatus: order.order_status,
        notes: order.notes,
        createdAt: order.created_at,
        updatedAt: order.updated_at
    }));
    
    const reviewsResult = await query(
        'SELECT * FROM reviews WHERE customer_email = $1 ORDER BY created_at DESC',
        [normalizedEmail]
    );
    exportData.data.reviews = reviewsResult.rows.map(review => ({
        reviewId: review.id,
        productId: review.product_id,
        customerName: review.customer_name,
        customerEmail: review.customer_email,
        rating: review.rating,
        title: review.title,
        content: review.content,
        verified: review.verified_purchase,
        status: review.status,
        adminResponse: review.admin_response,
        createdAt: review.created_at,
        updatedAt: review.updated_at
    }));
    
    const waitlistResult = await query(
        'SELECT * FROM waitlist WHERE customer_email = $1 ORDER BY created_at DESC',
        [normalizedEmail]
    );
    exportData.data.waitlist = waitlistResult.rows.map(entry => ({
        entryId: entry.id,
        productId: entry.product_id,
        customerEmail: entry.customer_email,
        customerName: entry.customer_name,
        status: entry.status,
        createdAt: entry.created_at
    }));
    
    const couponUsageResult = await query(
        'SELECT cu.*, c.code as coupon_code FROM coupon_usage cu JOIN coupons c ON cu.coupon_id = c.id WHERE cu.customer_email = $1 ORDER BY cu.used_at DESC',
        [normalizedEmail]
    );
    exportData.data.couponUsage = couponUsageResult.rows.map(usage => ({
        usageId: usage.id,
        couponCode: usage.coupon_code,
        orderId: usage.order_id,
        customerEmail: usage.customer_email,
        discountAmount: usage.discount_amount,
        createdAt: usage.used_at
    }));
    
    exportData.summary = {
        totalOrders: exportData.data.orders.length,
        totalReviews: exportData.data.reviews.length,
        totalWaitlistEntries: exportData.data.waitlist.length,
        totalCouponUsages: exportData.data.couponUsage.length
    };
    
    console.log(`[GDPR] Data export requested for: ${normalizedEmail}`);
    
    res.json({
        success: true,
        message: 'Personal data export completed',
        export: exportData
    });
}));

/**
 * Delete all personal data for a customer (Right to be Forgotten)
 */
router.post('/delete', asyncHandler(async (req, res) => {
    const { email, confirm } = req.body;
    
    if (!email || !email.includes('@')) {
        throw new APIError('Valid email is required', 400, 'VALIDATION_ERROR');
    }
    
    if (!confirm) {
        throw new APIError('Confirmation required. Set confirm: true to proceed with deletion.', 400, 'CONFIRMATION_REQUIRED');
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    
    const ordersResult = await query('SELECT COUNT(*) as count FROM orders WHERE customer_email = $1', [normalizedEmail]);
    const reviewsResult = await query('SELECT COUNT(*) as count FROM reviews WHERE customer_email = $1', [normalizedEmail]);
    const waitlistResult = await query('SELECT COUNT(*) as count FROM waitlist WHERE customer_email = $1', [normalizedEmail]);
    const couponUsageResult = await query('SELECT COUNT(*) as count FROM coupon_usage WHERE customer_email = $1', [normalizedEmail]);
    
    const stats = {
        ordersToAnonymize: parseInt(ordersResult.rows[0]?.count || 0),
        reviewsToDelete: parseInt(reviewsResult.rows[0]?.count || 0),
        waitlistToDelete: parseInt(waitlistResult.rows[0]?.count || 0),
        couponUsageToKeep: parseInt(couponUsageResult.rows[0]?.count || 0)
    };
    
    const anonymizedEmail = `deleted_${Date.now()}@anonymized.local`;
    const anonymizedName = 'Deleted Customer';
    const anonymizedPhone = null;
    const anonymizedAddress = JSON.stringify({
        address: 'Deleted', city: 'Deleted', state: 'Deleted', zip: '00000', country: 'Deleted'
    });
    
    if (stats.ordersToAnonymize > 0) {
        await query(
            `UPDATE orders SET customer_name = $1, customer_email = $2, customer_phone = $3, shipping_address = $4, notes = CASE WHEN notes IS NOT NULL THEN '[Redacted]' ELSE NULL END WHERE customer_email = $5`,
            [anonymizedName, anonymizedEmail, anonymizedPhone, anonymizedAddress, normalizedEmail]
        );
    }
    
    if (stats.reviewsToDelete > 0) {
        await query('DELETE FROM reviews WHERE customer_email = $1', [normalizedEmail]);
    }
    
    if (stats.waitlistToDelete > 0) {
        await query('DELETE FROM waitlist WHERE customer_email = $1', [normalizedEmail]);
    }
    
    if (stats.couponUsageToKeep > 0) {
        await query('UPDATE coupon_usage SET customer_email = $1 WHERE customer_email = $2', [anonymizedEmail, normalizedEmail]);
    }
    
    console.log(`[GDPR] Data deletion completed for: ${normalizedEmail}`, stats);
    
    res.json({
        success: true,
        message: 'Personal data has been deleted/anonymized successfully',
        stats: {
            ordersAnonymized: stats.ordersToAnonymize,
            reviewsDeleted: stats.reviewsToDelete,
            waitlistEntriesDeleted: stats.waitlistToDelete,
            couponUsagesAnonymized: stats.couponUsageToKeep
        }
    });
}));

export default router;
