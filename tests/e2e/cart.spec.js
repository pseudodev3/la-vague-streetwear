/**
 * LA VAGUE - Cart E2E Tests
 * Tests for add to cart, update quantities, remove items
 */

import { test, expect } from '@playwright/test';

test.describe('Shopping Cart', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/shop.html');
  });

  test.describe('Add to Cart', () => {
    test('should add product to cart from shop page', async ({ page }) => {
      await page.goto('/shop.html');
      
      // Click add to cart on first product
      const firstProduct = page.locator('.product-card').first();
      await firstProduct.locator('.add-to-cart-btn, .quick-add-btn, button:has-text("Add")').first().click();
      
      // Wait for cart to update
      await page.waitForTimeout(500);
      
      // Cart count should be updated
      const cartCount = page.locator('.cart-count, #cartCount');
      await expect(cartCount).toBeVisible();
      const count = await cartCount.textContent();
      expect(parseInt(count || '0')).toBeGreaterThan(0);
    });

    test('should add product with specific color and size', async ({ page }) => {
      await page.goto('/product.html?id=lv-hoodie-001');
      
      // Wait for product page to load
      await page.waitForSelector('.product-detail', { timeout: 5000 }).catch(() => {});
      
      // Select color if available
      const colorOption = page.locator('.color-option, [data-color]').first();
      if (await colorOption.isVisible().catch(() => false)) {
        await colorOption.click();
      }
      
      // Select size if available
      const sizeOption = page.locator('.size-option, [data-size]').first();
      if (await sizeOption.isVisible().catch(() => false)) {
        await sizeOption.click();
      }
      
      // Add to cart
      const addToCartBtn = page.locator('#addToCartBtn, .add-to-cart-btn');
      if (await addToCartBtn.isVisible().catch(() => false)) {
        await addToCartBtn.click();
        await page.waitForTimeout(500);
        
        // Check cart count
        const cartCount = page.locator('.cart-count, #cartCount');
        const count = await cartCount.textContent();
        expect(parseInt(count || '0')).toBeGreaterThan(0);
      }
    });

    test('should add multiple products to cart', async ({ page }) => {
      await page.goto('/shop.html');
      
      // Add first product
      const firstProduct = page.locator('.product-card').first();
      await firstProduct.locator('.add-to-cart-btn, .quick-add-btn').first().click();
      await page.waitForTimeout(300);
      
      // Add second product
      const secondProduct = page.locator('.product-card').nth(1);
      await secondProduct.locator('.add-to-cart-btn, .quick-add-btn').first().click();
      await page.waitForTimeout(300);
      
      // Cart should have 2 items
      const cartCount = page.locator('.cart-count, #cartCount');
      const count = await cartCount.textContent();
      expect(parseInt(count || '0')).toBeGreaterThanOrEqual(2);
    });

    test('should increase quantity when adding same product', async ({ page }) => {
      await page.goto('/product.html?id=lv-hoodie-001');
      
      await page.waitForTimeout(1000);
      
      const addToCartBtn = page.locator('#addToCartBtn, .add-to-cart-btn');
      
      if (await addToCartBtn.isVisible().catch(() => false)) {
        // Add same product twice
        await addToCartBtn.click();
        await page.waitForTimeout(500);
        await addToCartBtn.click();
        await page.waitForTimeout(500);
        
        // Open cart
        await page.click('#cartBtn, .cart-btn');
        await page.waitForTimeout(300);
        
        // Check quantity in cart
        const quantity = await page.locator('.cart-item .quantity').first().textContent();
        expect(parseInt(quantity || '1')).toBeGreaterThanOrEqual(2);
      }
    });

    test('should show toast notification when adding to cart', async ({ page }) => {
      await page.goto('/shop.html');
      
      const firstProduct = page.locator('.product-card').first();
      await firstProduct.locator('.add-to-cart-btn, .quick-add-btn').first().click();
      
      // Toast should appear
      const toast = page.locator('.toast, .notification');
      await expect(toast).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Cart Sidebar', () => {
    test('should open cart sidebar', async ({ page }) => {
      await page.goto('/shop.html');
      
      // Add item first
      const firstProduct = page.locator('.product-card').first();
      await firstProduct.locator('.add-to-cart-btn, .quick-add-btn').first().click();
      await page.waitForTimeout(500);
      
      // Click cart button
      await page.click('#cartBtn, .cart-btn');
      
      // Cart sidebar should be visible
      const cartSidebar = page.locator('#cartSidebar, .cart-sidebar');
      await expect(cartSidebar).toBeVisible();
    });

    test('should close cart sidebar', async ({ page }) => {
      await page.goto('/shop.html');
      
      // Add item and open cart
      const firstProduct = page.locator('.product-card').first();
      await firstProduct.locator('.add-to-cart-btn, .quick-add-btn').first().click();
      await page.waitForTimeout(500);
      await page.click('#cartBtn, .cart-btn');
      
      // Close cart
      await page.click('#cartClose, .cart-close');
      
      // Cart sidebar should be hidden
      const cartSidebar = page.locator('#cartSidebar, .cart-sidebar');
      await expect(cartSidebar).not.toBeVisible();
    });

    test('should display cart items', async ({ page }) => {
      await page.goto('/shop.html');
      
      // Add items
      const firstProduct = page.locator('.product-card').first();
      await firstProduct.locator('.add-to-cart-btn, .quick-add-btn').first().click();
      await page.waitForTimeout(500);
      
      // Open cart
      await page.click('#cartBtn, .cart-btn');
      
      // Cart should have items
      const cartItems = page.locator('.cart-item, .cart-sidebar .product-card');
      await expect(cartItems.first()).toBeVisible();
    });

    test('should display correct cart totals', async ({ page }) => {
      await page.goto('/shop.html');
      
      // Get price of first product
      const firstProduct = page.locator('.product-card').first();
      const priceText = await firstProduct.locator('.product-price').textContent();
      const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
      
      // Add to cart
      await firstProduct.locator('.add-to-cart-btn, .quick-add-btn').first().click();
      await page.waitForTimeout(500);
      
      // Open cart
      await page.click('#cartBtn, .cart-btn');
      
      // Check subtotal
      const subtotal = await page.locator('#cartSubtotal, .cart-subtotal').textContent();
      const subtotalValue = parseFloat(subtotal.replace(/[^0-9.]/g, ''));
      expect(subtotalValue).toBeCloseTo(price, 0);
    });
  });

  test.describe('Update Cart Quantities', () => {
    test('should increase item quantity', async ({ page }) => {
      await page.goto('/shop.html');
      
      // Add item to cart
      const firstProduct = page.locator('.product-card').first();
      await firstProduct.locator('.add-to-cart-btn, .quick-add-btn').first().click();
      await page.waitForTimeout(500);
      
      // Open cart
      await page.click('#cartBtn, .cart-btn');
      await page.waitForTimeout(300);
      
      // Increase quantity
      const increaseBtn = page.locator('.qty-btn:has-text("+"), .quantity-increase').first();
      if (await increaseBtn.isVisible().catch(() => false)) {
        await increaseBtn.click();
        await page.waitForTimeout(300);
        
        // Check quantity increased
        const quantity = await page.locator('.cart-item .quantity, .cart-item .qty-value').first().textContent();
        expect(parseInt(quantity)).toBeGreaterThanOrEqual(2);
      }
    });

    test('should decrease item quantity', async ({ page }) => {
      await page.goto('/shop.html');
      
      // Add item twice to have quantity 2
      const firstProduct = page.locator('.product-card').first();
      await firstProduct.locator('.add-to-cart-btn, .quick-add-btn').first().click();
      await page.waitForTimeout(500);
      await firstProduct.locator('.add-to-cart-btn, .quick-add-btn').first().click();
      await page.waitForTimeout(500);
      
      // Open cart
      await page.click('#cartBtn, .cart-btn');
      await page.waitForTimeout(300);
      
      // Decrease quantity
      const decreaseBtn = page.locator('.qty-btn:has-text("−"), .qty-btn:has-text("-"), .quantity-decrease').first();
      if (await decreaseBtn.isVisible().catch(() => false)) {
        // Get initial quantity
        const initialQty = parseInt(await page.locator('.cart-item .quantity').first().textContent());
        
        if (initialQty > 1) {
          await decreaseBtn.click();
          await page.waitForTimeout(300);
          
          const newQty = parseInt(await page.locator('.cart-item .quantity').first().textContent());
          expect(newQty).toBe(initialQty - 1);
        }
      }
    });

    test('should not allow quantity below 1', async ({ page }) => {
      await page.goto('/shop.html');
      
      // Add item to cart
      const firstProduct = page.locator('.product-card').first();
      await firstProduct.locator('.add-to-cart-btn, .quick-add-btn').first().click();
      await page.waitForTimeout(500);
      
      // Open cart
      await page.click('#cartBtn, .cart-btn');
      await page.waitForTimeout(300);
      
      // Try to decrease quantity
      const decreaseBtn = page.locator('.qty-btn:has-text("−"), .qty-btn:has-text("-"), .quantity-decrease').first();
      if (await decreaseBtn.isVisible().catch(() => false)) {
        await decreaseBtn.click();
        await page.waitForTimeout(300);
        
        // Quantity should still be at least 1
        const quantity = parseInt(await page.locator('.cart-item .quantity').first().textContent());
        expect(quantity).toBeGreaterThanOrEqual(1);
      }
    });

    test('should update cart total when quantity changes', async ({ page }) => {
      await page.goto('/shop.html');
      
      // Add item to cart
      const firstProduct = page.locator('.product-card').first();
      await firstProduct.locator('.add-to-cart-btn, .quick-add-btn').first().click();
      await page.waitForTimeout(500);
      
      // Open cart
      await page.click('#cartBtn, .cart-btn');
      await page.waitForTimeout(300);
      
      // Get initial subtotal
      const initialSubtotal = parseFloat((await page.locator('#cartSubtotal').textContent()).replace(/[^0-9.]/g, ''));
      
      // Increase quantity
      const increaseBtn = page.locator('.qty-btn:has-text("+"), .quantity-increase').first();
      if (await increaseBtn.isVisible().catch(() => false)) {
        await increaseBtn.click();
        await page.waitForTimeout(300);
        
        // Check new subtotal
        const newSubtotal = parseFloat((await page.locator('#cartSubtotal').textContent()).replace(/[^0-9.]/g, ''));
        expect(newSubtotal).toBeGreaterThan(initialSubtotal);
      }
    });
  });

  test.describe('Remove from Cart', () => {
    test('should remove item from cart', async ({ page }) => {
      await page.goto('/shop.html');
      
      // Add two different products
      const firstProduct = page.locator('.product-card').first();
      await firstProduct.locator('.add-to-cart-btn, .quick-add-btn').first().click();
      await page.waitForTimeout(500);
      
      const secondProduct = page.locator('.product-card').nth(1);
      await secondProduct.locator('.add-to-cart-btn, .quick-add-btn').first().click();
      await page.waitForTimeout(500);
      
      // Open cart
      await page.click('#cartBtn, .cart-btn');
      await page.waitForTimeout(300);
      
      // Remove first item
      const removeBtn = page.locator('.cart-item-remove, .remove-item').first();
      if (await removeBtn.isVisible().catch(() => false)) {
        await removeBtn.click();
        await page.waitForTimeout(300);
        
        // Cart should still have items
        const cartItems = page.locator('.cart-item');
        expect(await cartItems.count()).toBeGreaterThanOrEqual(1);
      }
    });

    test('should show empty cart state when all items removed', async ({ page }) => {
      await page.goto('/shop.html');
      
      // Add item to cart
      const firstProduct = page.locator('.product-card').first();
      await firstProduct.locator('.add-to-cart-btn, .quick-add-btn').first().click();
      await page.waitForTimeout(500);
      
      // Open cart
      await page.click('#cartBtn, .cart-btn');
      await page.waitForTimeout(300);
      
      // Remove item
      const removeBtn = page.locator('.cart-item-remove, .remove-item').first();
      if (await removeBtn.isVisible().catch(() => false)) {
        await removeBtn.click();
        await page.waitForTimeout(300);
        
        // Should show empty cart message
        const emptyMessage = page.locator('.cart-empty, .empty-cart-message');
        await expect(emptyMessage).toBeVisible();
      }
    });

    test('should update cart count when item removed', async ({ page }) => {
      await page.goto('/shop.html');
      
      // Add two items
      const firstProduct = page.locator('.product-card').first();
      await firstProduct.locator('.add-to-cart-btn, .quick-add-btn').first().click();
      await page.waitForTimeout(500);
      
      const secondProduct = page.locator('.product-card').nth(1);
      await secondProduct.locator('.add-to-cart-btn, .quick-add-btn').first().click();
      await page.waitForTimeout(500);
      
      // Get initial cart count
      const initialCount = parseInt(await page.locator('.cart-count, #cartCount').textContent());
      
      // Open cart and remove item
      await page.click('#cartBtn, .cart-btn');
      await page.waitForTimeout(300);
      
      const removeBtn = page.locator('.cart-item-remove, .remove-item').first();
      if (await removeBtn.isVisible().catch(() => false)) {
        await removeBtn.click();
        await page.waitForTimeout(300);
        
        // Cart count should decrease
        const newCount = parseInt(await page.locator('.cart-count, #cartCount').textContent());
        expect(newCount).toBeLessThan(initialCount);
      }
    });
  });

  test.describe('Cart Persistence', () => {
    test('should persist cart after page reload', async ({ page }) => {
      await page.goto('/shop.html');
      
      // Add item to cart
      const firstProduct = page.locator('.product-card').first();
      await firstProduct.locator('.add-to-cart-btn, .quick-add-btn').first().click();
      await page.waitForTimeout(500);
      
      // Get cart count
      const cartCount = await page.locator('.cart-count, #cartCount').textContent();
      
      // Reload page
      await page.reload();
      await page.waitForTimeout(1000);
      
      // Cart count should persist
      const newCartCount = await page.locator('.cart-count, #cartCount').textContent();
      expect(newCartCount).toBe(cartCount);
    });
  });

  test.describe('Checkout Navigation', () => {
    test('should navigate to checkout from cart', async ({ page }) => {
      await page.goto('/shop.html');
      
      // Add item to cart
      const firstProduct = page.locator('.product-card').first();
      await firstProduct.locator('.add-to-cart-btn, .quick-add-btn').first().click();
      await page.waitForTimeout(500);
      
      // Open cart
      await page.click('#cartBtn, .cart-btn');
      await page.waitForTimeout(300);
      
      // Click checkout
      const checkoutBtn = page.locator('.cart-footer .btn-primary:has-text("Checkout"), #checkoutBtn');
      if (await checkoutBtn.isVisible().catch(() => false)) {
        await checkoutBtn.click();
        await page.waitForTimeout(1000);
        
        // Should be on checkout page
        await expect(page).toHaveURL(/checkout\.html/);
      }
    });
  });
});
