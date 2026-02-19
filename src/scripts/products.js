/**
 * LA VAGUE - Product Catalog
 * Complete product data structure for streetwear e-commerce
 */

const PRODUCTS = [
    {
        id: 'lv-hoodie-001',
        name: 'Classic Oversized Hoodie',
        slug: 'classic-oversized-hoodie',
        category: 'hoodies',
        price: 35000,
        compareAtPrice: null,
        description: 'Crafted from 450gsm heavyweight cotton, our signature hoodie features a relaxed oversized fit, dropped shoulders, and our embroidered wave logo. Built to last, designed to stand out.',
        features: [
            '450gsm 100% Organic Cotton',
            'Double-layered hood',
            'Embroidered logo detail',
            'Made in Nigeria',
            'Oversized fit'
        ],
        images: [
            { src: '/assets/hoodie.jpg', alt: 'Classic Oversized Hoodie - Black' },
            { src: '/assets/hoodie2.jpg', alt: 'Classic Oversized Hoodie - Detail' },
            { src: '/assets/hoodie3.jpg', alt: 'Classic Oversized Hoodie - Fit' }
        ],
        colors: [
            { name: 'Black', value: '#0a0a0a', imageIndex: 0 },
            { name: 'Ash Grey', value: '#8a8a8a', imageIndex: 1 },
            { name: 'Cream', value: '#f5f5dc', imageIndex: 2 }
        ],
        sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        sizeGuide: 'oversized',
        inventory: {
            'Black-XS': 12, 'Black-S': 25, 'Black-M': 30, 'Black-L': 28, 'Black-XL': 20, 'Black-XXL': 8,
            'Ash Grey-XS': 8, 'Ash Grey-S': 15, 'Ash Grey-M': 22, 'Ash Grey-L': 18, 'Ash Grey-XL': 12, 'Ash Grey-XXL': 5,
            'Cream-XS': 5, 'Cream-S': 10, 'Cream-M': 15, 'Cream-L': 12, 'Cream-XL': 8, 'Cream-XXL': 3
        },
        tags: ['bestseller', 'signature'],
        badge: 'Bestseller',
        meta: {
            title: 'Classic Oversized Hoodie | LA VAGUE',
            description: 'Premium 450gsm heavyweight cotton hoodie. Oversized fit with embroidered wave logo. Made in Nigeria.'
        }
    },
    {
        id: 'lv-hoodie-002',
        name: 'Wave Logo Zip Hoodie',
        slug: 'wave-logo-zip-hoodie',
        category: 'hoodies',
        price: 38500,
        compareAtPrice: null,
        description: 'Full-zip hoodie featuring our signature wave logo across the back. Premium heavyweight cotton with brushed interior for ultimate comfort.',
        features: [
            '420gsm heavyweight cotton',
            'Brushed fleece interior',
            'Oversized back print',
            'YKK zipper',
            'Made in Nigeria'
        ],
        images: [
            { src: '/assets/hoodie2.jpg', alt: 'Wave Logo Zip Hoodie' },
            { src: '/assets/hoodie3.jpg', alt: 'Wave Logo Zip Hoodie - Detail' }
        ],
        colors: [
            { name: 'Black', value: '#0a0a0a', imageIndex: 0 },
            { name: 'Heather Grey', value: '#6a6a6a', imageIndex: 1 }
        ],
        sizes: ['S', 'M', 'L', 'XL', 'XXL'],
        sizeGuide: 'oversized',
        inventory: {
            'Black-S': 15, 'Black-M': 20, 'Black-L': 25, 'Black-XL': 18, 'Black-XXL': 10,
            'Heather Grey-S': 10, 'Heather Grey-M': 15, 'Heather Grey-L': 12, 'Heather Grey-XL': 8, 'Heather Grey-XXL': 5
        },
        tags: ['new', 'signature', 'bestseller'],
        badge: 'New',
        meta: {
            title: 'Wave Logo Zip Hoodie | LA VAGUE',
            description: 'Full-zip hoodie with oversized back print. Premium heavyweight cotton with YKK zipper.'
        }
    },
    {
        id: 'lv-tee-001',
        name: 'Wave Box Logo Tee',
        slug: 'wave-box-logo-tee',
        category: 'tees',
        price: 18500,
        compareAtPrice: null,
        description: 'The essential LA VAGUE tee. Heavyweight 240gsm cotton with our iconic box logo print. Pre-shrunk for the perfect fit wash after wash.',
        features: [
            '240gsm heavyweight cotton',
            'Pre-shrunk',
            'Screen printed logo',
            'Reinforced collar',
            'Made in Nigeria'
        ],
        images: [
            { src: '/assets/tshirts.jpg', alt: 'Wave Box Logo Tee - White' },
            { src: '/assets/hoodie.jpg', alt: 'Wave Box Logo Tee - Black' }
        ],
        colors: [
            { name: 'White', value: '#ffffff', imageIndex: 0 },
            { name: 'Black', value: '#0a0a0a', imageIndex: 1 }
        ],
        sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        sizeGuide: 'regular',
        inventory: {
            'White-XS': 20, 'White-S': 35, 'White-M': 50, 'White-L': 45, 'White-XL': 30, 'White-XXL': 15,
            'Black-XS': 18, 'Black-S': 32, 'Black-M': 48, 'Black-L': 42, 'Black-XL': 28, 'Black-XXL': 12
        },
        tags: ['bestseller', 'essential'],
        badge: 'Essential',
        meta: {
            title: 'Wave Box Logo Tee | LA VAGUE',
            description: 'Essential heavyweight tee with iconic box logo. 240gsm cotton, pre-shrunk, made in Nigeria.'
        }
    },
    {
        id: 'lv-bottom-001',
        name: 'Utility Cargo Pants',
        slug: 'utility-cargo-pants',
        category: 'bottoms',
        price: 32500,
        compareAtPrice: null,
        description: 'Functional cargo pants with multiple pockets and adjustable hem. Relaxed fit with a slight taper. Premium cotton twill construction.',
        features: [
            '320gsm cotton twill',
            '6 pockets total',
            'Adjustable drawstring hem',
            'Relaxed taper fit',
            'Made in Nigeria'
        ],
        images: [
            { src: '/assets/bottoms.jpg', alt: 'Utility Cargo Pants - Black' },
            { src: '/assets/bottoms.jpg', alt: 'Utility Cargo Pants - Detail' }
        ],
        colors: [
            { name: 'Olive', value: '#4a5d23', imageIndex: 0 },
            { name: 'Black', value: '#0a0a0a', imageIndex: 1 }
        ],
        sizes: ['28', '30', '32', '34', '36', '38'],
        sizeGuide: 'pants',
        inventory: {
            'Olive-28': 5, 'Olive-30': 12, 'Olive-32': 18, 'Olive-34': 15, 'Olive-36': 8, 'Olive-38': 4,
            'Black-28': 8, 'Black-30': 15, 'Black-32': 22, 'Black-34': 18, 'Black-36': 10, 'Black-38': 5
        },
        tags: ['bestseller', 'signature'],
        badge: 'Bestseller',
        meta: {
            title: 'Utility Cargo Pants | LA VAGUE',
            description: 'Functional cargo pants with 6 pockets and adjustable hem. Premium cotton twill, made in Nigeria.'
        }
    }
];

