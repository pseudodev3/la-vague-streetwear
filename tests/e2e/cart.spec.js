import { test, expect } from '@playwright/test';
import { mockStorefrontAPI } from '../helpers/e2e-storefront.js';

async function addFirstProduct(page) {
  await page.goto('/shop.html');
  const addButton = page.locator('[data-shop-action="add-to-cart"]').first();
  await expect(addButton).toBeVisible();
  await addButton.click();
  await expect(page.locator('#cartCount')).toHaveText('1');
}

test.describe('Shopping cart', () => {
  test.beforeEach(async ({ page }) => {
    await mockStorefrontAPI(page);
  });

  test('adds a product from Shop and persists it', async ({ page }) => {
    await addFirstProduct(page);

    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('cart') || '[]'));
    expect(before).toHaveLength(1);

    await page.reload();
    await expect(page.locator('#cartCount')).toHaveText('1');
  });

  test('opens the cart and updates quantity with delegated actions', async ({ page }) => {
    await addFirstProduct(page);
    await page.locator('#cartBtn').click();
    await expect(page.locator('#cartSidebar')).toHaveClass(/active/);

    await page.locator('[data-cart-action="increase"]').first().click();
    await expect(page.locator('#cartCount')).toHaveText('2');
    await expect(page.locator('.cart-item-qty span').first()).toHaveText('2');
  });

  test('removes a cart line with a delegated action', async ({ page }) => {
    await addFirstProduct(page);
    await page.locator('#cartBtn').click();
    await page.locator('[data-cart-action="remove"]').first().click();

    await expect(page.locator('#cartCount')).toHaveText('0');
    await expect(page.locator('.cart-empty')).toBeVisible();
  });

  test('does not render executable product attributes in the cart', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('cart', JSON.stringify([{
        id: 'lv-hoodie-001',
        name: '<img src=x onerror="window.__xss=true">',
        price: 145000,
        image: '/assets/hoodie.jpg',
        color: '<script>window.__xss=true</script>',
        size: 'M',
        quantity: 1
      }]));
    });

    await page.goto('/shop.html');
    await page.locator('#cartBtn').click();

    await expect(page.locator('.cart-item-name').first()).toContainText('<img');
    expect(await page.locator('#cartItems [onerror]').count()).toBe(0);
    expect(await page.locator('#cartItems script').count()).toBe(0);
    expect(await page.evaluate(() => window.__xss === true)).toBe(false);
  });
});
