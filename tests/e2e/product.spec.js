import { test, expect } from '@playwright/test';
import { mockStoreProduct, mockStorefrontAPI } from '../helpers/e2e-storefront.js';

test.describe('Product page', () => {
  test.beforeEach(async ({ page }) => {
    await mockStorefrontAPI(page);
    await page.goto(`/product.html?slug=${mockStoreProduct.slug}`);
    await expect(page.locator('#productContent')).toBeVisible();
  });

  test('renders live product data in NGN', async ({ page }) => {
    await expect(page.locator('#productTitle')).toHaveText(mockStoreProduct.name);
    await expect(page.locator('#productPrice')).toContainText('₦145,000');
    await expect(page.locator('#mainImage')).toHaveAttribute('src', /hoodie\.jpg/);
  });

  test('renders color and size controls without inline script handlers', async ({ page }) => {
    const color = page.locator('#colorSelector [data-product-action="select-color"]').first();
    const size = page.locator('#sizeSelector [data-product-action="select-size"]').first();

    await expect(color).toBeVisible();
    await expect(size).toBeVisible();
    await expect(color).not.toHaveAttribute('onclick');
    await expect(size).not.toHaveAttribute('onclick');
  });

  test('adds an in-stock product through the shared cart gate', async ({ page }) => {
    await page.locator('#sizeSelector [data-product-action="select-size"]').first().click();
    await page.locator('#addToCartBtn').click();

    await expect(page.locator('#cartCount')).toHaveText('1');
    const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('cart') || '[]'));
    expect(cart).toHaveLength(1);
    expect(cart[0]).toMatchObject({ id: mockStoreProduct.id, color: 'Black', quantity: 1 });
  });

  test('opens the size guide through event listeners', async ({ page }) => {
    await page.locator('#sizeGuideBtn').click();
    await expect(page.locator('#sizeGuideModal')).toHaveClass(/active/);
    await expect(page.locator('#sizeGuideContent')).toContainText('Oversized Fit');
  });

  test('renders related products as safe links', async ({ page }) => {
    const related = page.locator('#relatedGrid .product-card').first();
    await expect(related).toBeVisible();
    await expect(related).toHaveAttribute('href', /product\.html\?slug=/);
    await expect(related).not.toHaveAttribute('onclick');
  });
});
