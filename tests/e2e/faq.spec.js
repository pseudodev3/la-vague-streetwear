import { test, expect } from '@playwright/test';
import { mockStorefrontAPI } from '../helpers/e2e-storefront.js';

test.describe('FAQ answers', () => {
  test.beforeEach(async ({ page }) => {
    await mockStorefrontAPI(page);
    await page.goto('/faq.html');
    const storageNotice = page.getByRole('button', { name: 'Got it', exact: true });
    if (await storageNotice.isVisible()) await storageNotice.click();
  });

  test('keeps every category in the FAQ grid and opens each populated answer', async ({ page }) => {
    await expect(page.locator('.faq-grid > .faq-section > .faq-category')).toHaveText([
      'Shipping', 'Returns & Exchanges', 'Sizing & Fit', 'Orders', 'Products'
    ]);
    const items = page.locator('.faq-grid .faq-item');
    await expect(items).toHaveCount(13);

    for (const item of await items.all()) {
      const question = item.locator('.faq-question');
      const answer = item.locator('.faq-answer');
      await expect(question).toHaveAttribute('aria-expanded', 'false');
      await expect(answer).toBeHidden();
      await expect(answer.locator('p')).not.toHaveText('');

      await question.click();
      await expect(question).toHaveAttribute('aria-expanded', 'true');
      await expect(answer).toBeVisible();
      await expect(answer.locator('p')).toBeVisible();
      await expect(question).toHaveAttribute('aria-controls', await answer.getAttribute('id'));
      await expect(answer).toHaveAttribute('aria-labelledby', await question.getAttribute('id'));

      await question.click();
      await expect(question).toHaveAttribute('aria-expanded', 'false');
      await expect(answer).toBeHidden();
    }
  });

  test('opens and closes answers with Enter and Space', async ({ page }) => {
    const question = page.getByRole('button', { name: 'How long does shipping take?' });
    const answer = page.getByRole('region', { name: 'How long does shipping take?', includeHidden: true });

    await question.focus();
    await question.press('Enter');
    await expect(question).toHaveAttribute('aria-expanded', 'true');
    await expect(answer).toBeVisible();
    await expect(answer).toContainText('3-5 business days');

    await question.press('Space');
    await expect(question).toHaveAttribute('aria-expanded', 'false');
    await expect(answer).toBeHidden();
    await expect(question).toBeFocused();
  });
});
