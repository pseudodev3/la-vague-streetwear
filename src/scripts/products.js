/**
 * LA VAGUE - Storefront reference data
 * Sellable products and inventory always come from the live API.
 */

const CATEGORIES = [
    { id: 'all', name: 'All Products', slug: 'all' },
    { id: 'hoodies', name: 'Hoodies', slug: 'hoodies' },
    { id: 'tees', name: 'T-Shirts', slug: 'tees' },
    { id: 'bottoms', name: 'Bottoms', slug: 'bottoms' },
    { id: 'accessories', name: 'Accessories', slug: 'accessories' }
];

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

const ProductAPI = Object.freeze({
    getSizeGuide(type) {
        return SIZE_GUIDES[type] || null;
    }
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CATEGORIES, SIZE_GUIDES, ProductAPI };
}
