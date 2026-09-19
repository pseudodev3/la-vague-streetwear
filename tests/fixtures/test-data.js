/**
 * LA VAGUE - Test Data Fixtures
 * Mock data for unit and E2E tests
 */

// ==========================================
// MOCK PRODUCTS
// ==========================================
export const mockProducts = [
  {
    id: 'lv-hoodie-001',
    name: 'Classic Oversized Hoodie',
    slug: 'classic-oversized-hoodie',
    category: 'hoodies',
    price: 145,
    compareAtPrice: null,
    description: 'Crafted from 450gsm heavyweight cotton, our signature hoodie features a relaxed oversized fit.',
    features: ['450gsm 100% Organic Cotton', 'Double-layered hood', 'Embroidered logo detail'],
    images: [
      { src: 'https://example.com/hoodie-black.jpg', alt: 'Classic Oversized Hoodie - Black' },
      { src: 'https://example.com/hoodie-grey.jpg', alt: 'Classic Oversized Hoodie - Grey' }
    ],
    colors: [
      { name: 'Black', value: '#0a0a0a', imageIndex: 0 },
      { name: 'Ash Grey', value: '#8a8a8a', imageIndex: 1 }
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    inventory: {
      'Black-XS': 12, 'Black-S': 25, 'Black-M': 30, 'Black-L': 28,
      'Ash Grey-XS': 8, 'Ash Grey-S': 15, 'Ash Grey-M': 22
    },
    tags: ['bestseller', 'signature'],
    badge: 'Bestseller'
  },
  {
    id: 'lv-tee-001',
    name: 'Wave Box Logo Tee',
    slug: 'wave-box-logo-tee',
    category: 'tees',
    price: 65,
    compareAtPrice: null,
    description: 'The essential LA VAGUE tee. Heavyweight 240gsm cotton with our iconic box logo print.',
    features: ['240gsm heavyweight cotton', 'Pre-shrunk', 'Screen printed logo'],
    images: [
      { src: 'https://example.com/tee-white.jpg', alt: 'Wave Box Logo Tee - White' },
      { src: 'https://example.com/tee-black.jpg', alt: 'Wave Box Logo Tee - Black' }
    ],
    colors: [
      { name: 'White', value: '#ffffff', imageIndex: 0 },
      { name: 'Black', value: '#0a0a0a', imageIndex: 1 }
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    inventory: {
      'White-XS': 20, 'White-S': 35, 'White-M': 50,
      'Black-XS': 18, 'Black-S': 32, 'Black-M': 48
    },
    tags: ['bestseller', 'essential'],
    badge: 'Essential'
  },
  {
    id: 'lv-bottom-001',
    name: 'Utility Cargo Pants',
    slug: 'utility-cargo-pants',
    category: 'bottoms',
    price: 135,
    compareAtPrice: null,
    description: 'Functional cargo pants with multiple pockets and adjustable hem.',
    features: ['320gsm cotton twill', '6 pockets total', 'Adjustable drawstring hem'],
    images: [
      { src: 'https://example.com/cargo-olive.jpg', alt: 'Utility Cargo Pants - Olive' },
      { src: 'https://example.com/cargo-black.jpg', alt: 'Utility Cargo Pants - Black' }
    ],
    colors: [
      { name: 'Olive', value: '#4a5d23', imageIndex: 0 },
      { name: 'Black', value: '#0a0a0a', imageIndex: 1 }
    ],
    sizes: ['28', '30', '32', '34', '36', '38'],
    inventory: {
      'Olive-28': 5, 'Olive-30': 12, 'Olive-32': 18,
      'Black-28': 8, 'Black-30': 15, 'Black-32': 22
    },
    tags: ['bestseller'],
    badge: 'Bestseller'
  },
  {
    id: 'lv-acc-001',
    name: 'Wave Logo Cap',
    slug: 'wave-logo-cap',
    category: 'accessories',
    price: 45,
    compareAtPrice: null,
    description: 'Classic 6-panel cap with embroidered wave logo.',
    features: ['Cotton twill construction', 'Embroidered front logo', 'Adjustable strapback'],
    images: [
      { src: 'https://example.com/cap-black.jpg', alt: 'Wave Logo Cap - Black' }
    ],
    colors: [
      { name: 'Black', value: '#0a0a0a', imageIndex: 0 }
    ],
    sizes: ['OS'],
    inventory: {
      'Black-OS': 50
    },
    tags: ['accessories'],
    badge: null
  },
  {
    id: 'lv-tee-002',
    name: 'Vintage Wash Graphic Tee',
    slug: 'vintage-wash-graphic-tee',
    category: 'tees',
    price: 75,
    compareAtPrice: 85,
    description: 'Vintage-inspired graphic tee with enzyme wash.',
    features: ['200gsm cotton', 'Enzyme washed', 'Distressed print'],
    images: [
      { src: 'https://example.com/vintage-black.jpg', alt: 'Vintage Wash Graphic Tee' }
    ],
    colors: [
      { name: 'Washed Black', value: '#2a2a2a', imageIndex: 0 }
    ],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    inventory: {
      'Washed Black-S': 12, 'Washed Black-M': 18, 'Washed Black-L': 22
    },
    tags: ['sale', 'limited'],
    badge: 'Sale'
  }
];

// ==========================================
// MOCK CART ITEMS
// ==========================================
export const mockCartItems = [
  {
    id: 'lv-hoodie-001',
    name: 'Classic Oversized Hoodie',
    price: 145,
    image: 'https://example.com/hoodie-black.jpg',
    color: 'Black',
    size: 'L',
    quantity: 1
  },
  {
    id: 'lv-tee-001',
    name: 'Wave Box Logo Tee',
    price: 65,
    image: 'https://example.com/tee-white.jpg',
    color: 'White',
    size: 'M',
    quantity: 2
  },
  {
    id: 'lv-bottom-001',
    name: 'Utility Cargo Pants',
    price: 135,
    image: 'https://example.com/cargo-olive.jpg',
    color: 'Olive',
    size: '32',
    quantity: 1
  }
];

// ==========================================
// MOCK CATEGORIES
// ==========================================
export const mockCategories = [
  { id: 'all', name: 'All Products', slug: 'all' },
  { id: 'hoodies', name: 'Hoodies', slug: 'hoodies' },
  { id: 'tees', name: 'T-Shirts', slug: 'tees' },
  { id: 'bottoms', name: 'Bottoms', slug: 'bottoms' },
  { id: 'accessories', name: 'Accessories', slug: 'accessories' }
];

// ==========================================
// MOCK CHECKOUT DATA
// ==========================================
export const mockCheckoutData = {
  customerEmail: 'test@example.com',
  customerName: 'John Doe',
  customerPhone: '+1 (555) 123-4567',
  shippingAddress: {
    address: '123 Test Street',
    apartment: 'Apt 4B',
    city: 'New York',
    state: 'NY',
    zip: '10001'
  },
  shippingMethod: 'standard',
  shippingCost: 10,
  subtotal: 410,
  discount: 0,
  total: 420,
  items: mockCartItems,
  paymentMethod: 'manual'
};

// ==========================================
// MOCK DISCOUNT CODES
// ==========================================
export const mockDiscountCodes = {
  'WELCOME10': 10,
  'WAVE20': 20,
  'FREESHIP': 0  // Free shipping
};

// ==========================================
// MOCK ADMIN CREDENTIALS (TEST ONLY)
// ==========================================
export const mockAdminCredentials = {
  username: 'admin',
  password: 'testpassword123'
};

// ==========================================
// MOCK ORDERS
// ==========================================
export const mockOrders = [
  {
    id: 'LV-TEST-001',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '+1 (555) 123-4567',
    address: '123 Test Street',
    city: 'New York',
    state: 'NY',
    zip: '10001',
    subtotal: 275,
    shippingCost: 10,
    discount: 0,
    total: 285,
    items: [
      { id: 'lv-hoodie-001', name: 'Classic Oversized Hoodie', price: 145, quantity: 1, color: 'Black', size: 'L' },
      { id: 'lv-tee-001', name: 'Wave Box Logo Tee', price: 65, quantity: 2, color: 'White', size: 'M' }
    ],
    status: 'pending',
    date: new Date().toISOString()
  }
];

// ==========================================
// SIZE GUIDES
// ==========================================
export const mockSizeGuides = {
  regular: {
    name: 'Regular Fit',
    unit: 'inches',
    measurements: [
      { size: 'XS', chest: '34-36', length: '26', sleeve: '7.5' },
      { size: 'S', chest: '36-38', length: '27', sleeve: '8' },
      { size: 'M', chest: '38-40', length: '28', sleeve: '8.5' },
      { size: 'L', chest: '40-42', length: '29', sleeve: '9' },
      { size: 'XL', chest: '42-44', length: '30', sleeve: '9.5' }
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
      { size: 'XL', chest: '48-50', length: '32', sleeve: '24' }
    ]
  }
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Create a mock cart item
 */
export function createMockCartItem(overrides = {}) {
  return {
    id: 'lv-test-001',
    name: 'Test Product',
    price: 100,
    image: 'https://example.com/test.jpg',
    color: 'Black',
    size: 'M',
    quantity: 1,
    ...overrides
  };
}

/**
 * Create mock checkout form data
 */
export function createMockCheckoutData(overrides = {}) {
  return {
    ...mockCheckoutData,
    ...overrides
  };
}

/**
 * Calculate cart totals
 */
export function calculateCartTotals(items) {
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shipping = subtotal >= 150 ? 0 : 10;
  const total = subtotal + shipping;
  return { subtotal, shipping, total };
}
