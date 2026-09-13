import { query } from '../src/config/db.js';
import { cacheService } from '../src/utils/cache.js';

async function recalculateAll() {
    console.log('🔄 Starting bulk ratings recalculation...');
    
    try {
        const productsResult = await query('SELECT id, name FROM products');
        let updated = 0;
        
        for (const product of productsResult.rows) {
            const statsResult = await query(`
                SELECT 
                    COALESCE(AVG(rating), 0) as average_rating,
                    COUNT(*) as review_count
                FROM reviews 
                WHERE product_id = $1 AND status = 'approved'
            `, [product.id]);
            
            const averageRating = parseFloat(statsResult.rows[0].average_rating) || 0;
            const reviewCount = parseInt(statsResult.rows[0].review_count) || 0;
            
            await query(`
                UPDATE products 
                SET average_rating = $1, review_count = $2 
                WHERE id = $3
            `, [averageRating, reviewCount, product.id]);
            
            console.log(`✅ Updated ${product.name}: ${averageRating.toFixed(1)} (${reviewCount} reviews)`);
            updated++;
        }
        
        // Clear cache if possible
        try {
            cacheService.del('products_all');
            console.log('🧹 Cache cleared');
        } catch (e) {
            // Might fail if run standalone without full env
        }
        
        console.log(`\n✨ Successfully recalculated ratings for ${updated} products.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during recalculation:', error);
        process.exit(1);
    }
}

recalculateAll();
