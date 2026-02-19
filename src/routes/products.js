import express from 'express';
import { asyncHandler, APIError } from '../middleware/errorHandler.js';
import { query } from '../config/db.js';

const router = express.Router();

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
    const result = await query('SELECT * FROM products WHERE slug = $1', [req.params.slug]);
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

export default router;
