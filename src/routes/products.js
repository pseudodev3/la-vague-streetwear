import express from 'express';
import { asyncHandler, APIError } from '../middleware/errorHandler.js';
import { query, USE_POSTGRES } from '../config/db.js';
import { csrfProtection } from '../middleware/csrf.js';

const router = express.Router();

const safeParseJSON = (str, defaultValue = null) => {
    if (!str || str === 'null' || str === 'undefined') return defaultValue;
    try { return JSON.parse(str); } catch (e) { return defaultValue; }
};

// ... existing routes ...

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


export default router;
