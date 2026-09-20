import { test, expect } from '@playwright/test';

const SESSION_COOKIE = 'la_vague_admin_session';
const SESSION_VALUE = 'b'.repeat(64);
const CSRF_TOKEN = 'a'.repeat(64);

async function mockAdminAPI(page, { authenticated = false } = {}) {
  let serverAuthenticated = authenticated;

  await page.route('**/api/csrf-token', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'Set-Cookie': `csrf_token=${CSRF_TOKEN}; Path=/; SameSite=Lax`
      },
      body: JSON.stringify({ success: true, csrfToken: CSRF_TOKEN })
    });
  });

  await page.route('**/api/admin/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    expect(request.headers().authorization).toBeUndefined();

    if (path.endsWith('/session')) {
      await route.fulfill({
        status: serverAuthenticated ? 200 : 401,
        contentType: 'application/json',
        body: JSON.stringify(
          serverAuthenticated
            ? { success: true, authenticated: true }
            : { success: false, error: 'Authentication required', code: 'AUTH_ERROR' }
        )
      });
      return;
    }

    if (path.endsWith('/login')) {
      expect(request.headers()['x-csrf-token']).toBe(CSRF_TOKEN);
      const body = request.postDataJSON();

      if (body?.password === 'correct-password') {
        serverAuthenticated = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: {
            'Set-Cookie': `${SESSION_COOKIE}=${SESSION_VALUE}; Path=/api/admin; HttpOnly; SameSite=Strict`
          },
          body: JSON.stringify({ success: true })
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

    if (path.endsWith('/logout')) {
      expect(request.headers()['x-csrf-token']).toBeTruthy();
      serverAuthenticated = false;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Set-Cookie': `${SESSION_COOKIE}=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0`
        },
        body: JSON.stringify({ success: true })
      });
      return;
    }

    if (!serverAuthenticated) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Authentication required', code: 'AUTH_ERROR' })
      });
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
  test('shows the login screen without a server session', async ({ page }) => {
    await mockAdminAPI(page);
    await page.goto('/admin.html');

    await expect(page.locator('#loginScreen')).toBeVisible();
    await expect(page.locator('#dashboard')).toBeHidden();
  });

  test('uses an HttpOnly session cookie without exposing a bearer token to web storage', async ({ page, context }) => {
    await mockAdminAPI(page);
    await page.goto('/admin.html');
    await page.locator('#adminPassword').fill('correct-password');
    await page.locator('#loginForm button[type="submit"]').click();

    await expect(page.locator('#dashboard')).toBeVisible();

    expect(await page.evaluate(() => sessionStorage.getItem('adminToken'))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('adminToken'))).toBeNull();
    expect(await page.evaluate(() => document.cookie.includes('la_vague_admin_session'))).toBe(false);

    const sessionCookie = (await context.cookies()).find(cookie => cookie.name === SESSION_COOKIE);
    expect(sessionCookie).toBeTruthy();
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.sameSite).toBe('Strict');
  });

  test('shows an error for invalid credentials without creating a session', async ({ page, context }) => {
    await mockAdminAPI(page);
    await page.goto('/admin.html');
    await page.locator('#adminPassword').fill('wrong-password');
    await page.locator('#loginForm button[type="submit"]').click();

    await expect(page.locator('.toast-error')).toContainText('Invalid password');
    const sessionCookie = (await context.cookies()).find(cookie => cookie.name === SESSION_COOKIE);
    expect(sessionCookie).toBeUndefined();
  });

  test('restores an existing server session and clears it on logout', async ({ page, context }) => {
    await mockAdminAPI(page, { authenticated: true });
    await page.goto('/admin.html');

    await expect(page.locator('#dashboard')).toBeVisible();

    await page.locator('#logoutBtn').click();

    await expect(page.locator('#loginScreen')).toBeVisible();
    const sessionCookie = (await context.cookies()).find(cookie => cookie.name === SESSION_COOKIE);
    expect(sessionCookie).toBeUndefined();
  });
});
