/**
 * LA VAGUE - Inventory Management Service
 * Handles stock tracking, reservations, and race condition prevention
 */

/**
 * Inventory Service
 * Manages stock levels and prevents overselling
 */
export class InventoryService {
    constructor(db, usePostgres = false) {
        this.db = db;
        this.usePostgres = usePostgres;
        this.reservations = new Map(); // In-memory reservations (for SQLite)
    }

    /**
     * Get current stock for a product variant
     */
    async getStock(productId, color, size) {
        const variantKey = `${color}-${size}`;
        
        try {
            let result;
            if (this.usePostgres) {
                result = await this.db.query(
                    'SELECT inventory FROM products WHERE id = $1',
                    [productId]
                );
            } else {
                const stmt = this.db.prepare('SELECT inventory FROM products WHERE id = ?');
                result = { rows: [stmt.get(productId)] };
            }

            if (!result.rows[0]) {
                return { available: 0, reserved: 0, total: 0 };
            }

            const inventory = typeof result.rows[0].inventory === 'string' 
                ? JSON.parse(result.rows[0].inventory)
                : result.rows[0].inventory;

            const total = inventory[variantKey] || 0;
            const reserved = await this.getReservedCount(productId, variantKey);
            
            return {
                available: Math.max(0, total - reserved),
                reserved,
                total
            };
        } catch (error) {
            console.error('[INVENTORY] Error getting stock:', error);
            throw error;
        }
    }

    /**
     * Check if items are available and reserve them
     * Uses atomic operations to prevent race conditions
     */
    async reserveItems(items, orderId) {
        const reservations = [];
        
        try {
            // Check availability for all items first
            for (const item of items) {
                const variantKey = `${item.color}-${item.size}`;
                const stock = await this.getStock(item.id, item.color, item.size);
                
                if (stock.available < item.quantity) {
                    throw new Error(
                        `Insufficient stock for ${item.name} (${item.color} / ${item.size}). ` +
                        `Available: ${stock.available}, Requested: ${item.quantity}`
                    );
                }
                
                reservations.push({
                    productId: item.id,
                    variantKey,
                    quantity: item.quantity,
                    orderId
                });
            }

            // Reserve all items
            for (const reservation of reservations) {
                await this.createReservation(
                    reservation.productId,
                    reservation.variantKey,
                    reservation.quantity,
                    orderId
                );
            }

            return { success: true, reservations };
        } catch (error) {
            // Rollback any reservations made
            for (const reservation of reservations) {
                await this.releaseReservation(
                    reservation.productId,
                    reservation.variantKey,
                    reservation.orderId
                );
            }
            throw error;
        }
    }

    /**
     * Create a reservation
     */
    async createReservation(productId, variantKey, quantity, orderId) {
        const reservationId = `${productId}:${variantKey}:${orderId}`;
        
        if (this.usePostgres) {
            // For PostgreSQL, use a reservations table
            await this.db.query(
                `INSERT INTO inventory_reservations 
                 (product_id, variant_key, quantity, order_id, expires_at)
                 VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 minutes')`,
                [productId, variantKey, quantity, orderId]
            );
        } else {
            // For SQLite, use in-memory map with expiration
            this.reservations.set(reservationId, {
                productId,
                variantKey,
                quantity,
                orderId,
                expiresAt: Date.now() + (30 * 60 * 1000) // 30 minutes
            });
        }
    }

    /**
     * Release a reservation
     */
    async releaseReservation(productId, variantKey, orderId) {
        if (this.usePostgres) {
            await this.db.query(
                'DELETE FROM inventory_reservations WHERE order_id = $1 AND variant_key = $2',
                [orderId, variantKey]
            );
        } else {
            const reservationId = `${productId}:${variantKey}:${orderId}`;
            this.reservations.delete(reservationId);
        }
    }

    /**
     * Get reserved count for a variant
     */
    async getReservedCount(productId, variantKey) {
        if (this.usePostgres) {
            const result = await this.db.query(
                `SELECT COALESCE(SUM(quantity), 0) as reserved
                 FROM inventory_reservations 
                 WHERE product_id = $1 
                 AND variant_key = $2
                 AND expires_at > NOW()`,
                [productId, variantKey]
            );
            return parseInt(result.rows[0].reserved);
        } else {
            // Sum in-memory reservations that haven't expired
            let count = 0;
            const now = Date.now();
            
            for (const [key, reservation] of this.reservations) {
                if (reservation.productId === productId &&
                    reservation.variantKey === variantKey &&
                    reservation.expiresAt > now) {
                    count += reservation.quantity;
                }
            }
            return count;
        }
    }

