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
    await page.locator('#sizeGuideClose').click();
    await expect(page.locator('#sizeGuideModal')).not.toHaveClass(/active/);
    await page.locator('#sizeGuideBtn').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#sizeGuideModal')).not.toHaveClass(/active/);
  });

  test('renders related products as safe links', async ({ page }) => {
    const related = page.locator('#relatedGrid .product-card').first();
    await expect(related).toBeVisible();
    await expect(related).toHaveAttribute('href', /product\.html\?slug=/);
    await expect(related).not.toHaveAttribute('onclick');
  });

  test('scrolls the review modal cleanly so the Submit Review button is reachable on desktop and mobile', async ({ page }) => {
    await page.locator('#writeReviewBtn').scrollIntoViewIfNeeded();
    await page.locator('#writeReviewBtn').click();

    const modal = page.locator('#reviewModal');
    const content = page.locator('#reviewModal .review-modal-content');
    const submitBtn = page.locator('#reviewForm button[type="submit"]');

    await expect(modal).toHaveClass(/active/);
    await expect(content).toHaveCSS('overflow-y', 'auto');

    await submitBtn.scrollIntoViewIfNeeded();
    await expect(submitBtn).toBeVisible();

    const bounds = await page.evaluate(() => {
      const m = document.getElementById('reviewModal').getBoundingClientRect();
      const b = document.querySelector('#reviewForm button[type="submit"]').getBoundingClientRect();
      return {
        modalBottom: m.bottom,
        btnTop: b.top,
        btnBottom: b.bottom,
        viewportHeight: window.innerHeight
      };
    });

    expect(bounds.btnBottom).toBeLessThanOrEqual(bounds.modalBottom + 2);
    expect(bounds.btnBottom).toBeLessThanOrEqual(bounds.viewportHeight + 2);

    await page.locator('#reviewModalCloseX').click();
    await expect(modal).not.toHaveClass(/active/);
  });
});
