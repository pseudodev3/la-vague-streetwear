import express from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { asyncHandler, APIError } from '../middleware/errorHandler.js';
import { verifyAdminToken } from '../middleware/auth.js';
import { query, USE_POSTGRES } from '../config/db.js';
import { logAudit } from '../utils/audit.js';
import { validateUpdateOrderStatus, validateAdminLogin } from '../middleware/validation.js';
import { 
    sendOrderStatusUpdate, 
    previewEmail, 
    testEmailConfig, 
    getEmailQueueStats, 
    getEmailConfig 
} from '../../email-templates/index.js';

const router = express.Router();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    message: { success: false, error: 'Too many login attempts.', code: 'RATE_LIMIT' }
});

export default function(productService, inventoryService) {
    // Admin login
    router.post('/login', authLimiter, validateAdminLogin, asyncHandler(async (req, res) => {
        const { password } = req.body;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword) {
            throw new APIError('Server configuration error', 500, 'CONFIG_ERROR');
        }

        const passwordBuffer = Buffer.from(password);
        const adminBuffer = Buffer.from(adminPassword);

        if (passwordBuffer.length !== adminBuffer.length ||
            !crypto.timingSafeEqual(passwordBuffer, adminBuffer)) {
            throw new APIError('Invalid password', 401, 'AUTH_ERROR');
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        if (USE_POSTGRES) {
            await query('INSERT INTO admin_sessions (session_key, expires_at) VALUES ($1, $2)', [token, expiresAt]);
        } else {
            await query('INSERT INTO admin_sessions (session_key, expires_at) VALUES (?, ?)', [token, expiresAt.toISOString()]);
        }

        res.json({ success: true, token });
    }));

    // Logout
    router.post('/logout', verifyAdminToken, asyncHandler(async (req, res) => {
        if (USE_POSTGRES) {
            await query('DELETE FROM admin_sessions WHERE session_key = $1', [req.adminToken]);
        } else {
            await query('DELETE FROM admin_sessions WHERE session_key = ?', [req.adminToken]);
        }
        res.json({ success: true });
    }));

    // Orders
    router.get('/orders', verifyAdminToken, asyncHandler(async (req, res) => {
        const result = await query('SELECT * FROM orders ORDER BY created_at DESC');
        const orders = result.rows.map(o => {
            const parseJson = (val) => typeof val === 'string' ? JSON.parse(val || 'null') : val;
            return {
                ...o,
                shippingAddress: parseJson(o.shipping_address) || {},
                items: parseJson(o.items) || []
            };
        });
        res.json({ success: true, orders });
    }));

    router.post('/orders/:id/status', verifyAdminToken, validateUpdateOrderStatus, asyncHandler(async (req, res) => {
        const { status } = req.body;
        const { id } = req.params;

        const orderResult = await query('SELECT * FROM orders WHERE id = $1', [id]);
        if (orderResult.rows.length === 0) throw new APIError('Order not found', 404);
        const order = orderResult.rows[0];
        const oldStatus = order.order_status;

        await query('UPDATE orders SET order_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [status, id]);
        
        // Audit
        await logAudit('UPDATE_STATUS', 'order', id, { status: oldStatus }, { status }, req);

        // Send email
        const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        const shippingAddress = typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : order.shipping_address;
        
        let emailSent = false;
        try {
            await sendOrderStatusUpdate({ ...order, items, shipping_address: shippingAddress }, status);
            emailSent = true;
        } catch (e) { console.error('Email failed:', e); }

        res.json({ success: true, emailSent });
    }));

    // Stats
    router.get('/stats', verifyAdminToken, asyncHandler(async (req, res) => {
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
                totalOrders: parseInt(totalOrders.rows[0].count || totalOrders.rows[0].coalesce || 0),
                pendingOrders: parseInt(pendingOrders.rows[0].count || 0),
                totalRevenue: parseInt(totalRevenue.rows[0].coalesce || totalRevenue.rows[0].revenue || 0),
                recentOrders: recentOrdersResult.rows
            }
        });
    }));

    // Product Management
    router.get('/products', verifyAdminToken, asyncHandler(async (req, res) => {
        const { category, search, limit, offset } = req.query;
        const products = await productService.getAll({ category, search, limit, offset });
        res.json({ success: true, products });
    }));

    router.get('/products/stats', verifyAdminToken, asyncHandler(async (req, res) => {
        const stats = await productService.getStats();
        res.json({ success: true, stats });
    }));

    router.get('/products/:id', verifyAdminToken, asyncHandler(async (req, res) => {
        const product = await productService.getById(req.params.id);
        if (!product) throw new APIError('Product not found', 404);
        res.json({ success: true, product });
    }));

    router.delete('/products/:id', verifyAdminToken, asyncHandler(async (req, res) => {
        const result = await productService.delete(req.params.id);
        res.json({ success: true, ...result });
    }));

    // Inventory
    router.get('/inventory/low-stock', verifyAdminToken, asyncHandler(async (req, res) => {
        const threshold = parseInt(req.query.threshold) || 5;
        const lowStock = await inventoryService.getLowStock(threshold);
        res.json({ success: true, lowStock, threshold });
    }));

    router.post('/inventory/release/:orderId', verifyAdminToken, asyncHandler(async (req, res) => {
        const { orderId } = req.params;
        await inventoryService.cancelReservation(orderId);
        res.json({ success: true, message: 'Reservation released' });
    }));

    // Settings
    router.get('/settings', verifyAdminToken, asyncHandler(async (req, res) => {
        const result = await query('SELECT * FROM settings');
        const settings = {};
        result.rows.forEach(row => { settings[row.key] = row.value; });
        res.json({ success: true, settings });
    }));

    router.post('/settings', verifyAdminToken, asyncHandler(async (req, res) => {
        const { settings } = req.body;
        for (const [key, value] of Object.entries(settings)) {
            if (USE_POSTGRES) {
                await query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP', [key, value]);
            } else {
                await query('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now"))', [key, value]);
            }
        }
        res.json({ success: true, message: 'Settings updated' });
    }));

    return router;
}