// Category definitions
const CATEGORIES = [
    { id: 'all', name: 'All Products', slug: 'all' },
    { id: 'hoodies', name: 'Hoodies', slug: 'hoodies' },
    { id: 'tees', name: 'T-Shirts', slug: 'tees' },
    { id: 'bottoms', name: 'Bottoms', slug: 'bottoms' },
    { id: 'accessories', name: 'Accessories', slug: 'accessories' }
];

// Size guides
const SIZE_GUIDES = {
    regular: {
        name: 'Regular Fit',
        unit: 'inches',
        measurements: [
            { size: 'XS', chest: '34-36', length: '26', sleeve: '7.5' },
            { size: 'S', chest: '36-38', length: '27', sleeve: '8' },
            { size: 'M', chest: '38-40', length: '28', sleeve: '8.5' },
            { size: 'L', chest: '40-42', length: '29', sleeve: '9' },
            { size: 'XL', chest: '42-44', length: '30', sleeve: '9.5' },
            { size: 'XXL', chest: '44-46', length: '31', sleeve: '10' }
        ]
    },
    oversized: {
        name: 'Oversized Fit',
        unit: 'inches',
        measurements: [
            { size: 'XS', chest: '40-42', length: '28', sleeve: '22' },
            { size: 'S', chest: '42-44', length: '29', sleeve: '22.5' },
            { size: 'M', chest: '44-46', length: '30', sleeve: '23' },
            { size: 'L', chest: '46-48', length: '31', sleeve: '23.5' },
            { size: 'XL', chest: '48-50', length: '32', sleeve: '24' },
            { size: 'XXL', chest: '50-52', length: '33', sleeve: '24.5' }
        ]
    },
    pants: {
        name: 'Bottoms',
        unit: 'inches',
        measurements: [
            { size: '28', waist: '28', inseam: '30', hip: '36' },
            { size: '30', waist: '30', inseam: '30', hip: '38' },
            { size: '32', waist: '32', inseam: '30', hip: '40' },
            { size: '34', waist: '34', inseam: '30', hip: '42' },
            { size: '36', waist: '36', inseam: '30', hip: '44' },
            { size: '38', waist: '38', inseam: '30', hip: '46' }
        ]
    }
};

// Helper functions
const ProductAPI = {
    getAll: () => PRODUCTS,
    
    getById: (id) => PRODUCTS.find(p => p.id === id),
    
    getBySlug: (slug) => PRODUCTS.find(p => p.slug === slug),
    
    getByCategory: (category) => {
        if (category === 'all') return PRODUCTS;
        return PRODUCTS.filter(p => p.category === category);
    },
    
    getFeatured: () => PRODUCTS.filter(p => p.tags.includes('bestseller')),
    
    getNewArrivals: () => PRODUCTS.filter(p => p.tags.includes('new')),
    
    getSale: () => PRODUCTS.filter(p => p.compareAtPrice !== null),
    
    search: (query) => {
        const lowerQuery = query.toLowerCase();
        return PRODUCTS.filter(p => 
            p.name.toLowerCase().includes(lowerQuery) ||
            p.description.toLowerCase().includes(lowerQuery) ||
            p.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    },
    
    checkInventory: (productId, color, size) => {
        const product = PRODUCTS.find(p => p.id === productId);
        if (!product) return 0;
        const key = `${color}-${size}`;
        return product.inventory[key] || 0;
    },
    
    getRelated: (productId, limit = 4) => {
        const product = PRODUCTS.find(p => p.id === productId);
        if (!product) return [];
        return PRODUCTS
            .filter(p => p.category === product.category && p.id !== productId)
            .slice(0, limit);
    },
    
    getCategories: () => CATEGORIES,
    
    getSizeGuide: (type) => SIZE_GUIDES[type] || null
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PRODUCTS, CATEGORIES, SIZE_GUIDES, ProductAPI };
}
