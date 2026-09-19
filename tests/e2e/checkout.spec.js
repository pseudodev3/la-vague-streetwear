/**
 * LA VAGUE - Checkout E2E Tests
 * Tests for complete checkout flow with test payment method
 */

import { test, expect } from '@playwright/test';

test.describe('Checkout Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to shop and add items to cart
    await page.goto('/shop.html');
    
    // Add item to cart
    const firstProduct = page.locator('.product-card').first();
    await firstProduct.locator('.add-to-cart-btn, .quick-add-btn').first().click();
    await page.waitForTimeout(500);
    
    // Navigate to checkout
    await page.goto('/checkout.html');
    await page.waitForTimeout(1000);
  });

  test.describe('Checkout Page Load', () => {
    test('should display checkout page', async ({ page }) => {
      await expect(page.locator('h1, .checkout-title')).toContainText(/checkout|order/i);
    });

    test('should display order summary', async ({ page }) => {
      await expect(page.locator('.order-summary, #summaryItems')).toBeVisible();
    });

    test('should display checkout form', async ({ page }) => {
      await expect(page.locator('#checkoutForm, form')).toBeVisible();
    });

    test('should redirect to shop if cart is empty', async ({ page }) => {
      // Clear cart
      await page.evaluate(() => localStorage.removeItem('cart'));
      
      // Navigate to checkout
      await page.goto('/checkout.html');
      await page.waitForTimeout(1000);
      
      // Should redirect to shop
      await expect(page).toHaveURL(/shop\.html/);
    });
  });

  test.describe('Contact Information', () => {
    test('should fill email field', async ({ page }) => {
      const emailInput = page.locator('#email');
      await expect(emailInput).toBeVisible();
      await emailInput.fill('test@example.com');
      await expect(emailInput).toHaveValue('test@example.com');
    });

    test('should validate email format', async ({ page }) => {
      const emailInput = page.locator('#email');
      await emailInput.fill('invalid-email');
      
      // Try to submit
      const submitBtn = page.locator('#placeOrderBtn');
      await submitBtn.click();
      
      // Should show validation error
      await expect(page.locator('.error, .invalid')).toBeVisible();
    });
  });

  test.describe('Shipping Information', () => {
    test('should fill shipping address fields', async ({ page }) => {
      await page.fill('#firstName', 'John');
      await page.fill('#lastName', 'Doe');
      await page.fill('#address', '123 Test Street');
      await page.fill('#city', 'New York');
      await page.fill('#state', 'NY');
      await page.fill('#zip', '10001');
      await page.fill('#phone', '+1 (555) 123-4567');
      
      // Verify values
      await expect(page.locator('#firstName')).toHaveValue('John');
      await expect(page.locator('#lastName')).toHaveValue('Doe');
      await expect(page.locator('#address')).toHaveValue('123 Test Street');
    });

    test('should require all mandatory shipping fields', async ({ page }) => {
      // Leave fields empty and try to submit
      const submitBtn = page.locator('#placeOrderBtn');
      await submitBtn.click();
      
      // Should show validation error or stay on page
      await expect(page).toHaveURL(/checkout\.html/);
    });

    test('should format phone number', async ({ page }) => {
      const phoneInput = page.locator('#phone');
      await phoneInput.fill('5551234567');
      
      // Should format as US number
      await phoneInput.blur();
      await page.waitForTimeout(300);
      
      const value = await phoneInput.inputValue();
      expect(value).toMatch(/\+1/);
    });
  });

  test.describe('Shipping Method', () => {
    test('should have shipping options', async ({ page }) => {
      const shippingOptions = page.locator('input[name="shipping"]');
      const count = await shippingOptions.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should select standard shipping by default', async ({ page }) => {
      const standardShipping = page.locator('input[value="standard"], #standardShipping');
      if (await standardShipping.isVisible().catch(() => false)) {
        await expect(standardShipping).toBeChecked();
      }
    });

    test('should update totals when selecting express shipping', async ({ page }) => {
      const expressOption = page.locator('input[value="express"]');
      if (await expressOption.isVisible().catch(() => false)) {
        // Get current shipping cost
        const initialShipping = await page.locator('#summaryShipping, .shipping-cost').textContent();
        
        await expressOption.check();
        await page.waitForTimeout(300);
        
        // Shipping should update
        const newShipping = await page.locator('#summaryShipping, .shipping-cost').textContent();
        expect(newShipping).not.toBe(initialShipping);
      }
    });
  });

  test.describe('Payment Information', () => {
    test('should display payment section', async ({ page }) => {
      await expect(page.locator('#paymentSection, .payment-section')).toBeVisible();
    });

    test('should format credit card number', async ({ page }) => {
      const cardInput = page.locator('#cardNumber');
      if (await cardInput.isVisible().catch(() => false)) {
        await cardInput.fill('4242424242424242');
        
        const value = await cardInput.inputValue();
        expect(value).toMatch(/4242\s4242\s4242\s4242/);
      }
    });

    test('should format expiry date', async ({ page }) => {
      const expiryInput = page.locator('#expiry');
      if (await expiryInput.isVisible().catch(() => false)) {
        await expiryInput.fill('1225');
        
        const value = await expiryInput.inputValue();
        expect(value).toMatch(/12.+25/);
      }
    });

    test('should limit CVV to 4 digits', async ({ page }) => {
      const cvvInput = page.locator('#cvv');
      if (await cvvInput.isVisible().catch(() => false)) {
        await cvvInput.fill('12345');
        
        const value = await cvvInput.inputValue();
        expect(value.length).toBeLessThanOrEqual(4);
      }
    });
  });

  test.describe('Discount Codes', () => {
    test('should apply discount code', async ({ page }) => {
      const discountInput = page.locator('#discountCode');
      const applyBtn = page.locator('#applyDiscount');
      
      if (await discountInput.isVisible().catch(() => false) && 
          await applyBtn.isVisible().catch(() => false)) {
        await discountInput.fill('WELCOME10');
        await applyBtn.click();
        
        // Should show success or update totals
        await page.waitForTimeout(500);
        
        // Check for discount line
        const discountLine = page.locator('#discountLine, .discount-line');
        await expect(discountLine).toBeVisible();
      }
    });

    test('should reject invalid discount code', async ({ page }) => {
      const discountInput = page.locator('#discountCode');
      const applyBtn = page.locator('#applyDiscount');
      
      if (await discountInput.isVisible().catch(() => false) && 
          await applyBtn.isVisible().catch(() => false)) {
        await discountInput.fill('INVALIDCODE');
        await applyBtn.click();
        
        // Should show error toast or message
        await page.waitForTimeout(500);
        const toast = page.locator('.toast.error, .error-message');
        await expect(toast).toBeVisible();
      }
    });

    test('should apply free shipping code', async ({ page }) => {
      const discountInput = page.locator('#discountCode');
      const applyBtn = page.locator('#applyDiscount');
      
      if (await discountInput.isVisible().catch(() => false) && 
          await applyBtn.isVisible().catch(() => false)) {
        const initialShipping = await page.locator('#summaryShipping').textContent();
        
        await discountInput.fill('FREESHIP');
        await applyBtn.click();
        
        await page.waitForTimeout(500);
        
        const newShipping = await page.locator('#summaryShipping').textContent();
        expect(newShipping.toLowerCase()).toContain('free');
      }
    });
  });

  test.describe('Order Totals', () => {
    test('should display subtotal', async ({ page }) => {
      const subtotal = page.locator('#summarySubtotal, .subtotal');
      await expect(subtotal).toBeVisible();
      
      const value = await subtotal.textContent();
      expect(value).toMatch(/\$[\d,.]+/);
    });

    test('should display shipping cost', async ({ page }) => {
      const shipping = page.locator('#summaryShipping, .shipping-cost');
      await expect(shipping).toBeVisible();
    });

    test('should display total', async ({ page }) => {
      const total = page.locator('#summaryTotal, .total');
      await expect(total).toBeVisible();
      
      const value = await total.textContent();
      expect(value).toMatch(/\$[\d,.]+/);
    });

    test('should calculate total correctly', async ({ page }) => {
      const subtotalText = await page.locator('#summarySubtotal').textContent();
      const shippingText = await page.locator('#summaryShipping').textContent();
      const totalText = await page.locator('#summaryTotal').textContent();
      
      const subtotal = parseFloat(subtotalText.replace(/[^0-9.]/g, ''));
      const shipping = shippingText.toLowerCase().includes('free') 
        ? 0 
        : parseFloat(shippingText.replace(/[^0-9.]/g, ''));
      const total = parseFloat(totalText.replace(/[^0-9.]/g, ''));
      
      expect(total).toBeCloseTo(subtotal + shipping, 1);
    });
  });

  test.describe('Complete Order', () => {
    test('should place order with valid information', async ({ page }) => {
      // Fill contact info
      await page.fill('#email', 'test@example.com');
      
      // Fill shipping info
      await page.fill('#firstName', 'John');
      await page.fill('#lastName', 'Doe');
      await page.fill('#address', '123 Test Street');
      await page.fill('#city', 'New York');
      await page.fill('#state', 'NY');
      await page.fill('#zip', '10001');
      await page.fill('#phone', '+1 (555) 123-4567');
      
      // Intercept API call
      await page.route('**/api/orders', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            success: true, 
            orderId: 'LV-TEST-12345' 
          })
        });
      });
      
      // Click place order
      const placeOrderBtn = page.locator('#placeOrderBtn');
      await placeOrderBtn.click();
      
      // Wait for navigation or success state
      await page.waitForTimeout(2000);
      
      // Should show success or redirect
      const url = page.url();
      expect(url.includes('order-confirmation') || 
             await page.locator('.success, .order-confirmation').isVisible().catch(() => false))
        .toBeTruthy();
    });

    test('should show loading state while processing', async ({ page }) => {
      // Fill required fields
      await page.fill('#email', 'test@example.com');
      await page.fill('#firstName', 'John');
      await page.fill('#lastName', 'Doe');
      await page.fill('#address', '123 Test Street');
      await page.fill('#city', 'New York');
      await page.fill('#state', 'NY');
      await page.fill('#zip', '10001');
      
      // Slow down API response
      await page.route('**/api/orders', async route => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, orderId: 'LV-TEST-12345' })
        });
      });
      
      const placeOrderBtn = page.locator('#placeOrderBtn');
      await placeOrderBtn.click();
      
      // Button should show loading state
      await page.waitForTimeout(100);
      await expect(placeOrderBtn).toHaveClass(/loading|btn-loading/);
    });

    test('should handle API error gracefully', async ({ page }) => {
      // Fill required fields
      await page.fill('#email', 'test@example.com');
      await page.fill('#firstName', 'John');
      await page.fill('#lastName', 'Doe');
      await page.fill('#address', '123 Test Street');
      await page.fill('#city', 'New York');
      await page.fill('#state', 'NY');
      await page.fill('#zip', '10001');
      
      // Simulate API error
      await page.route('**/api/orders', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Server error' })
        });
      });
      
      const placeOrderBtn = page.locator('#placeOrderBtn');
      await placeOrderBtn.click();
      
      await page.waitForTimeout(1000);
      
      // Should show error state or message
      const errorVisible = await page.locator('.error, .toast.error, .alert-error')
        .isVisible().catch(() => false);
      expect(errorVisible).toBeTruthy();
    });

    test('should clear cart after successful order', async ({ page }) => {
      // Fill required fields
      await page.fill('#email', 'test@example.com');
      await page.fill('#firstName', 'John');
      await page.fill('#lastName', 'Doe');
      await page.fill('#address', '123 Test Street');
      await page.fill('#city', 'New York');
      await page.fill('#state', 'NY');
      await page.fill('#zip', '10001');
      
      await page.route('**/api/orders', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, orderId: 'LV-TEST-12345' })
        });
      });
      
      await page.locator('#placeOrderBtn').click();
      await page.waitForTimeout(2000);
      
      // Check localStorage
      const cart = await page.evaluate(() => localStorage.getItem('cart'));
      expect(cart).toBeNull();
    });
  });

  test.describe('Order Confirmation', () => {
    test('should display order confirmation page', async ({ page }) => {
      await page.goto('/order-confirmation.html?order=LV-TEST-12345');
      
      await expect(page.locator('h1, .confirmation-title')).toContainText(/order|confirmation|thank you/i);
    });

    test('should display order details', async ({ page }) => {
      await page.goto('/order-confirmation.html?order=LV-TEST-12345');
      
      // Should show order number
      const orderNumber = page.locator('.order-number, [data-order-id]');
      await expect(orderNumber).toBeVisible();
    });

    test('should have link to continue shopping', async ({ page }) => {
      await page.goto('/order-confirmation.html?order=LV-TEST-12345');
      
      const continueShopping = page.locator('a:has-text("Continue Shopping"), a:has-text("Shop"), .btn:has-text("Shop")');
      await expect(continueShopping).toBeVisible();
      
      await continueShopping.click();
      await expect(page).toHaveURL(/shop\.html|index\.html/);
    });
  });
});
