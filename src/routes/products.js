import express from 'express';
import { asyncHandler, APIError } from '../middleware/errorHandler.js';
import { query, USE_POSTGRES } from '../config/db.js';
import { csrfProtection } from '../middleware/csrf.js';
import { sendReviewConfirmationEmail, sendNewReviewNotification } from '../../email-templates/index.js';

const router = express.Router();

const safeParseJSON = (str, defaultValue = null) => {
    if (!str || str === 'null' || str === 'undefined') return defaultValue;
    try { return JSON.parse(str); } catch (e) { return defaultValue; }
};

// Get all products
router.get('/', asyncHandler(async (req, res) => {
    const result = await query('SELECT * FROM products ORDER BY created_at DESC');
    const products = result.rows.map(p => {
        const parseJson = (val) => typeof val === 'string' ? JSON.parse(val || 'null') : val;
        return {
            ...p,
            features: parseJson(p.features) || [],
            images: parseJson(p.images) || [],
            colors: parseJson(p.colors) || [],
            sizes: parseJson(p.sizes) || [],
            inventory: parseJson(p.inventory) || {},
            tags: parseJson(p.tags) || []
        };
    });
    res.json({ success: true, products });
}));

// Get product by slug
router.get('/:slug', asyncHandler(async (req, res) => {
    // Check if slug is actually an ID (common in some parts of the frontend)
    let result = await query('SELECT * FROM products WHERE slug = $1 OR id = $1', [req.params.slug]);
    
    if (result.rows.length === 0) {
        throw new APIError('Product not found', 404, 'NOT_FOUND');
    }
    const p = result.rows[0];
    const parseJson = (val) => typeof val === 'string' ? JSON.parse(val || 'null') : val;
    res.json({
        success: true,
        product: {
            ...p,
            features: parseJson(p.features) || [],
            images: parseJson(p.images) || [],
            colors: parseJson(p.colors) || [],
            sizes: parseJson(p.sizes) || [],
            inventory: parseJson(p.inventory) || {},
            tags: parseJson(p.tags) || []
        }
    });
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
    
    await query(`
        INSERT INTO reviews (id, product_id, order_id, customer_email, customer_name, rating, title, review_text, photos)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [reviewId, id, orderId || null, customerEmail, customerName, rating, title, reviewText, JSON.stringify(photos || [])]);
    
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

// Check stock availability
router.get('/inventory/check/:productId', asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { color, size } = req.query;
    
    const result = await query('SELECT inventory FROM products WHERE id = $1', [productId]);
    if (result.rows.length === 0) throw new APIError('Product not found', 404);
    
    const inventory = safeParseJSON(result.rows[0].inventory, {});
    const variantKey = `${color}-${size}`;
    const available = inventory[variantKey] || 0;
    
    res.json({ success: true, available, inStock: available > 0 });
}));



export default router;
