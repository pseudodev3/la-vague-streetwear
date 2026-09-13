import express from 'express';
import { asyncHandler, APIError } from '../middleware/errorHandler.js';
import { query, USE_POSTGRES } from '../config/db.js';
import { csrfProtection } from '../middleware/csrf.js';
import { sendReviewConfirmationEmail, sendNewReviewNotification } from '../../email-templates/index.js';
import { cacheService } from '../utils/cache.js';

const router = express.Router();

const safeParseJSON = (val, defaultValue = null) => {
    if (val === null || val === undefined) return defaultValue;
    if (typeof val === 'object') return val;
    if (typeof val !== 'string') return defaultValue;
    if (val === 'null' || val === 'undefined' || val.trim() === '') return defaultValue;
    try { return JSON.parse(val); } catch (e) { return defaultValue; }
};

// Get all products
router.get('/', asyncHandler(async (req, res) => {
    const cacheKey = 'products_all';
    const cachedProducts = cacheService.get(cacheKey);

    if (cachedProducts) {
        return res.json({ success: true, products: cachedProducts });
    }

    const result = await query('SELECT * FROM products ORDER BY created_at DESC');
    const products = result.rows.map(p => ({
        ...p,
        features: safeParseJSON(p.features, []),
        images: safeParseJSON(p.images, []),
        colors: safeParseJSON(p.colors, []),
        sizes: safeParseJSON(p.sizes, []),
        inventory: safeParseJSON(p.inventory, {}),
        tags: safeParseJSON(p.tags, []),
        average_rating: p.average_rating || 0,
        review_count: p.review_count || 0
    }));

    cacheService.set(cacheKey, products);
    res.json({ success: true, products });
}));

// Get product by slug
router.get('/:slug', asyncHandler(async (req, res) => {
    const cacheKey = `product_${req.params.slug}`;
    const cachedProduct = cacheService.get(cacheKey);

    if (cachedProduct) {
        return res.json({ success: true, product: cachedProduct });
    }

    // Check if slug is actually an ID (common in some parts of the frontend)
    const result = await query('SELECT * FROM products WHERE slug = $1 OR id = $1', [req.params.slug]);

    if (result.rows.length === 0) {
        throw new APIError('Product not found', 404, 'NOT_FOUND');
    }
    const p = result.rows[0];
    const product = {
        ...p,
        features: safeParseJSON(p.features, []),
        images: safeParseJSON(p.images, []),
        colors: safeParseJSON(p.colors, []),
        sizes: safeParseJSON(p.sizes, []),
        inventory: safeParseJSON(p.inventory, {}),
        tags: safeParseJSON(p.tags, []),
        average_rating: p.average_rating || 0,
        review_count: p.review_count || 0
    };

    cacheService.set(cacheKey, product);
    res.json({ success: true, product });
}));

// Get reviews for a product
router.get('/:id/reviews', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status = 'approved', sort = 'newest' } = req.query;

    let sql = 'SELECT * FROM reviews WHERE product_id = $1';
    const params = [id];
    if (status) { sql += ' AND status = $2'; params.push(status); }

    const sortOrder = sort === 'newest' ? 'created_at DESC' :
        sort === 'highest' ? 'rating DESC' :
            sort === 'lowest' ? 'rating ASC' : 'created_at DESC';
    sql += ` ORDER BY ${sortOrder}`;

    const result = await query(sql, params);
    const reviews = result.rows.map(r => ({ ...r, photos: safeParseJSON(r.photos, []) }));

    const summaryResult = await query(`
        SELECT COUNT(*) as total, COALESCE(AVG(rating), 0) as average
        FROM reviews WHERE product_id = $1 AND status = 'approved'
    `, [id]);

    res.json({ success: true, reviews, summary: summaryResult.rows[0] });
}));

// Submit review
router.post('/:id/reviews', csrfProtection, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { orderId, customerEmail, customerName, rating, title, reviewText, photos } = req.body;
    const reviewId = `rvw-${Date.now()}`;
    const isVerified = !!orderId;

    await query(`
        INSERT INTO reviews (id, product_id, order_id, customer_email, customer_name, rating, title, review_text, photos, verified_purchase)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [reviewId, id, orderId || null, customerEmail, customerName, rating, title, reviewText, JSON.stringify(photos || []), isVerified]);

    // Send notifications asynchronously
    (async () => {
        try {
            const productResult = await query('SELECT name FROM products WHERE id = $1', [id]);
            const productName = productResult.rows[0]?.name || id;

            await sendReviewConfirmationEmail({
                customerEmail,
                customerName,
                productName,
                rating,
                title
            });

            await sendNewReviewNotification({
                reviewId,
                productName,
                customerName,
                rating,
                title,
                reviewText
            });
        } catch (emailError) {
            console.error('[REVIEWS] Email notification failed:', emailError);
        }
    })();

    res.json({ success: true, message: 'Review submitted for approval', reviewId });
}));


// Join waitlist
router.post('/:id/waitlist', csrfProtection, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { email, name, variantKey } = req.body;

    await query(`
        INSERT INTO waitlist (product_id, customer_email, customer_name, variant_key, status)
        VALUES ($1, $2, $3, $4, 'waiting')
    `, [id, email, name, variantKey]);

    res.json({ success: true, message: 'Added to waitlist' });
}));

async function getStockSnapshot(productIdOrSlug, color, size) {
    const result = await query('SELECT id, inventory FROM products WHERE id = $1 OR slug = $1', [productIdOrSlug]);
    if (result.rows.length === 0) throw new APIError('Product not found', 404);

    const product = result.rows[0];
    const inventory = safeParseJSON(product.inventory, {});
    const variantKey = `${color}-${size}`;
    const total = Number(inventory[variantKey] || 0);
    let reserved = 0;

    // Production reservations live in PostgreSQL. SQLite reservations are in-memory
    // inside InventoryService and remain a local-development concern only.
    if (USE_POSTGRES) {
        const reservedResult = await query(
            `SELECT COALESCE(SUM(quantity), 0) AS reserved
             FROM inventory_reservations
             WHERE product_id = $1 AND variant_key = $2 AND expires_at > NOW()`,
            [product.id, variantKey]
        );
        reserved = Number(reservedResult.rows[0]?.reserved || 0);
    }

    const available = Math.max(0, total - reserved);
    return { total, reserved, available };
}

// Check stock availability (GET)
router.get('/inventory/check/:productId', asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { color, size } = req.query;
    const stock = await getStockSnapshot(productId, color, size);
    res.json({ success: true, ...stock, inStock: stock.available > 0 });
}));

// Check stock availability (POST)
router.post('/inventory/check', asyncHandler(async (req, res) => {
    const { productId, color, size } = req.body;
    const stock = await getStockSnapshot(productId, color, size);
    res.json({ success: true, ...stock, inStock: stock.available > 0 });
}));



export default router;
