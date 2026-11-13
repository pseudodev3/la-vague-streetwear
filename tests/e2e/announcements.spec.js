import { test, expect } from '@playwright/test';
import { mockStorefrontAPI } from '../helpers/e2e-storefront.js';

const now = new Date('2030-01-01T12:00:00Z');
const campaign = {
  message: 'New collection available through Sunday',
  startsAt: '2030-01-01T11:00:00Z',
  endsAt: '2030-01-01T13:00:00Z'
};

async function mockAnnouncement(page, announcement, extraSettings = {}) {
  await page.clock.install({ time: now });
  await mockStorefrontAPI(page);
  await page.route('**/api/config/settings', route => route.fulfill({
    json: { success: true, settings: { freeShippingThreshold: 150000, announcement, ...extraSettings } }
  }));
}

test.describe('Store announcements', () => {
  test('hides the announcement bar when there is no active campaign', async ({ page }) => {
    await mockAnnouncement(page, null);
    await page.goto('/');
    // No campaign -> bar is hidden and its content is empty.
    await expect(page.locator('.announcement-bar')).toBeHidden();
    await expect(page.locator('.announcement-content')).toHaveText('');
    // The body carries the no-announcement class so the nav lifts to top:0.
    await expect(page.locator('body')).toHaveClass(/\bno-announcement\b/);
    await expect(page.locator('[data-campaign-message]').first()).toHaveText('PREMIUM STREETWEAR. LIMITED RUNS.');
    await expect(page).toHaveTitle('LA VAGUE | Premium Streetwear & Limited Drops');
    await expect(page.locator('body')).not.toContainText('NEW DROP AVAILABLE NOW');
  });

  test('shows an active campaign, then expires it without a reload', async ({ page }) => {
    await mockAnnouncement(page, campaign);
    await page.goto('/');
    // Active campaign -> bar visible, class removed, message rendered.
    await expect(page.locator('.announcement-bar')).toBeVisible();
    await expect(page.locator('body')).not.toHaveClass(/\bno-announcement\b/);
    await expect(page.locator('.announcement-content')).toHaveText(campaign.message);
    await expect(page.locator('[data-campaign-message]').first()).toHaveText(campaign.message);

    await page.clock.fastForward(60 * 60 * 1000 + 1);
    // Expired -> bar hidden again, content emptied, class restored.
    await expect(page.locator('.announcement-bar')).toBeHidden();
    await expect(page.locator('body')).toHaveClass(/\bno-announcement\b/);
    await expect(page.locator('.announcement-content')).toHaveText('');
    await expect(page.locator('[data-campaign-message]').first()).toHaveText('PREMIUM STREETWEAR. LIMITED RUNS.');
  });

  test('picks up a newly active campaign on an already open page', async ({ page }) => {
    await mockAnnouncement(page, null);
    let active = false;
    await page.route('**/api/config/settings', route => route.fulfill({
      json: { success: true, settings: { announcement: active ? campaign : null } }
    }));
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.GlobalSettings.refreshTimer));
    // Starts hidden (no campaign).
    await expect(page.locator('.announcement-bar')).toBeHidden();
    active = true;
    await page.clock.fastForward(60001);
    // Picks up the campaign on the next settings refresh -> bar appears.
    await expect(page.locator('.announcement-bar')).toBeVisible();
    await expect(page.locator('.announcement-content')).toHaveText(campaign.message);
  });

  for (const [name, announcement] of [
    ['scheduled', { ...campaign, startsAt: '2030-01-02T12:00:00Z', endsAt: '2030-01-03T12:00:00Z' }],
    ['expired', { ...campaign, startsAt: '2029-12-30T12:00:00Z', endsAt: '2030-01-01T11:59:59Z' }]
  ]) {
    test(`does not display a ${name} campaign`, async ({ page }) => {
      await mockAnnouncement(page, announcement);
      await page.goto('/shop.html');
      // Not yet/ no longer active -> bar stays hidden.
      await expect(page.locator('.announcement-bar')).toBeHidden();
      await expect(page.locator('.announcement-content')).toHaveText('');
    });
  }

  test('never restores a cached campaign when the API is unavailable', async ({ page }) => {
    await mockAnnouncement(page, null);
    await page.addInitScript(cached => localStorage.setItem('laVagueStoreSettings', JSON.stringify(cached)), {
      freeShippingThreshold: 220000, announcement: campaign
    });
    await page.route('**/api/config/settings', route => route.abort());
    await page.goto('/shop.html');
    // API unavailable -> no campaign is trusted from cache -> bar hidden.
    await expect(page.locator('.announcement-bar')).toBeHidden();
    await expect(page.locator('.announcement-content')).toHaveText('');
  });

  test('renders message text safely and keeps long messages inside the banner', async ({ page }) => {
    const message = '<img src=x onerror=alert(1)> NEW COLLECTION AVAILABLE NOW — SHOP THE LIMITED DROP';
    await mockAnnouncement(page, { ...campaign, message });
    await page.goto('/shop.html');
    const banner = page.locator('.announcement-content');
    await expect(banner).toHaveText(message);
    await expect(banner.locator('img')).toHaveCount(0);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 800 });
      const fits = await banner.evaluate(element => {
        const parent = element.parentElement.getBoundingClientRect();
        const content = element.getBoundingClientRect();
        return content.top >= parent.top - 0.5 && content.bottom <= parent.bottom + 0.5
          && element.scrollWidth <= element.clientWidth;
      });
      expect(fits).toBe(true);
    }
  });

  test('hides the bar even when the shipping threshold is zero', async ({ page }) => {
    await mockAnnouncement(page, null, { freeShippingThreshold: 0 });
    await page.goto('/shop.html');
    // No campaign -> bar hidden regardless of threshold (the free-shipping
    // fallback line is no longer rendered into the bar).
    await expect(page.locator('.announcement-bar')).toBeHidden();
    await expect(page.locator('.announcement-content')).toHaveText('');
  });
});

