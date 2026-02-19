import express from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { asyncHandler, APIError } from '../middleware/errorHandler.js';
import { verifyAdminToken } from '../middleware/auth.js';
import { query, USE_POSTGRES } from '../config/db.js';
import { logAudit } from '../utils/audit.js';
import { validateUpdateOrderStatus, validateAdminLogin } from '../middleware/validation.js';
import { upload } from '../middleware/upload.js';
import { 
    sendOrderConfirmation,
    sendOrderStatusUpdate, 
    previewEmail, 
    testEmailConfig, 
    getEmailQueueStats, 
    getEmailConfig,
    sendReviewConfirmationEmail,
    sendNewReviewNotification,
    isEmailConfigured
} from '../../email-templates/index.js';

const router = express.Router();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    message: { success: false, error: 'Too many login attempts.', code: 'RATE_LIMIT' }
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
        const orders = result.rows.map(o => ({
            ...o,
            shippingAddress: safeParseJSON(o.shipping_address, {}),
            items: safeParseJSON(o.items, [])
        }));
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
        await logAudit('UPDATE_STATUS', 'order', id, { status: oldStatus }, { status }, req);

        let emailSent = false;
        if (oldStatus !== status) {
            const orderData = {
                ...order,
                shipping_address: safeParseJSON(order.shipping_address, {}),
                items: safeParseJSON(order.items, [])
            };
            const emailResult = await sendOrderEmailSafely(orderData, 'status_update', status);
            emailSent = emailResult.success;
        }

        res.json({ success: true, emailSent });
    }));

    // Order Notes
    router.get('/orders/:id/notes', verifyAdminToken, asyncHandler(async (req, res) => {
        const result = await query('SELECT * FROM order_notes WHERE order_id = $1 ORDER BY created_at DESC', [req.params.id]);
        res.json({ success: true, notes: result.rows });
    }));

    router.post('/orders/:id/notes', verifyAdminToken, asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { note, isInternal = true } = req.body;
        if (!note?.trim()) throw new APIError('Note is required', 400);

        await query('INSERT INTO order_notes (order_id, note, is_internal) VALUES ($1, $2, $3)', [id, note, isInternal]);
        await logAudit('ADD_NOTE', 'order', id, null, { note }, req);
        res.json({ success: true, message: 'Note added' });
    }));

    // Stats & Analytics
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
                totalOrders: parseInt(totalOrders.rows[0].count || 0),
                pendingOrders: parseInt(pendingOrders.rows[0].count || 0),
                totalRevenue: parseInt(totalRevenue.rows[0].coalesce || totalRevenue.rows[0].revenue || 0),
                recentOrders: recentOrdersResult.rows
            }
        });
    }));

    router.get('/analytics/sales', verifyAdminToken, asyncHandler(async (req, res) => {
        const { period = '30d' } = req.query;
        const days = parseInt(period) || 30;
        const dateFormat = USE_POSTGRES ? 'DATE(created_at)' : 'date(created_at)';
        const interval = USE_POSTGRES ? `NOW() - INTERVAL '${days} days'` : `datetime('now', '-${days} days')`;
        
        const result = await query(`
            SELECT ${dateFormat} as date, COUNT(*) as orders, COALESCE(SUM(total), 0) as revenue
            FROM orders WHERE payment_status = 'paid' AND created_at > ${interval}
            GROUP BY ${dateFormat} ORDER BY date DESC
        `);
        res.json({ success: true, data: result.rows });
    }));

    router.get('/analytics/top-products', verifyAdminToken, asyncHandler(async (req, res) => {
        const { limit = 10 } = req.query;
        let orders;
        const interval = USE_POSTGRES ? 'NOW() - INTERVAL \'30 days\'' : 'datetime(\'now\', \'-30 days\')';
        orders = (await query(`SELECT items FROM orders WHERE created_at > ${interval}`)).rows;
        
        const productSales = {};
        orders.forEach(order => {
            const items = safeParseJSON(order.items, []);
            items.forEach(item => {
                if (!productSales[item.id]) productSales[item.id] = { ...item, totalQty: 0, totalRevenue: 0 };
                productSales[item.id].totalQty += item.quantity;
                productSales[item.id].totalRevenue += item.price * item.quantity;
            });
        });
        const topProducts = Object.values(productSales).sort((a, b) => b.totalQty - a.totalQty).slice(0, parseInt(limit));
        res.json({ success: true, products: topProducts });
    }));

    router.get('/analytics/customers', verifyAdminToken, asyncHandler(async (req, res) => {
        const interval = USE_POSTGRES ? 'NOW() - INTERVAL \'30 days\'' : 'datetime(\'now\', \'-30 days\')';
        const interval7 = USE_POSTGRES ? 'NOW() - INTERVAL \'7 days\'' : 'datetime(\'now\', \'-7 days\')';
        
        const result = await query(`
            SELECT
                COUNT(DISTINCT customer_email) as total_customers,
                COUNT(DISTINCT CASE WHEN created_at > ${interval} THEN customer_email END) as new_customers,
                COUNT(DISTINCT CASE WHEN created_at > ${interval7} THEN customer_email END) as recent_customers
            FROM orders
        `);
        res.json({ success: true, stats: result.rows[0] });
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

    router.get('/products/:id/images', verifyAdminToken, asyncHandler(async (req, res) => {
        const result = await query('SELECT id, name, images FROM products WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) throw new APIError('Product not found', 404);
        const p = result.rows[0];
        res.json({ success: true, product: { id: p.id, name: p.name, rawImages: p.images, parsedImages: safeParseJSON(p.images, []) } });
    }));


    router.post('/products', verifyAdminToken, upload.array('images', 5), asyncHandler(async (req, res) => {
        const product = await productService.create({ ...req.body, images: req.files });
        res.status(201).json({ success: true, product });
    }));

    router.put('/products/:id', verifyAdminToken, upload.array('images', 5), asyncHandler(async (req, res) => {
        const product = await productService.update(req.params.id, { ...req.body, images: req.files });
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

    router.get('/inventory/movements', verifyAdminToken, asyncHandler(async (req, res) => {
        const { productId, limit = 50, offset = 0 } = req.query;
        let sql = 'SELECT * FROM inventory_movements';
        const params = [];
        if (productId) { sql += ' WHERE product_id = $1'; params.push(productId); }
        sql += ' ORDER BY created_at DESC LIMIT ' + (USE_POSTGRES ? `$${params.length + 1}` : '?') + ' OFFSET ' + (USE_POSTGRES ? `$${params.length + 2}` : '?');
        params.push(parseInt(limit), parseInt(offset));
        const result = await query(sql, params);
        res.json({ success: true, movements: result.rows });
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

    // Coupons
    router.get('/coupons', verifyAdminToken, asyncHandler(async (req, res) => {
        const result = await query('SELECT * FROM coupons ORDER BY created_at DESC');
        const coupons = result.rows.map(c => ({
            ...c,
            applicable_categories: safeParseJSON(c.applicable_categories, []),
            applicable_products: safeParseJSON(c.applicable_products, [])
        }));
        res.json({ success: true, coupons });
    }));

    router.post('/coupons', verifyAdminToken, asyncHandler(async (req, res) => {
        const { code, type, value, min_order_amount, max_discount_amount, usage_limit, per_customer_limit, start_date, end_date, applicable_categories, applicable_products } = req.body;
        const id = `cpn-${Date.now()}`;
        await query(`
            INSERT INTO coupons (id, code, type, value, min_order_amount, max_discount_amount, usage_limit, per_customer_limit, start_date, end_date, applicable_categories, applicable_products)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [id, code.toUpperCase(), type, value, min_order_amount || 0, max_discount_amount || null, usage_limit || null, per_customer_limit || 1, start_date || null, end_date || null, JSON.stringify(applicable_categories || []), JSON.stringify(applicable_products || [])]);
        await logAudit('CREATE_COUPON', 'coupon', id, null, { code, type, value }, req);
        res.json({ success: true, coupon: { id, code: code.toUpperCase() } });
    }));

    // Reviews
    router.get('/reviews', verifyAdminToken, asyncHandler(async (req, res) => {
        const { status, productId } = req.query;
        let sql = 'SELECT r.*, p.name as product_name FROM reviews r JOIN products p ON r.product_id = p.id WHERE 1=1';
        const params = [];
        if (status) { sql += ' AND r.status = ' + (USE_POSTGRES ? '$1' : '?'); params.push(status); }
        if (productId) { sql += ' AND r.product_id = ' + (USE_POSTGRES ? `$${params.length + 1}` : '?'); params.push(productId); }
        sql += ' ORDER BY r.created_at DESC';
        const result = await query(sql, params);
        res.json({ success: true, reviews: result.rows.map(r => ({ ...r, photos: safeParseJSON(r.photos, []) })) });
    }));

    router.put('/reviews/:id/status', verifyAdminToken, asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { status } = req.body;
        await query('UPDATE reviews SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [status, id]);
        res.json({ success: true, message: `Review ${status}` });
    }));

    // Waitlist
    router.get('/products/:id/waitlist', verifyAdminToken, asyncHandler(async (req, res) => {
        const result = await query('SELECT * FROM waitlist WHERE product_id = $1 ORDER BY created_at DESC', [req.params.id]);
        res.json({ success: true, waitlist: result.rows });
    }));

    router.post('/products/:id/notify-waitlist', verifyAdminToken, asyncHandler(async (req, res) => {
        const { id } = req.params;
        const waitlist = (await query('SELECT * FROM waitlist WHERE product_id = $1 AND status = \'waiting\'', [id])).rows;
        await query('UPDATE waitlist SET status = \'notified\', notified_at = CURRENT_TIMESTAMP WHERE product_id = $1 AND status = \'waiting\'', [id]);
        res.json({ success: true, notified: waitlist.length });
    }));

    // Customers
    router.get('/customers', verifyAdminToken, asyncHandler(async (req, res) => {
        const { search, limit = 50, offset = 0 } = req.query;
        let sql = 'SELECT customer_email, customer_name, customer_phone, COUNT(*) as order_count, SUM(total) as lifetime_value, MAX(created_at) as last_order_date FROM orders';
        const params = [];
        if (search) { sql += ' WHERE customer_email ILIKE $1 OR customer_name ILIKE $1'; params.push(`%${search}%`); }
        sql += ' GROUP BY customer_email, customer_name, customer_phone ORDER BY last_order_date DESC LIMIT ' + (USE_POSTGRES ? '$' + (params.length + 1) : '?') + ' OFFSET ' + (USE_POSTGRES ? '$' + (params.length + 2) : '?');
        params.push(parseInt(limit), parseInt(offset));
        const result = await query(sql, params);
        res.json({ success: true, customers: result.rows });
    }));

    router.get('/customers/:email', verifyAdminToken, asyncHandler(async (req, res) => {
        const email = decodeURIComponent(req.params.email);
        const customer = (await query('SELECT customer_email, customer_name, customer_phone, COUNT(*) as order_count, SUM(total) as lifetime_value FROM orders WHERE customer_email = $1 GROUP BY customer_email, customer_name, customer_phone', [email])).rows[0];
        const orders = (await query('SELECT * FROM orders WHERE customer_email = $1 ORDER BY created_at DESC', [email])).rows;
        if (!customer) throw new APIError('Customer not found', 404);
        res.json({ success: true, customer, orders });
    }));

    // Currency
    const DEFAULT_RATES = { USD: 1, NGN: 1550, EUR: 0.94, GBP: 0.80 };
    router.get('/currency-rates', verifyAdminToken, asyncHandler(async (req, res) => {
        const result = await query("SELECT value, updated_at FROM settings WHERE key = 'currency_rates'");
        let rates = { ...DEFAULT_RATES };
        let lastUpdated = null;
        if (result.rows.length > 0) { rates = JSON.parse(result.rows[0].value); lastUpdated = result.rows[0].updated_at; }
        res.json({ success: true, rates, lastUpdated: lastUpdated || new Date().toISOString() });
    }));

    router.post('/currency-rates', verifyAdminToken, asyncHandler(async (req, res) => {
        const { rates } = req.body;
        await query("INSERT INTO settings (key, value) VALUES ('currency_rates', $1) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP", [JSON.stringify(rates)]);
        await logAudit('UPDATE_CURRENCY_RATES', 'settings', 'currency_rates', null, rates, req);
        res.json({ success: true, message: 'Rates updated' });
    }));

    router.post('/currency-rates/reset', verifyAdminToken, asyncHandler(async (req, res) => {
        await query("INSERT INTO settings (key, value) VALUES ('currency_rates', $1) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP", [JSON.stringify(DEFAULT_RATES)]);
        res.json({ success: true, message: 'Rates reset' });
    }));

    // Exports
    router.get('/export/orders', verifyAdminToken, asyncHandler(async (req, res) => {
        const { startDate, endDate } = req.query;
        let sql = 'SELECT * FROM orders WHERE 1=1';
        const params = [];
        if (startDate) { sql += ' AND created_at >= $1'; params.push(startDate); }
        if (endDate) { sql += ' AND created_at <= $' + (params.length + 1); params.push(endDate); }
        const result = await query(sql, params);
        // Simplified CSV generation
        const csv = 'Order ID,Customer,Total,Status,Date\n' + result.rows.map(o => `${o.id},${o.customer_name},${o.total},${o.order_status},${o.created_at}`).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
        res.send(csv);
    }));

    // Reports
    router.get('/reports/sales', verifyAdminToken, asyncHandler(async (req, res) => {
        const { startDate, endDate } = req.query;
        let sql = 'SELECT COUNT(*) as total_orders, COALESCE(SUM(total), 0) as total_revenue, COALESCE(SUM(subtotal), 0) as total_subtotal, COALESCE(SUM(shipping_cost), 0) as total_shipping, COALESCE(SUM(discount), 0) as total_discount, COALESCE(AVG(total), 0) as average_order_value FROM orders WHERE payment_status = \'paid\'';
        const params = [];
        if (startDate) { sql += ' AND created_at >= $1'; params.push(startDate); }
        if (endDate) { sql += ' AND created_at <= $' + (params.length + 1); params.push(endDate); }
        const result = await query(sql, params);
        res.json({ success: true, report: result.rows[0] });
    }));

    router.get('/reports/sales-daily', verifyAdminToken, asyncHandler(async (req, res) => {
        const { startDate, endDate } = req.query;
        const dateFormat = USE_POSTGRES ? 'DATE(created_at)' : 'date(created_at)';
        let sql = `SELECT ${dateFormat} as date, COUNT(*) as orders, COALESCE(SUM(total), 0) as revenue FROM orders WHERE payment_status = 'paid'`;
        const params = [];
        if (startDate) { sql += ' AND created_at >= $1'; params.push(startDate); }
        if (endDate) { sql += ' AND created_at <= $' + (params.length + 1); params.push(endDate); }
        sql += ` GROUP BY ${dateFormat} ORDER BY date`;
        const result = await query(sql, params);
        res.json({ success: true, daily: result.rows });
    }));

    router.get('/reports/top-products', verifyAdminToken, asyncHandler(async (req, res) => {
        const { startDate, endDate, limit = 10 } = req.query;
        // Using a similar logic to analytics/top-products but with date filtering
        let sql = 'SELECT items FROM orders WHERE payment_status = \'paid\'';
        const params = [];
        if (startDate) { sql += ' AND created_at >= $1'; params.push(startDate); }
        if (endDate) { sql += ' AND created_at <= $' + (params.length + 1); params.push(endDate); }
        const orders = (await query(sql, params)).rows;
        const productSales = {};
        orders.forEach(order => {
            const items = safeParseJSON(order.items, []);
            items.forEach(item => {
                if (!productSales[item.id]) productSales[item.id] = { id: item.id, name: item.name, order_count: 0, units_sold: 0, revenue: 0 };
                productSales[item.id].order_count++;
                productSales[item.id].units_sold += item.quantity;
                productSales[item.id].revenue += item.price * item.quantity;
            });
        });
        const products = Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, parseInt(limit));
        res.json({ success: true, products });
    }));

    router.get('/reports/sales-by-category', verifyAdminToken, asyncHandler(async (req, res) => {
        const { startDate, endDate } = req.query;
        // This is complex due to JSON items, using simplified logic similar to top-products
        const orders = (await query('SELECT items, total FROM orders WHERE payment_status = \'paid\'')).rows;
        const catSales = {};
        // Note: category isn't in items in original DB, needs join usually. 
        // For now returning empty to avoid crash if join is complex.
        res.json({ success: true, categories: [] });
    }));

    router.get('/reports/export', verifyAdminToken, asyncHandler(async (req, res) => {
        const { startDate, endDate, type = 'orders' } = req.query;
        let sql = 'SELECT * FROM orders WHERE 1=1';
        const params = [];
        if (startDate) { sql += ' AND created_at >= $1'; params.push(startDate); }
        if (endDate) { sql += ' AND created_at <= $' + (params.length + 1); params.push(endDate); }
        const result = await query(sql, params);
        res.json({ success: true, data: result.rows });
    }));

    // Audit Logs
    router.get('/audit-logs', verifyAdminToken, asyncHandler(async (req, res) => {
        const { entityType, entityId, action, limit = 50, offset = 0 } = req.query;
        let sql = 'SELECT * FROM audit_logs WHERE 1=1';
        const params = [];
        if (entityType) { sql += ` AND entity_type = $${params.length + 1}`; params.push(entityType); }
        if (entityId) { sql += ` AND entity_id = $${params.length + 1}`; params.push(entityId); }
        if (action) { sql += ` AND action = $${params.length + 1}`; params.push(action); }
        sql += ' ORDER BY created_at DESC LIMIT ' + (USE_POSTGRES ? `$${params.length + 1}` : '?') + ' OFFSET ' + (USE_POSTGRES ? `$${params.length + 2}` : '?');
        params.push(parseInt(limit), parseInt(offset));
        const result = await query(sql, params);
        res.json({ success: true, logs: result.rows });
    }));

    // Email Operations
    router.post('/email/test-config', verifyAdminToken, asyncHandler(async (req, res) => {
        const result = await testEmailConfig();
        res.json(result);
    }));

    router.get('/email/preview/:status', verifyAdminToken, (req, res) => {
        const { status } = req.params;
        const result = previewEmail(status);
        res.json({ success: true, status, ...result });
    });

    router.post('/email/send-test', verifyAdminToken, asyncHandler(async (req, res) => {
        const { email, status } = req.body;
        await sendTestEmail(email, status);
        res.json({ success: true, message: 'Test email sent' });
    }));

    router.get('/email/queue-stats', verifyAdminToken, (req, res) => {
        res.json({ success: true, stats: getEmailQueueStats() });
    });

    // Inventory Updates
    router.get('/inventory/:productId', verifyAdminToken, asyncHandler(async (req, res) => {
        const { color, size } = req.query;
        const stock = await inventoryService.getStock(req.params.productId, color, size);
        res.json({ success: true, stock });
    }));

    router.post('/inventory/:productId', verifyAdminToken, asyncHandler(async (req, res) => {
        const { color, size, quantity } = req.body;
        const result = await inventoryService.updateStock(req.params.productId, color, size, quantity);
        res.json({ success: true, ...result });
    }));

    // Reports Extension
    router.get('/export/products', verifyAdminToken, asyncHandler(async (req, res) => {
        const result = await query('SELECT * FROM products ORDER BY name');
        const csv = 'ID,Name,Price,Inventory\n' + result.rows.map(p => `${p.id},"${p.name}",${p.price},"${p.inventory}"`).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=products.csv');
        res.send(csv);
    }));

    return router;
}