    /**
     * Confirm reservation (convert to actual sale)
     * This deducts from actual inventory
     */
    async confirmReservation(orderId, items) {
        try {
            for (const item of items) {
                const variantKey = `${item.color}-${item.size}`;
                
                if (this.usePostgres) {
                    // Get current inventory
                    const product = await this.db.query(
                        'SELECT inventory FROM products WHERE id = $1',
                        [item.id]
                    );
                    
                    const inventory = product.rows[0].inventory;
                    inventory[variantKey] = Math.max(0, (inventory[variantKey] || 0) - item.quantity);
                    
                    // Update inventory
                    await this.db.query(
                        'UPDATE products SET inventory = $1 WHERE id = $2',
                        [JSON.stringify(inventory), item.id]
                    );
                    
                    // Remove reservation
                    await this.db.query(
                        'DELETE FROM inventory_reservations WHERE order_id = $1',
                        [orderId]
                    );
                } else {
                    // SQLite - update inventory directly
                    const stmt = this.db.prepare('SELECT inventory FROM products WHERE id = ?');
                    const product = stmt.get(item.id);
                    const inventory = JSON.parse(product.inventory);
                    inventory[variantKey] = Math.max(0, (inventory[variantKey] || 0) - item.quantity);
                    
                    this.db.prepare('UPDATE products SET inventory = ? WHERE id = ?')
                        .run(JSON.stringify(inventory), item.id);
                    
                    // Remove from in-memory reservations
                    const reservationId = `${item.id}:${variantKey}:${orderId}`;
                    this.reservations.delete(reservationId);
                }
            }
            
            return { success: true };
        } catch (error) {
            console.error('[INVENTORY] Error confirming reservation:', error);
            throw error;
        }
    }

    /**
     * Cancel reservation (release without deducting)
     */
    async cancelReservation(orderId) {
        if (this.usePostgres) {
            await this.db.query(
                'DELETE FROM inventory_reservations WHERE order_id = $1',
                [orderId]
            );
        } else {
            // Remove all reservations for this order
            for (const [key, reservation] of this.reservations) {
                if (reservation.orderId === orderId) {
                    this.reservations.delete(key);
                }
            }
        }
    }

    /**
     * Update inventory for a product variant
     */
    async updateStock(productId, color, size, newQuantity) {
        const variantKey = `${color}-${size}`;
        
        try {
            if (this.usePostgres) {
                // Get current inventory
                const result = await this.db.query(
                    'SELECT inventory FROM products WHERE id = $1',
                    [productId]
                );
                
                if (!result.rows[0]) {
                    throw new Error('Product not found');
                }
                
                const inventory = result.rows[0].inventory;
                inventory[variantKey] = Math.max(0, parseInt(newQuantity) || 0);
                
                await this.db.query(
                    'UPDATE products SET inventory = $1 WHERE id = $2',
                    [JSON.stringify(inventory), productId]
                );
            } else {
                const stmt = this.db.prepare('SELECT inventory FROM products WHERE id = ?');
                const product = stmt.get(productId);
                
                if (!product) {
                    throw new Error('Product not found');
                }
                
                const inventory = JSON.parse(product.inventory);
                inventory[variantKey] = Math.max(0, parseInt(newQuantity) || 0);
                
                this.db.prepare('UPDATE products SET inventory = ? WHERE id = ?')
                    .run(JSON.stringify(inventory), productId);
            }
            
            return { success: true, productId, variantKey, quantity: newQuantity };
        } catch (error) {
            console.error('[INVENTORY] Error updating stock:', error);
            throw error;
        }
    }

    /**
     * Get low stock items (below threshold)
     */
    async getLowStock(threshold = 5) {
        try {
            let products;
            
            if (this.usePostgres) {
                const result = await this.db.query('SELECT * FROM products');
                products = result.rows;
            } else {
                products = this.db.prepare('SELECT * FROM products').all();
            }
            
            const lowStock = [];
            
            for (const product of products) {
                const inventory = typeof product.inventory === 'string'
                    ? JSON.parse(product.inventory)
                    : product.inventory;
                
                for (const [variantKey, quantity] of Object.entries(inventory)) {
                    if (quantity <= threshold) {
                        const [color, size] = variantKey.split('-');
                        lowStock.push({
                            productId: product.id,
                            productName: product.name,
                            variantKey,
                            color,
                            size,
                            quantity,
                            threshold
                        });
                    }
                }
            }
            
            return lowStock;
        } catch (error) {
            console.error('[INVENTORY] Error getting low stock:', error);
            throw error;
        }
    }

    /**
     * Clean up expired reservations (call periodically)
     */
    async cleanupExpiredReservations() {
        if (this.usePostgres) {
            const result = await this.db.query(
                'DELETE FROM inventory_reservations WHERE expires_at < NOW() RETURNING *'
            );
            if (result.rows.length > 0) {
                console.log(`[INVENTORY] Cleaned up ${result.rows.length} expired reservations`);
            }
        } else {
            // Clean up in-memory expired reservations
            const now = Date.now();
            let cleaned = 0;
            
            for (const [key, reservation] of this.reservations) {
                if (reservation.expiresAt < now) {
                    this.reservations.delete(key);
                    cleaned++;
                }
            }
            
            if (cleaned > 0) {
                console.log(`[INVENTORY] Cleaned up ${cleaned} expired reservations`);
            }
        }
    }
}

export default InventoryService;
