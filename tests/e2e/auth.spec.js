import { test, expect } from '@playwright/test';

async function mockAdminAPI(page) {
  await page.route('**/api/admin/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith('/login')) {
      const body = route.request().postDataJSON();
      if (body?.password === 'correct-password') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, token: 'test-admin-token' })
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Invalid password' })
        });
      }
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        stats: {},
        orders: [],
        products: [],
        lowStock: [],
        customers: [],
        reviews: [],
        settings: {}
      })
    });
  });
}

test.describe('Admin authentication', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminAPI(page);
  });

  test('shows the login screen without a session token', async ({ page }) => {
    await page.goto('/admin.html');
    await expect(page.locator('#loginScreen')).toBeVisible();
    await expect(page.locator('#dashboard')).toBeHidden();
  });

  test('stores successful authentication in sessionStorage only', async ({ page }) => {
    await page.goto('/admin.html');
    await page.locator('#adminPassword').fill('correct-password');
    await page.locator('#loginForm button[type="submit"]').click();

    await expect(page.locator('#dashboard')).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('adminToken'))).toBe('test-admin-token');
    expect(await page.evaluate(() => localStorage.getItem('adminToken'))).toBeNull();
  });

  test('shows an error for invalid credentials without creating a session', async ({ page }) => {
    await page.goto('/admin.html');
    await page.locator('#adminPassword').fill('wrong-password');
    await page.locator('#loginForm button[type="submit"]').click();

    await expect(page.locator('.toast-error')).toContainText('Invalid password');
    expect(await page.evaluate(() => sessionStorage.getItem('adminToken'))).toBeNull();
  });

  test('restores and clears an existing session correctly', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('adminToken', 'test-admin-token'));
    await page.goto('/admin.html');

    await expect(page.locator('#dashboard')).toBeVisible();
    await page.locator('#logoutBtn').click();

    await expect(page.locator('#loginScreen')).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('adminToken'))).toBeNull();
  });
});
