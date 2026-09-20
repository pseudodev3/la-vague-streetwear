export const mockStoreProduct = {
  id: 'lv-hoodie-001',
  name: 'Classic Oversized Hoodie',
  slug: 'classic-oversized-hoodie',
  category: 'hoodies',
  price: 145000,
  compare_at_price: null,
  description: 'Heavyweight oversized hoodie with embroidered LA VAGUE branding.',
  features: ['450gsm cotton', 'Double-layered hood', 'Embroidered logo'],
  images: [
    { src: '/assets/hoodie.jpg', alt: 'Classic Oversized Hoodie' },
    { src: '/assets/hoodie2.jpg', alt: 'Classic Oversized Hoodie detail' }
  ],
  colors: [{ name: 'Black', value: '#0a0a0a', imageIndex: 0 }],
  sizes: ['M', 'L'],
  inventory: { 'Black-M': 12, 'Black-L': 8 },
  tags: ['bestseller'],
  badge: 'Bestseller',
  average_rating: 4.8,
  review_count: 2
};

export const mockStoreProducts = [
  mockStoreProduct,
  {
    ...mockStoreProduct,
    id: 'lv-tee-001',
    name: 'Wave Box Logo Tee',
    slug: 'wave-box-logo-tee',
    category: 'tees',
    price: 65000,
    images: [{ src: '/assets/tshirts.jpg', alt: 'Wave Box Logo Tee' }],
    colors: [{ name: 'White', value: '#ffffff', imageIndex: 0 }],
    sizes: ['M'],
    inventory: { 'White-M': 20 },
    badge: null
  }
];

export async function mockStorefrontAPI(page) {
  await page.route('**/api/products**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.includes('/inventory/check/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, available: 12, inStock: true })
      });
      return;
    }

    if (path.endsWith('/reviews')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
      return;
    }

    if (path.includes('/reviews')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          reviews: [],
          summary: { total: 0, average: 0 }
        })
      });
      return;
    }

    const slug = path.split('/').filter(Boolean).at(-1);
    const product = mockStoreProducts.find(item => item.slug === slug);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        product
          ? { success: true, product }
          : { success: true, products: mockStoreProducts }
      )
    });
  });

  await page.route('**/api/config/settings', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        settings: {
          shippingRate: 10000,
          expressShippingRate: 25000,
          freeShippingThreshold: 150000,
          storeName: 'LA VAGUE'
        }
      })
    });
  });
}

export async function seedCheckoutCart(page) {
  await page.addInitScript(product => {
    localStorage.setItem('cart', JSON.stringify([{
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0].src,
      color: 'Black',
      size: 'M',
      quantity: 1
    }]));
  }, mockStoreProduct);
}
