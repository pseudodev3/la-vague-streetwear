/**
 * LA VAGUE - Product Service
 * Handles product CRUD operations with database
 */

import { v4 as uuidv4 } from 'uuid';
import { uploadMultipleImages, deleteMultipleImages, getPublicIdFromUrl } from './cloudinary.js';

export class ProductService {
    constructor(db, usePostgres = false) {
        this.db = db;
        this.usePostgres = usePostgres;
    }

    /**
     * Generate a URL-friendly slug
     */
    generateSlug(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Ensure slug is unique
     */
    async ensureUniqueSlug(slug, excludeId = null) {
        let uniqueSlug = slug;
        let counter = 1;
        
        while (true) {
            let result;
            if (this.usePostgres) {
                const query = excludeId 
                    ? 'SELECT id FROM products WHERE slug = $1 AND id != $2'
                    : 'SELECT id FROM products WHERE slug = $1';
                const params = excludeId ? [uniqueSlug, excludeId] : [uniqueSlug];
                result = await this.db.query(query, params);
            } else {
                const query = excludeId
                    ? 'SELECT id FROM products WHERE slug = ? AND id != ?'
                    : 'SELECT id FROM products WHERE slug = ?';
                const stmt = this.db.prepare(query);
                result = { rows: excludeId ? [stmt.get(uniqueSlug, excludeId)] : [stmt.get(uniqueSlug)] };
            }
            
            if (!result.rows[0]) break;
            
            uniqueSlug = `${slug}-${counter}`;
            counter++;
        }
        
        return uniqueSlug;
    }

    /**
     * Get all products
     */
    async getAll(options = {}) {
        const { category, search, limit = 100, offset = 0 } = options;
        
        let query = 'SELECT * FROM products';
        const params = [];
        const conditions = [];
        
        if (category && category !== 'all') {
            conditions.push('category = $1');
            params.push(category);
        }
        
        if (search) {
            const searchTerm = `%${search}%`;
            conditions.push(`(name ILIKE $${params.length + 1} OR description ILIKE $${params.length + 1})`);
            params.push(searchTerm);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY created_at DESC';
        
        if (this.usePostgres) {
            query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
            params.push(limit, offset);
        } else {
            query += ' LIMIT ? OFFSET ?';
            params.push(limit, offset);
        }
        
        let result;
        if (this.usePostgres) {
            result = await this.db.query(query, params);
        } else {
            const stmt = this.db.prepare(query);
            result = { rows: stmt.all(...params) };
        }
        
        return result.rows.map(p => this.parseProduct(p));
    }

    /**
     * Get product by ID
     */
    async getById(id) {
        let result;
        if (this.usePostgres) {
            result = await this.db.query('SELECT * FROM products WHERE id = $1', [id]);
        } else {
            const stmt = this.db.prepare('SELECT * FROM products WHERE id = ?');
            result = { rows: [stmt.get(id)] };
        }
        
        if (!result.rows[0]) return null;
        return this.parseProduct(result.rows[0]);
    }

    /**
     * Get product by slug
     */
    async getBySlug(slug) {
        let result;
        if (this.usePostgres) {
            result = await this.db.query('SELECT * FROM products WHERE slug = $1', [slug]);
        } else {
            const stmt = this.db.prepare('SELECT * FROM products WHERE slug = ?');
            result = { rows: [stmt.get(slug)] };
        }
        
        if (!result.rows[0]) return null;
        return this.parseProduct(result.rows[0]);
    }

    /**
     * Create a new product
     */
    async create(productData, imageFiles = []) {
        const {
            name,
            category,
            price,
            compareAtPrice = null,
            description = '',
            features = [],
            colors = [],
            sizes = [],
            inventory = {},
            tags = [],
            badge = null
        } = productData;

        // Validate and sanitize price
        const sanitizedPrice = parseInt(price, 10);
        if (isNaN(sanitizedPrice) || sanitizedPrice <= 0) {
            throw new Error('Invalid price: must be a positive number');
        }

        const id = `lv-${uuidv4().slice(0, 8)}`;
        const slug = await this.ensureUniqueSlug(this.generateSlug(name));

        // Upload images to Cloudinary
        let images = [];
        if (imageFiles.length > 0) {
            const uploadResults = await uploadMultipleImages(imageFiles, 'products');
            images = uploadResults.map((result, index) => ({
                src: result.secure_url,
                alt: `${name} - Image ${index + 1}`
            }));
        }

        // Sanitize compareAtPrice
        let sanitizedCompareAtPrice = null;
        if (compareAtPrice) {
            const parsed = parseInt(compareAtPrice, 10);
            if (!isNaN(parsed) && parsed > 0) {
                sanitizedCompareAtPrice = parsed;
            }
        }

        const product = {
            id,
            name,
            slug,
            category,
            price: sanitizedPrice,
            compare_at_price: sanitizedCompareAtPrice,
            description,
            features: JSON.stringify(features),
            images: JSON.stringify(images),
            colors: JSON.stringify(colors),
            sizes: JSON.stringify(sizes),
            inventory: JSON.stringify(inventory),
            tags: JSON.stringify(tags),
            badge
        };

        if (this.usePostgres) {
            await this.db.query(`
                INSERT INTO products (id, name, slug, category, price, compare_at_price, description,
                    features, images, colors, sizes, inventory, tags, badge)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            `, Object.values(product));
        } else {
            this.db.prepare(`
                INSERT INTO products (id, name, slug, category, price, compare_at_price, description,
                    features, images, colors, sizes, inventory, tags, badge)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(...Object.values(product));
        }

        return this.getById(id);
    }

    /**
     * Update a product
     */
    async update(id, productData, imageFiles = [], imagesToDelete = []) {
        const existing = await this.getById(id);
        if (!existing) throw new Error('Product not found');

        const {
            name,
            category,
            price,
            compareAtPrice,
            description,
            features,
            colors,
            sizes,
            inventory,
            tags,
            badge,
            keepImages = []
        } = productData;

        // Helper to handle JSON strings or objects
        const safeParse = (val, fallback = []) => {
            if (!val) return fallback;
            if (typeof val === 'string') {
                try { return JSON.parse(val); } catch (e) { return fallback; }
            }
            return val;
        };

        // Delete removed images from Cloudinary
        if (imagesToDelete.length > 0) {
            const publicIds = imagesToDelete
                .map(url => getPublicIdFromUrl(url))
                .filter(Boolean);
            if (publicIds.length > 0) {
                await deleteMultipleImages(publicIds);
            }
        }

        // Upload new images
        let images = [];
        
        // Keep existing images that weren't deleted
        if (keepImages.length > 0) {
            images = existing.images.filter(img => keepImages.includes(img.src));
        }

        // Add new images
        if (imageFiles.length > 0) {
            const uploadResults = await uploadMultipleImages(imageFiles, 'products');
            const newImages = uploadResults.map((result, index) => ({
                src: result.secure_url,
                alt: `${name || existing.name} - Image ${images.length + index + 1}`
            }));
            images = [...images, ...newImages];
        }

        // Generate new slug if name changed
        let slug = existing.slug;
        if (name && name !== existing.name) {
            slug = await this.ensureUniqueSlug(this.generateSlug(name), id);
        }

        // Sanitize numeric inputs
        let sanitizedPrice = existing.price;
        if (price !== undefined && price !== null && price !== '') {
            const parsed = parseInt(price, 10);
            if (!isNaN(parsed)) sanitizedPrice = parsed;
        }

        let sanitizedCompareAtPrice = existing.compareAtPrice;
        if (compareAtPrice !== undefined) {
            if (compareAtPrice === null || compareAtPrice === '') {
                sanitizedCompareAtPrice = null;
            } else {
                const parsed = parseInt(compareAtPrice, 10);
                if (!isNaN(parsed)) sanitizedCompareAtPrice = parsed;
            }
        }

        const product = {
            name: name || existing.name,
            slug,
            category: category || existing.category,
            price: sanitizedPrice,
            compare_at_price: sanitizedCompareAtPrice,
            description: description !== undefined ? description : existing.description,
            features: JSON.stringify(safeParse(features, existing.features)),
            images: JSON.stringify(images),
            colors: JSON.stringify(safeParse(colors, existing.colors)),
            sizes: JSON.stringify(safeParse(sizes, existing.sizes)),
            inventory: JSON.stringify(safeParse(inventory, existing.inventory || {})),
            tags: JSON.stringify(safeParse(tags, existing.tags)),
            badge: badge !== undefined ? badge : existing.badge,
            id
        };

        if (this.usePostgres) {
            await this.db.query(`
                UPDATE products SET
                    name = $1,
                    slug = $2,
                    category = $3,
                    price = $4,
                    compare_at_price = $5,
                    description = $6,
                    features = $7,
                    images = $8,
                    colors = $9,
                    sizes = $10,
                    inventory = $11,
                    tags = $12,
                    badge = $13
                WHERE id = $14
            `, Object.values(product));
        } else {
            this.db.prepare(`
                UPDATE products SET
                    name = ?,
                    slug = ?,
                    category = ?,
                    price = ?,
                    compare_at_price = ?,
                    description = ?,
                    features = ?,
                    images = ?,
                    colors = ?,
                    sizes = ?,
                    inventory = ?,
                    tags = ?,
                    badge = ?
                WHERE id = ?
            `).run(...Object.values(product));
        }

        return this.getById(id);
    }

    /**
     * Delete a product
     */
    async delete(id) {
        const product = await this.getById(id);
        if (!product) throw new Error('Product not found');

        // Delete images from Cloudinary
        if (product.images.length > 0) {
            const publicIds = product.images
                .map(img => getPublicIdFromUrl(img.src))
                .filter(Boolean);
            if (publicIds.length > 0) {
                await deleteMultipleImages(publicIds);
            }
        }

        if (this.usePostgres) {
            await this.db.query('DELETE FROM products WHERE id = $1', [id]);
        } else {
            this.db.prepare('DELETE FROM products WHERE id = ?').run(id);
        }

        return { success: true, deletedId: id };
    }

    /**
     * Parse product data from database
     */
    parseProduct(row) {
        const parseJson = (val) => {
            if (typeof val === 'string') {
                try {
                    return JSON.parse(val);
                } catch {
                    return [];
                }
            }
            return val || [];
        };

        return {
            id: row.id,
            name: row.name,
            slug: row.slug,
            category: row.category,
            price: row.price,
            compareAtPrice: row.compare_at_price,
            description: row.description,
            features: parseJson(row.features),
            images: parseJson(row.images),
            colors: parseJson(row.colors),
            sizes: parseJson(row.sizes),
            inventory: parseJson(row.inventory),
            tags: parseJson(row.tags),
            badge: row.badge,
            createdAt: row.created_at
        };
    }

    /**
     * Get product statistics
     */
    async getStats() {
        let result;
        if (this.usePostgres) {
            result = await this.db.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as new_last_30_days
                FROM products
            `);
        } else {
            result = this.db.prepare(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) as new_last_30_days
                FROM products
            `).get();
            result = { rows: [result] };
        }

        const stats = {
            totalProducts: parseInt(result.rows[0].total) || 0,
            newLast30Days: parseInt(result.rows[0].new_last_30_days) || 0
        };
        
        return stats;
    }
}

export default ProductService;
