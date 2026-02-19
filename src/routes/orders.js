import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { csrfProtection } from '../middleware/csrf.js';
import { validateCreateOrder } from '../middleware/validation.js';
import { createOrder, lookupOrder } from '../services/orderService.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const orderLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { success: false, error: 'Too many orders, please try again later.' }
});

export default function(productService, inventoryService) {
    router.post('/', orderLimiter, csrfProtection, validateCreateOrder, asyncHandler(async (req, res) => {
        const result = await createOrder(req.body, productService, inventoryService, req.headers.origin);
        res.json({ success: true, ...result });
    }));

    router.post('/lookup', asyncHandler(async (req, res) => {
        const { orderId, email } = req.body;
        const order = await lookupOrder(orderId, email);
        res.json({ success: true, order });
    }));

    return router;
}
