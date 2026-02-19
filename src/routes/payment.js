import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { verifyPaystackSignature, processWebhook } from '../services/paymentService.js';

const router = express.Router();

export default function(inventoryService) {
    router.post('/webhook', asyncHandler(async (req, res) => {
        const signature = req.headers['x-paystack-signature'];
        const payload = req.rawBody || req.body;
        
        if (!signature || !verifyPaystackSignature(payload, signature)) {
            console.error('[PAYSTACK WEBHOOK] Invalid signature');
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        let event = req.body;
        if (typeof event !== 'object' || event === null) {
            event = JSON.parse(payload.toString());
        }
        
        await processWebhook(event, inventoryService);
        res.json({ received: true });
    }));

    router.post('/webhook-test', express.json(), (req, res) => {
        console.log('[WEBHOOK TEST] Received:', req.body);
        res.json({ received: true, timestamp: new Date().toISOString() });
    });

    return router;
}
