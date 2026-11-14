import { test, expect } from '@playwright/test';
import { mockStoreProducts, mockStorefrontAPI } from '../helpers/e2e-storefront.js';

test.describe('Homepage visual polish', () => {
  test('uses the editorial bestseller layout and keeps lookbook titles out of the UI', async ({ page }) => {
    await mockStorefrontAPI(page);
    await page.route('**/api/products', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        products: mockStoreProducts.slice(0, 4).map(product => ({
          ...product,
          tags: ['bestseller']
        }))
      })
    }));

    await page.goto('/');
    const featured = page.locator('#featuredProducts');
    await expect(featured.locator('.product-card')).toHaveCount(4);
    await expect(featured).toHaveClass(/featured-grid-editorial/);
    await expect(featured.locator('.product-card').first()).toHaveCSS('grid-row-start', '1');
    await expect(featured.locator('.product-card').first()).toHaveCSS('grid-row-end', '4');

    await expect(page.locator('.lookbook-info h3')).toHaveCount(0);
    await expect(page.locator('#lightboxTitle')).toHaveCount(0);
    await page.locator('.lookbook-item').first().click();
    await expect(page.locator('#lightbox')).toHaveClass(/active/);
    await expect(page.locator('.lightbox-info h3')).toHaveCount(0);

    const groups = page.locator('.marquee-group');
    await expect(groups).toHaveCount(2);
    const groupCopy = await groups.evaluateAll(items =>
      items.map(item => item.textContent.replace(/\s+/g, ' ').trim())
    );
    expect(groupCopy[0]).toBe(groupCopy[1]);
  });

  test('does not rewrite unchanged ticker copy during the settings refresh', async ({ page }) => {
    await page.clock.install({ time: new Date('2030-01-01T12:00:00Z') });
    await mockStorefrontAPI(page);
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.GlobalSettings?.refreshTimer));

    await page.evaluate(() => {
      const track = document.querySelector('.marquee-content');
      window.__marqueeMutationCount = 0;
      window.__marqueeObserver = new MutationObserver(records => {
        window.__marqueeMutationCount += records.length;
      });
      window.__marqueeObserver.observe(track, {
        childList: true,
        subtree: true,
        characterData: true
      });
    });

    await page.clock.fastForward(60000);
    await expect.poll(() => page.evaluate(() => window.__marqueeMutationCount)).toBe(0);
  });
});
