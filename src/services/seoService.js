import { SitemapStream, streamToPromise } from 'sitemap';
import { Readable } from 'stream';
import { query } from '../config/db.js';

const BASE_URL = process.env.FRONTEND_URL || 'https://la-vague.store';

export async function generateSitemap() {
    // Basic static pages
    const links = [
        { url: '/', changefreq: 'daily', priority: 1.0 },
        { url: '/shop', changefreq: 'daily', priority: 0.9 },
        { url: '/contact', changefreq: 'monthly', priority: 0.5 },
        { url: '/faq', changefreq: 'monthly', priority: 0.5 },
        { url: '/returns', changefreq: 'monthly', priority: 0.5 },
        { url: '/shipping', changefreq: 'monthly', priority: 0.5 },
        { url: '/privacy-policy', changefreq: 'monthly', priority: 0.3 },
        { url: '/terms-of-service', changefreq: 'monthly', priority: 0.3 }
    ];

    // Add products
    try {
        const result = await query('SELECT slug FROM products');
        result.rows.forEach(product => {
            links.push({
                url: `/product?id=${product.slug}`, // Using query param version since project has product.html
                changefreq: 'weekly',
                priority: 0.8
            });
        });
    } catch (error) {
        console.error('Failed to fetch products for sitemap:', error);
    }

    const stream = new SitemapStream({ hostname: BASE_URL });
    return streamToPromise(Readable.from(links).pipe(stream)).then(data => data.toString());
}

export function generateRobotsTxt() {
    return `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/admin
Disallow: /api/payment/webhook

Sitemap: ${BASE_URL}/sitemap.xml`;
}
