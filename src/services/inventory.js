/**
 * Inventory management with reservation-based stock protection.
 * PostgreSQL operations use transactions and row locks in production.
 */
export class InventoryService {
    constructor(db, usePostgres = false) {
        this.db = db;
        this.usePostgres = usePostgres;
        this.reservations = new Map();
    }

    parseInventory(value) {
        if (!value) return {};
        if (typeof value === 'object') return value;
        try {
            return JSON.parse(value);
        } catch {
            return {};
        }
    }

    groupItems(items, orderId) {
        const grouped = new Map();

        for (const item of items) {
            const quantity = Number(item.quantity);
            if (!item.id || !item.color || !item.size || !Number.isInteger(quantity) || quantity <= 0) {
                throw new Error('Invalid inventory item');
            }

            const variantKey = `${item.color}-${item.size}`;
            const key = `${item.id}:${variantKey}`;
            const existing = grouped.get(key);

            if (existing) {
                existing.quantity += quantity;
            } else {
                grouped.set(key, {
                    productId: item.id,
                    productName: item.name || item.id,
                    variantKey,
                    quantity,
                    orderId
                });
            }
        }

        return [...grouped.values()];
    }

    async getStock(productId, color, size) {
        const variantKey = `${color}-${size}`;

        let result;
        if (this.usePostgres) {
            result = await this.db.query('SELECT inventory FROM products WHERE id = $1', [productId]);
        } else {
            const product = this.db.prepare('SELECT inventory FROM products WHERE id = ?').get(productId);
            result = { rows: product ? [product] : [] };
        }

        if (!result.rows[0]) return { available: 0, reserved: 0, total: 0 };

        const inventory = this.parseInventory(result.rows[0].inventory);
        const total = Number(inventory[variantKey] || 0);
        const reserved = await this.getReservedCount(productId, variantKey);

        return {
            available: Math.max(0, total - reserved),
            reserved,
            total
        };
    }

    async reserveItems(items, orderId) {
        const reservations = this.groupItems(items, orderId);

        if (this.usePostgres) {
            return this.reserveItemsPostgres(reservations, orderId);
        }

        // SQLite is only used for local development. Keep the entire reservation
        // operation synchronous so two requests cannot interleave between check/write.
        for (const reservation of reservations) {
            const product = this.db.prepare('SELECT inventory FROM products WHERE id = ?').get(reservation.productId);
            if (!product) throw new Error(`Product not found: ${reservation.productName}`);

            const inventory = this.parseInventory(product.inventory);
            const total = Number(inventory[reservation.variantKey] || 0);
            const reserved = this.getReservedCountSync(reservation.productId, reservation.variantKey, orderId);
            const available = Math.max(0, total - reserved);

            if (available < reservation.quantity) {
                throw new Error(
                    `Insufficient stock for ${reservation.productName}. Available: ${available}, Requested: ${reservation.quantity}`
                );
            }
        }

        // A retry for the same order should replace, not duplicate, its reservation.
        this.deleteLocalReservationsForOrder(orderId);
        for (const reservation of reservations) {
            const reservationId = `${reservation.productId}:${reservation.variantKey}:${orderId}`;
            this.reservations.set(reservationId, {
                ...reservation,
                expiresAt: Date.now() + 30 * 60 * 1000
            });
        }

        return { success: true, reservations };
    }

