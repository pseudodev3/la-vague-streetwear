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

  test('uses clean /checkout link in the cart sidebar and clears cart on order confirmation', async ({ page }) => {
    await expect(page.locator('#cartFooter a.btn-primary')).toHaveAttribute('href', '/checkout');

    await page.goto('/order-confirmation.html?order=LV-TEST1234&status=success');
    await expect(page.locator('#orderNumber')).toHaveText('LV-TEST1234');
    await expect(page.locator('#cartCount')).toHaveText('0');
    const remainingCart = await page.evaluate(() => JSON.parse(localStorage.getItem('cart') || '[]'));
    expect(remainingCart).toEqual([]);
  });

  test('renders mobile shipping and payment cards cleanly and removes white footer payment pads', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const shippingLayout = await page.locator('.shipping-option').first().evaluate(option => {
      const radio = option.querySelector('input[type="radio"]').getBoundingClientRect();
      const info = option.querySelector('.shipping-info').getBoundingClientRect();
      const price = option.querySelector('.shipping-price').getBoundingClientRect();
      return {
        radioRight: radio.right,
        infoLeft: info.left,
        infoRight: info.right,
        priceLeft: price.left,
        infoTop: info.top,
        priceTop: price.top,
        infoBottom: info.bottom
      };
    });
    expect(shippingLayout.infoLeft).toBeGreaterThanOrEqual(shippingLayout.radioRight);
    expect(shippingLayout.priceLeft).toBeGreaterThanOrEqual(shippingLayout.infoRight - 1);
    expect(shippingLayout.priceTop).toBeLessThan(shippingLayout.infoBottom);

    const paymentLayout = await page.locator('.payment-method').first().evaluate(method => {
      const radio = method.querySelector('input[type="radio"]').getBoundingClientRect();
      const title = method.querySelector('.payment-method-title').getBoundingClientRect();
      const icons = method.querySelector('.payment-icons').getBoundingClientRect();
      const sub = method.querySelector('.payment-method-sub').getBoundingClientRect();
      return {
        radioTop: radio.top,
        titleTop: title.top,
        titleBottom: title.bottom,
        titleWidth: title.width,
        iconsLeft: icons.left,
        titleRight: title.right,
        subTop: sub.top,
        subWidth: sub.width
      };
    });
    expect(paymentLayout.iconsLeft).toBeGreaterThanOrEqual(paymentLayout.titleRight - 1);
    expect(paymentLayout.subTop).toBeGreaterThanOrEqual(paymentLayout.titleBottom - 1);
    expect(paymentLayout.subWidth).toBeGreaterThan(paymentLayout.titleWidth);

    const footerPaystack = page.locator('.footer-bottom .payment-paystack');
    await footerPaystack.scrollIntoViewIfNeeded();
    await expect.poll(() => footerPaystack.evaluate(el => {
      const img = el.querySelector('img');
      return Boolean(img && img.complete && img.naturalWidth > 0);
    })).toBe(true);

    const footerPayments = await footerPaystack.evaluate(el => {
      const style = getComputedStyle(el);
      return {
        bg: style.backgroundColor,
        paddingTop: style.paddingTop
      };
    });
    expect(footerPayments.bg).toBe('rgba(0, 0, 0, 0)');
    expect(footerPayments.paddingTop).toBe('0px');
  });
});
