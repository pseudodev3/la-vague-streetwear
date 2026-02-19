import { db, USE_POSTGRES } from '../config/db.js';

export async function logAudit(action, entityType, entityId, oldData, newData, req) {
    try {
        const performedBy = req?.adminToken ? 'admin' : 'system';
        const ipAddress = req?.ip || 'unknown';
        const userAgent = req?.headers?.['user-agent'] || 'unknown';
        
        if (USE_POSTGRES) {
            await db.query(`
                INSERT INTO audit_logs (action, entity_type, entity_id, old_data, new_data, performed_by, ip_address, user_agent)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [action, entityType, entityId, JSON.stringify(oldData), JSON.stringify(newData), performedBy, ipAddress, userAgent]);
        } else {
            db.prepare(`
                INSERT INTO audit_logs (action, entity_type, entity_id, old_data, new_data, performed_by, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(action, entityType, entityId, JSON.stringify(oldData), JSON.stringify(newData), performedBy, ipAddress, userAgent);
        }
    } catch (error) {
        console.error('[AUDIT] Failed to log:', error.message);
    }
}

export async function logInventoryMovement(productId, variantKey, movementType, quantityChange, quantityBefore, referenceId, referenceType, notes) {
    try {
        const quantityAfter = quantityBefore + quantityChange;
        
        if (USE_POSTGRES) {
            await db.query(`
                INSERT INTO inventory_movements (product_id, variant_key, movement_type, quantity_change, quantity_before, quantity_after, reference_id, reference_type, notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [productId, variantKey, movementType, quantityChange, quantityBefore, quantityAfter, referenceId, referenceType, notes]);
        } else {
            db.prepare(`
                INSERT INTO inventory_movements (product_id, variant_key, movement_type, quantity_change, quantity_before, quantity_after, reference_id, reference_type, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(productId, variantKey, movementType, quantityChange, quantityBefore, quantityAfter, referenceId, referenceType, notes);
        }
    } catch (error) {
        console.error('[INVENTORY] Failed to log movement:', error.message);
    }
}

export async function logWebhookEvent(eventType, data) {
    try {
        const logEntry = {
            timestamp: new Date().toISOString(),
            event: eventType,
            reference: data?.reference,
            amount: data?.amount,
            customer_email: data?.customer?.email
        };
        
        if (USE_POSTGRES) {
            await db.query(`
                INSERT INTO webhook_logs (event_type, reference, amount, customer_email, raw_data, created_at)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                eventType,
                data?.reference || null,
                data?.amount || null,
                data?.customer?.email || null,
                JSON.stringify(data),
                new Date().toISOString()
            ]);
        } else {
            console.log('[WEBHOOK LOG]', JSON.stringify(logEntry));
        }
    } catch (error) {
        console.error('[PAYSTACK WEBHOOK] Failed to log event:', error.message);
    }
}
