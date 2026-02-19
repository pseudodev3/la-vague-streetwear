import { query, USE_POSTGRES } from '../config/db.js';
import { asyncHandler, APIError } from '../middleware/errorHandler.js';
import { logAudit } from '../utils/audit.js';

export const getStats = asyncHandler(async (req, res) => {
    let totalOrders, pendingOrders, totalRevenue, recentOrdersResult;

    if (USE_POSTGRES) {
        totalOrders = await query('SELECT COUNT(*) FROM orders');
        pendingOrders = await query("SELECT COUNT(*) FROM orders WHERE order_status = 'pending'");
        totalRevenue = await query("SELECT COALESCE(SUM(total), 0) FROM orders WHERE payment_status = 'paid'");
        recentOrdersResult = await query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5');
    } else {
        totalOrders = { rows: [{ count: (await query('SELECT COUNT(*) as count FROM orders')).rows[0].count }] };
        pendingOrders = { rows: [{ count: (await query("SELECT COUNT(*) as count FROM orders WHERE order_status = 'pending'")).rows[0].count }] };
        totalRevenue = { rows: [{ coalesce: (await query("SELECT SUM(total) as revenue FROM orders WHERE payment_status = 'paid'")).rows[0].revenue || 0 }] };
        recentOrdersResult = await query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5');
    }

    res.json({
        success: true,
        stats: {
            totalOrders: parseInt(totalOrders.rows[0].count),
            pendingOrders: parseInt(pendingOrders.rows[0].count),
            totalRevenue: parseInt(totalRevenue.rows[0].coalesce || totalRevenue.rows[0].revenue || 0),
            recentOrders: recentOrdersResult.rows
        }
    });
});

export const getOrders = asyncHandler(async (req, res) => {
    const result = await query('SELECT * FROM orders ORDER BY created_at DESC');
    const orders = result.rows.map(o => ({
        ...o,
        shippingAddress: typeof o.shipping_address === 'string' ? JSON.parse(o.shipping_address || '{}') : o.shipping_address,
        items: typeof o.items === 'string' ? JSON.parse(o.items || '[]') : o.items
    }));
    res.json({ success: true, orders });
});

// ... More controllers will be added