    async reserveItemsPostgres(reservations, orderId) {
        const client = await this.db.connect();

        try {
            await client.query('BEGIN');

            const existing = await client.query(
                'SELECT product_id, variant_key, quantity, order_id FROM inventory_reservations WHERE order_id = $1 FOR UPDATE',
                [orderId]
            );

            if (existing.rows.length > 0) {
                await client.query('COMMIT');
                return { success: true, reservations: existing.rows, reused: true };
            }

            for (const reservation of reservations) {
                const productResult = await client.query(
                    'SELECT inventory FROM products WHERE id = $1 FOR UPDATE',
                    [reservation.productId]
                );

                if (!productResult.rows[0]) {
                    throw new Error(`Product not found: ${reservation.productName}`);
                }

                const inventory = this.parseInventory(productResult.rows[0].inventory);
                const total = Number(inventory[reservation.variantKey] || 0);
                const reservedResult = await client.query(
                    `SELECT COALESCE(SUM(quantity), 0) AS reserved
                     FROM inventory_reservations
                     WHERE product_id = $1
                       AND variant_key = $2
                       AND expires_at > NOW()`,
                    [reservation.productId, reservation.variantKey]
                );
                const reserved = Number(reservedResult.rows[0].reserved || 0);
                const available = Math.max(0, total - reserved);

                if (available < reservation.quantity) {
                    throw new Error(
                        `Insufficient stock for ${reservation.productName}. Available: ${available}, Requested: ${reservation.quantity}`
                    );
                }

                await client.query(
                    `INSERT INTO inventory_reservations
                     (product_id, variant_key, quantity, order_id, expires_at)
                     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 minutes')`,
                    [reservation.productId, reservation.variantKey, reservation.quantity, orderId]
                );
            }

            await client.query('COMMIT');
            return { success: true, reservations };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async createReservation(productId, variantKey, quantity, orderId) {
        const reservationId = `${productId}:${variantKey}:${orderId}`;

        if (this.usePostgres) {
            await this.db.query(
                `INSERT INTO inventory_reservations
                 (product_id, variant_key, quantity, order_id, expires_at)
                 VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 minutes')`,
                [productId, variantKey, quantity, orderId]
            );
            return;
        }

        this.reservations.set(reservationId, {
            productId,
            variantKey,
            quantity,
            orderId,
            expiresAt: Date.now() + 30 * 60 * 1000
        });
    }

    async releaseReservation(productId, variantKey, orderId) {
        if (this.usePostgres) {
            await this.db.query(
                'DELETE FROM inventory_reservations WHERE product_id = $1 AND order_id = $2 AND variant_key = $3',
                [productId, orderId, variantKey]
            );
            return;
        }

        this.reservations.delete(`${productId}:${variantKey}:${orderId}`);
    }

    getReservedCountSync(productId, variantKey, excludeOrderId = null) {
        let count = 0;
        const now = Date.now();

        for (const reservation of this.reservations.values()) {
            if (
                reservation.productId === productId &&
                reservation.variantKey === variantKey &&
                reservation.orderId !== excludeOrderId &&
                reservation.expiresAt > now
            ) {
                count += Number(reservation.quantity);
            }
        }

        return count;
    }

    async getReservedCount(productId, variantKey) {
        if (this.usePostgres) {
            const result = await this.db.query(
                `SELECT COALESCE(SUM(quantity), 0) AS reserved
                 FROM inventory_reservations
                 WHERE product_id = $1
                   AND variant_key = $2
                   AND expires_at > NOW()`,
                [productId, variantKey]
            );
            return Number(result.rows[0].reserved || 0);
        }

        return this.getReservedCountSync(productId, variantKey);
    }

    async confirmReservation(orderId) {
        if (this.usePostgres) return this.confirmReservationPostgres(orderId);

        const reservations = [...this.reservations.values()].filter(
            reservation => reservation.orderId === orderId
        );

        if (reservations.length === 0) {
            return { success: true, alreadyConfirmed: true };
        }

        const transaction = this.db.transaction(() => {
            for (const reservation of reservations) {
                const product = this.db.prepare('SELECT inventory FROM products WHERE id = ?').get(reservation.productId);
                if (!product) throw new Error(`Product not found: ${reservation.productId}`);

                const inventory = this.parseInventory(product.inventory);
                const current = Number(inventory[reservation.variantKey] || 0);
                if (current < reservation.quantity) {
                    throw new Error(`Insufficient stock while confirming order ${orderId}`);
                }

                inventory[reservation.variantKey] = current - reservation.quantity;
                this.db.prepare('UPDATE products SET inventory = ? WHERE id = ?').run(
                    JSON.stringify(inventory),
                    reservation.productId
                );
            }
        });

        transaction();
        this.deleteLocalReservationsForOrder(orderId);
        return { success: true };
    }

    async confirmReservationPostgres(orderId) {
        const client = await this.db.connect();

        try {
            await client.query('BEGIN');
            const reservationResult = await client.query(
                `SELECT product_id, variant_key, quantity
                 FROM inventory_reservations
                 WHERE order_id = $1
                 ORDER BY product_id, variant_key
                 FOR UPDATE`,
                [orderId]
            );

            if (reservationResult.rows.length === 0) {
                await client.query('COMMIT');
                return { success: true, alreadyConfirmed: true };
            }

            for (const reservation of reservationResult.rows) {
                const productResult = await client.query(
                    'SELECT inventory FROM products WHERE id = $1 FOR UPDATE',
                    [reservation.product_id]
                );
                if (!productResult.rows[0]) {
                    throw new Error(`Product not found: ${reservation.product_id}`);
                }

                const inventory = this.parseInventory(productResult.rows[0].inventory);
                const current = Number(inventory[reservation.variant_key] || 0);
                const quantity = Number(reservation.quantity);

                if (current < quantity) {
                    throw new Error(`Insufficient stock while confirming order ${orderId}`);
                }

                inventory[reservation.variant_key] = current - quantity;
                await client.query('UPDATE products SET inventory = $1 WHERE id = $2', [
                    JSON.stringify(inventory),
                    reservation.product_id
                ]);
            }

            await client.query('DELETE FROM inventory_reservations WHERE order_id = $1', [orderId]);
            await client.query('COMMIT');
            return { success: true };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async cancelReservation(orderId) {
        if (this.usePostgres) {
            await this.db.query('DELETE FROM inventory_reservations WHERE order_id = $1', [orderId]);
            return;
        }

        this.deleteLocalReservationsForOrder(orderId);
    }

    deleteLocalReservationsForOrder(orderId) {
        for (const [key, reservation] of this.reservations.entries()) {
            if (reservation.orderId === orderId) this.reservations.delete(key);
        }
    }

    async updateStock(productId, color, size, newQuantity) {
        const variantKey = `${color}-${size}`;
        const quantity = Math.max(0, Number.parseInt(newQuantity, 10) || 0);

        if (this.usePostgres) {
            const client = await this.db.connect();
            try {
                await client.query('BEGIN');
                const result = await client.query(
                    'SELECT inventory FROM products WHERE id = $1 FOR UPDATE',
                    [productId]
                );
                if (!result.rows[0]) throw new Error('Product not found');

                const inventory = this.parseInventory(result.rows[0].inventory);
                inventory[variantKey] = quantity;
                await client.query('UPDATE products SET inventory = $1 WHERE id = $2', [
                    JSON.stringify(inventory),
                    productId
                ]);
                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } else {
            const product = this.db.prepare('SELECT inventory FROM products WHERE id = ?').get(productId);
            if (!product) throw new Error('Product not found');

            const inventory = this.parseInventory(product.inventory);
            inventory[variantKey] = quantity;
            this.db.prepare('UPDATE products SET inventory = ? WHERE id = ?').run(
                JSON.stringify(inventory),
                productId
            );
        }

        return { success: true, productId, variantKey, quantity };
    }

    async getLowStock(threshold = 5) {
        const products = this.usePostgres
            ? (await this.db.query('SELECT * FROM products')).rows
            : this.db.prepare('SELECT * FROM products').all();

        const lowStock = [];
        for (const product of products) {
            const inventory = this.parseInventory(product.inventory);
            for (const [variantKey, rawQuantity] of Object.entries(inventory)) {
                const quantity = Number(rawQuantity);
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
    }

    async cleanupExpiredReservations() {
        if (this.usePostgres) {
            await this.db.query('DELETE FROM inventory_reservations WHERE expires_at < NOW()');
            return;
        }

        const now = Date.now();
        for (const [key, reservation] of this.reservations.entries()) {
            if (reservation.expiresAt < now) this.reservations.delete(key);
        }
    }
}

export default InventoryService;