test('admin can save and disable a scheduled announcement using local dates', async ({ page }) => {
  await mockAnnouncement(page, null);
  const csrfToken = 'a'.repeat(64);
  let stored = {};
  await page.route('**/api/csrf-token', route => route.fulfill({ json: { success: true, csrfToken } }));
  await page.route('**/api/admin/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/settings') && request.method() === 'POST') {
      expect(request.headers()['x-csrf-token']).toBe(csrfToken);
      stored = request.postDataJSON().settings;
    }
    await route.fulfill({ json: {
      success: true, authenticated: true, settings: stored,
      stats: {}, orders: [], products: [], lowStock: [], customers: [], reviews: []
    } });
  });
  await page.goto('/admin.html');
  await expect(page.locator('#dashboard')).toBeVisible();
  const menu = page.getByRole('button', { name: 'Toggle menu' });
  if (await menu.isVisible()) await menu.click();
  const loaded = page.waitForResponse(response => response.url().endsWith('/api/admin/settings') && response.request().method() === 'GET');
  await page.locator('.nav-item[data-section="settings"]').click();
  await loaded;
  await expect(page.locator('#settingStoreName')).toHaveValue('LA VAGUE');
  await page.locator('#settingAnnouncementEnabled').check();
  await expect(page.locator('#settingAnnouncementMessage')).toHaveAttribute('required', '');
  await expect(page.locator('#settingAnnouncementEndsAt')).toHaveAttribute('required', '');
  await page.locator('#settingAnnouncementMessage').fill(campaign.message);
  await page.locator('#settingAnnouncementStartsAt').fill('2030-01-02T12:00');
  await page.locator('#settingAnnouncementEndsAt').fill('2030-01-03T12:00');
  const saved = page.waitForResponse(response => response.url().endsWith('/api/admin/settings') && response.request().method() === 'POST');
  await page.locator('#settingsForm button[type="submit"]').click();
  await saved;
  expect(stored.announcementEnabled).toBe('true');
  expect(stored.announcementMessage).toBe(campaign.message);
  expect(stored.announcementStartsAt).toMatch(/^2030-01-02T/);
  expect(stored.announcementEndsAt).toMatch(/^2030-01-03T/);

  await page.reload();
  await expect(page.locator('#dashboard')).toBeVisible();
  if (await menu.isVisible()) await menu.click();
  const reloaded = page.waitForResponse(response => response.url().endsWith('/api/admin/settings') && response.request().method() === 'GET');
  await page.locator('.nav-item[data-section="settings"]').click();
  await reloaded;
  await expect(page.locator('#settingAnnouncementEnabled')).toBeChecked();
  await expect(page.locator('#settingAnnouncementEndsAt')).toHaveValue('2030-01-03T12:00');
  await page.locator('#settingAnnouncementEnabled').uncheck();
  const disabled = page.waitForResponse(response => response.url().endsWith('/api/admin/settings') && response.request().method() === 'POST');
  await page.locator('#settingsForm button[type="submit"]').click();
  await disabled;
  expect(stored.announcementEnabled).toBe('false');
});
