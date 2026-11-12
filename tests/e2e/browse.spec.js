import { test, expect } from '@playwright/test';
import { mockStoreProducts, mockStorefrontAPI } from '../helpers/e2e-storefront.js';

const productNames = products => products.map(product => product.name);

test.describe('Product browsing', () => {
  test.beforeEach(async ({ page }) => {
    await mockStorefrontAPI(page);
    await page.goto('/shop.html');
    await page.locator('#cookie-accept-btn').click();
    await expect(page.locator('#productsGrid .product-card')).toHaveCount(mockStoreProducts.length);
  });

  test('renders the full catalog with names, NGN prices and images', async ({ page }) => {
    await expect(page.locator('.shop-title')).toContainText('Shop');
    await expect(page.locator('#productsGrid .product-name')).toHaveText(productNames(mockStoreProducts));
    await expect(page.locator('#resultsCount')).toHaveText(`${mockStoreProducts.length} products`);

    for (const product of mockStoreProducts) {
      const card = page.locator(`[data-product-id="${product.id}"].product-card`);
      await expect(card.locator('.current-price')).toHaveText(`₦${product.price.toLocaleString('en-US')}`);
      await expect(card.locator('img.product-image')).toHaveAttribute('src', new RegExp(`${product.images[0].src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    }
  });

  test('opens and closes the filter sidebar', async ({ page }) => {
    await page.locator('#filterToggle').click();
    await expect(page.locator('#filterSidebar')).toHaveClass(/active/);
    await page.locator('#filterClose').click();
    await expect(page.locator('#filterSidebar')).not.toHaveClass(/active/);
  });

  for (const category of ['hoodies', 'tees', 'bottoms', 'accessories']) {
    test(`filters the catalog to ${category}`, async ({ page }) => {
      const expected = mockStoreProducts.filter(product => product.category === category);
      expect(expected.length).toBeGreaterThan(0);

      await page.locator('#filterToggle').click();
      await page.locator(`input[name="mobile-category"][value="${category}"]`).check();
      await page.locator('#applyFilters').click();

      await expect(page.locator('#productsGrid .product-name')).toHaveText(productNames(expected));
      await expect(page.locator('#filterSidebar')).not.toHaveClass(/active/);
    });
  }

  test('applies a maximum price and restores it with Clear All', async ({ page }) => {
    const maximumPrice = 100000;
    const expected = mockStoreProducts.filter(product => product.price <= maximumPrice);
    expect(expected.length).toBeGreaterThan(0);
    expect(expected.length).toBeLessThan(mockStoreProducts.length);

    await page.locator('#filterToggle').click();
    const slider = page.locator('#priceRange');
    await slider.focus();
    await slider.press('Home');
    for (let step = 0; step < maximumPrice / 5000; step += 1) {
      await slider.press('ArrowRight');
    }
    await expect(page.locator('#priceValue')).toHaveText('₦100,000');
    await page.locator('#applyFilters').click();
    await expect(page.locator('#productsGrid .product-name')).toHaveText(productNames(expected));

    await page.locator('#filterToggle').click();
    await page.locator('#clearFilters').click();
    await expect(slider).toHaveValue('500000');
    await page.locator('#applyFilters').click();
    await expect(page.locator('#productsGrid .product-name')).toHaveText(productNames(mockStoreProducts));
  });

  test('filters products on sale', async ({ page }) => {
    const expected = mockStoreProducts.filter(product => product.compare_at_price != null);
    expect(expected.length).toBeGreaterThan(0);

    await page.locator('#filterToggle').click();
    await page.locator('#filterSale').check();
    await page.locator('#applyFilters').click();

    await expect(page.locator('#productsGrid .product-name')).toHaveText(productNames(expected));
    await expect(page.locator('#productsGrid .original-price')).toHaveCount(expected.length);
  });

  for (const [order, direction] of [['price-low', 1], ['price-high', -1]]) {
    test(`sorts by ${order}`, async ({ page }) => {
      const sorted = [...mockStoreProducts].sort((a, b) => direction * (a.price - b.price));
      await page.locator('#sortSelect').selectOption(order);
      await expect(page.locator('#productsGrid .product-name')).toHaveText(productNames(sorted));
    });
  }

  test('searches within the search overlay and links to a product', async ({ page }) => {
    const expected = mockStoreProducts.filter(product => product.name.toLowerCase().includes('hoodie'));
    expect(expected.length).toBeGreaterThan(0);

    await page.locator('#searchBtn').click();
    await page.locator('#searchInput').fill('hoodie');
    await expect(page.locator('#searchResults h4')).toHaveText(productNames(expected));
    await expect(page.locator('#productsGrid .product-card')).toHaveCount(mockStoreProducts.length);

    await page.locator('#searchResults .search-result-item').first().click();
    await expect(page).toHaveURL(new RegExp(`product\\.html\\?slug=${expected[0].slug}$`));
    await expect(page.locator('#productTitle')).toHaveText(expected[0].name);
  });

  test('shows an empty search message and clears search results', async ({ page }) => {
    await page.locator('#searchBtn').click();
    await page.locator('#searchInput').fill('xyznonexistent123');
    await expect(page.locator('#searchResults .search-message')).toContainText('No products found');
    await expect(page.locator('#searchResults .search-result-item')).toHaveCount(0);

    await page.locator('#searchInput').fill('hoodie');
    await expect(page.locator('#searchResults .search-result-item').first()).toBeVisible();
    await page.locator('#searchInput').fill('');
    await expect(page.locator('#searchResults')).toBeEmpty();
    await page.locator('#searchClose').click();
    await expect(page.locator('#searchOverlay')).not.toHaveClass(/active/);
  });

  test('opens a product from its catalog card', async ({ page }) => {
    const product = mockStoreProducts[0];
    await page.locator('#productsGrid .product-name').first().click();
    await expect(page).toHaveURL(new RegExp(`product\\.html\\?slug=${product.slug}$`));
    await expect(page.locator('#productTitle')).toHaveText(product.name);
  });
});
