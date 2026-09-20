import { test, expect } from '@playwright/test';
import { mockStorefrontAPI, seedCheckoutCart } from '../helpers/e2e-storefront.js';

test.describe('Checkout', () => {
  test.beforeEach(async ({ page }) => {
    await mockStorefrontAPI(page);
    await seedCheckoutCart(page);
    await page.goto('/checkout.html');
    await expect(page.locator('#orderSummary')).toBeVisible();
  });

  test('renders the cart summary and totals in NGN', async ({ page }) => {
    await expect(page.locator('#summaryItems')).toContainText('Classic Oversized Hoodie');
    await expect(page.locator('#summarySubtotal')).toHaveText('₦145,000');
    await expect(page.locator('#summaryTotal')).toHaveText('₦155,000');
  });

  test('updates totals when express shipping is selected', async ({ page }) => {
    await page.locator('input[name="shipping"][value="express"]').check();
    await expect(page.locator('#summaryShipping')).toHaveText('₦25,000');
    await expect(page.locator('#summaryTotal')).toHaveText('₦170,000');
  });

  test('keeps invalid checkout on the page and shows an error', async ({ page }) => {
    await page.locator('#placeOrderBtn').click();
    await expect(page).toHaveURL(/checkout\.html/);
    await expect(page.locator('.toast.error')).toContainText('Please fill in all required fields');
  });

  test('escapes persisted cart data in the order summary', async ({ page }) => {
    await page.evaluate(() => {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      cart[0].name = '<img src=x onerror="window.__checkoutXss=true">';
      cart[0].color = '<script>window.__checkoutXss=true</script>';
      localStorage.setItem('cart', JSON.stringify(cart));
    });

    await page.reload();

    await expect(page.locator('.summary-item-name')).toContainText('<img');
    expect(await page.locator('#summaryItems [onerror]').count()).toBe(0);
    expect(await page.locator('#summaryItems script').count()).toBe(0);
    expect(await page.evaluate(() => window.__checkoutXss === true)).toBe(false);
  });

  test('redirects to Shop when the cart is empty', async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('cart'));
    await page.goto('/checkout.html');
    await expect(page).toHaveURL(/shop\.html/);
  });
});
