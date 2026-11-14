import { test, expect } from '@playwright/test';
import { mockStoreProducts, mockStorefrontAPI } from '../helpers/e2e-storefront.js';

test.describe('Homepage visual polish', () => {
  for (const count of [2, 3]) {
    test(`adapts the editorial bestseller layout to ${count} products`, async ({ page }) => {
      await mockStorefrontAPI(page);
      await page.route('**/api/products', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          products: mockStoreProducts.slice(0, count).map(product => ({
            ...product,
            tags: ['bestseller']
          }))
        })
      }));

      await page.goto('/');
      const featured = page.locator('#featuredProducts');
      await expect(featured.locator('.product-card')).toHaveCount(count);
      await expect(featured).toHaveClass(/featured-grid-editorial/);
      // The editorial grid only spans rows on wide viewports. At max-width
      // 1024px (home-styles.css) it intentionally collapses: the lead card
      // stops spanning and rows go back to auto sizing.
      const isCompactViewport = await page.evaluate(
        () => window.matchMedia('(max-width: 1024px)').matches
      );
      if (isCompactViewport) {
        await expect(featured.locator('.product-card').first()).toHaveCSS('grid-row-start', 'auto');
        return;
      }
      const rowCount = await featured.evaluate(element =>
        getComputedStyle(element).gridTemplateRows.split(' ').length
      );
      expect(rowCount).toBe(count - 1);
    });
  }

  test('centers the section cleanly when there is only one bestseller', async ({ page }) => {
    await mockStorefrontAPI(page);
    await page.route('**/api/products', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, products: [mockStoreProducts[0]] })
    }));

    await page.goto('/');
    const featured = page.locator('#featuredProducts');
    await expect(featured.locator('.product-card')).toHaveCount(1);
    await expect(featured).toHaveClass(/featured-grid-single/);
    await expect(featured).not.toHaveClass(/featured-grid-editorial/);
  });

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
    // The lead card spans all support rows alongside it: 4 products -> 3 support
    // rows -> grid-row "1 / span 3". getComputedStyle returns grid-row-end as the
    // span form, so assert the span rather than the resolved end line number.
    // Below 1024px the compact layout takes over and the lead card goes back to
    // auto placement, so only assert the span geometry on wide viewports.
    const isCompactViewport = await page.evaluate(
      () => window.matchMedia('(max-width: 1024px)').matches
    );
    if (!isCompactViewport) {
      await expect(featured.locator('.product-card').first()).toHaveCSS('grid-row-start', '1');
      await expect(featured.locator('.product-card').first()).toHaveCSS('grid-row-end', 'span 3');
    }

    await expect(page.locator('.lookbook-item')).toHaveCount(7);
    await expect(page.locator('.lookbook-info h3')).toHaveCount(0);
    await expect(page.locator('#lightboxTitle')).toHaveCount(0);
    await page.locator('.lookbook-item').first().click();
    await expect(page.locator('#lightbox')).toHaveClass(/active/);
    await expect(page.locator('.lightbox-info h3')).toHaveCount(0);

    // The marquee clones its group to fill the viewport width, so the final
    // .marquee-group count is dynamic (home.js initMarquee rebuilds based on
    // viewport/group width). The real invariant is a seamless loop: at least two
    // groups, all carrying identical copy so the wrap is invisible.
    const groups = page.locator('.marquee-group');
    const count = await groups.count();
    expect(count).toBeGreaterThanOrEqual(2);
    const groupCopy = await groups.evaluateAll(items =>
      items.map(item => item.textContent.replace(/\s+/g, ' ').trim())
    );
    expect(groupCopy.every(copy => copy === groupCopy[0])).toBe(true);
  });

  test('does not rewrite unchanged ticker copy during the settings refresh', async ({ page }) => {
    await page.clock.install({ time: new Date('2030-01-01T12:00:00Z') });
    await mockStorefrontAPI(page);
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.GlobalSettings?.refreshTimer));

    // Watch the marquee SOURCE group only. initMarquee rebuilds the clone
    // groups whenever the source resizes (e.g. a web font swapping in late),
    // and those rebuilds legitimately mutate the track — they are not copy
    // rewrites and landed after earlier observers were installed, which made
    // this test flake on WebKit. The settings refresh may only touch the
    // source copy when a value actually changed, so the source subtree is
    // both the precise and the race-free thing to observe.
    await page.evaluate(() => {
      const source = document.querySelector('.marquee-group:not([data-marquee-clone="true"])');
      window.__marqueeMutationCount = 0;
      window.__marqueeObserver = new MutationObserver(records => {
        window.__marqueeMutationCount += records.length;
      });
      window.__marqueeObserver.observe(source, {
        childList: true,
        subtree: true,
        characterData: true
      });
    });

    await page.clock.fastForward(60000);
    await expect.poll(() => page.evaluate(() => window.__marqueeMutationCount)).toBe(0);
  });
});
