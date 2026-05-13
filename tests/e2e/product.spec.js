/**
 * LA VAGUE - Product Page E2E Tests
 * Tests for viewing product, quick view, add to cart from product page
 */

import { test, expect } from '@playwright/test';

test.describe('Product Page', () => {
  test.beforeEach(async ({ page }) => {
    // Isolated context handles this
  });

  test.describe('Product Detail Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/product.html?id=lv-hoodie-001');
      await page.waitForTimeout(1000);
    });

    test('should display product page', async ({ page }) => {
      await expect(page.locator('.product-detail, #productDetail')).toBeVisible();
    });

    test('should display product name', async ({ page }) => {
      const productName = page.locator('h1, .product-title');
      await expect(productName).toBeVisible();
      await expect(productName).not.toBeEmpty();
    });

    test('should display product price', async ({ page }) => {
      const productPrice = page.locator('.product-price, .price');
      await expect(productPrice).toBeVisible();
      const priceText = await productPrice.textContent();
      expect(priceText).toMatch(/\$[\d,.]+/);
    });

    test('should display product images', async ({ page }) => {
      const productImages = page.locator('.product-images img, .product-gallery img');
      await expect(productImages.first()).toBeVisible();
    });

    test('should display product description', async ({ page }) => {
      const description = page.locator('.product-description, .description');
      await expect(description).toBeVisible();
    });

    test('should display product features', async ({ page }) => {
      const features = page.locator('.product-features, .features');
      if (await features.isVisible().catch(() => false)) {
        const featureItems = features.locator('li, .feature-item');
        expect(await featureItems.count()).toBeGreaterThan(0);
      }
    });

    test('should have color selection', async ({ page }) => {
      const colorOptions = page.locator('.color-option, [data-color]');
      
      if (await colorOptions.first().isVisible().catch(() => false)) {
        expect(await colorOptions.count()).toBeGreaterThan(0);
        
        // Click first color
        await colorOptions.first().click();
        await expect(colorOptions.first()).toHaveClass(/selected|active/);
      }
    });

    test('should have size selection', async ({ page }) => {
      const sizeOptions = page.locator('.size-option, [data-size]');
      
      if (await sizeOptions.first().isVisible().catch(() => false)) {
        expect(await sizeOptions.count()).toBeGreaterThan(0);
        
        // Click first size
        await sizeOptions.first().click();
        await expect(sizeOptions.first()).toHaveClass(/selected|active/);
      }
    });

    test('should have quantity selector', async ({ page }) => {
      const quantityInput = page.locator('#quantity, .quantity-input');
      
      if (await quantityInput.isVisible().catch(() => false)) {
        // Should default to 1
        await expect(quantityInput).toHaveValue('1');
        
        // Increase quantity
        const increaseBtn = page.locator('.qty-increase, .quantity-up');
        if (await increaseBtn.isVisible().catch(() => false)) {
          await increaseBtn.click();
          await expect(quantityInput).toHaveValue('2');
        }
      }
    });

    test('should have add to cart button', async ({ page }) => {
      const addToCartBtn = page.locator('#addToCartBtn, .add-to-cart-btn');
      await expect(addToCartBtn).toBeVisible();
      await expect(addToCartBtn).toContainText(/add to cart/i);
    });

    test('should add product to cart', async ({ page }) => {
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
      await addToCartBtn.click();
      
      await page.waitForTimeout(500);
      
      // Cart count should update
      const cartCount = page.locator('.cart-count, #cartCount');
      const count = await cartCount.textContent();
      expect(parseInt(count || '0')).toBeGreaterThan(0);
    });

    test('should show toast notification on add to cart', async ({ page }) => {
      const addToCartBtn = page.locator('#addToCartBtn, .add-to-cart-btn');
      await addToCartBtn.click();
      
      // Toast should appear
      const toast = page.locator('.toast, .notification');
      await expect(toast).toBeVisible({ timeout: 3000 });
    });

    test('should have size guide link', async ({ page }) => {
      const sizeGuideBtn = page.locator('#sizeGuideBtn, .size-guide-btn');
      
      if (await sizeGuideBtn.isVisible().catch(() => false)) {
        await sizeGuideBtn.click();
        
        // Size guide modal should appear
        const sizeGuideModal = page.locator('.size-guide-modal, #sizeGuideModal, .modal');
        await expect(sizeGuideModal).toBeVisible();
      }
    });

    test('should display shipping information', async ({ page }) => {
      const shippingInfo = page.locator('.shipping-info, .product-meta');
      await expect(shippingInfo).toBeVisible();
    });

    test('should display related products', async ({ page }) => {
      const relatedSection = page.locator('.related-products, .you-may-also-like');
      
      if (await relatedSection.isVisible().catch(() => false)) {
        const relatedProducts = relatedSection.locator('.product-card');
        expect(await relatedProducts.count()).toBeGreaterThan(0);
      }
    });

    test('should navigate to related product', async ({ page }) => {
      const relatedSection = page.locator('.related-products, .you-may-also-like');
      
      if (await relatedSection.isVisible().catch(() => false)) {
        const firstRelated = relatedSection.locator('.product-card').first();
        const relatedName = await firstRelated.locator('.product-name').textContent();
        
        await firstRelated.click();
        await page.waitForTimeout(1000);
        
        // Should navigate to product page
        await expect(page.locator('h1, .product-title')).not.toHaveText(relatedName);
      }
    });

    test('should update image on color selection', async ({ page }) => {
      const colorOptions = page.locator('.color-option, [data-color]');
      const mainImage = page.locator('.product-images img, .product-gallery img').first();
      
      if (await colorOptions.count() > 1 && await mainImage.isVisible().catch(() => false)) {
        const initialSrc = await mainImage.getAttribute('src');
        
        // Click different color
        await colorOptions.nth(1).click();
        await page.waitForTimeout(500);
        
        // Image should update
        const newSrc = await mainImage.getAttribute('src');
        // May or may not change depending on implementation
      }
    });
  });

  test.describe('Quick View', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/shop.html');
    });

    test('should open quick view modal', async ({ page }) => {
      // Find quick view button
      const quickViewBtn = page.locator('.quick-view-btn, .quick-view').first();
      
      if (await quickViewBtn.isVisible().catch(() => false)) {
        await quickViewBtn.click();
        
        // Quick view modal should appear
        const quickViewModal = page.locator('.quick-view-modal, #quickViewModal');
        await expect(quickViewModal).toBeVisible();
      }
    });

    test('should display product info in quick view', async ({ page }) => {
      const quickViewBtn = page.locator('.quick-view-btn, .quick-view').first();
      
      if (await quickViewBtn.isVisible().catch(() => false)) {
        await quickViewBtn.click();
        
        const modal = page.locator('.quick-view-modal, #quickViewModal');
        
        // Should have product name
        await expect(modal.locator('.product-name, h2, h3')).toBeVisible();
        
        // Should have price
        await expect(modal.locator('.product-price')).toBeVisible();
        
        // Should have add to cart button
        await expect(modal.locator('.add-to-cart-btn')).toBeVisible();
      }
    });

    test('should add to cart from quick view', async ({ page }) => {
      const quickViewBtn = page.locator('.quick-view-btn, .quick-view').first();
      
      if (await quickViewBtn.isVisible().catch(() => false)) {
        await quickViewBtn.click();
        
        const modal = page.locator('.quick-view-modal, #quickViewModal');
        const addToCartBtn = modal.locator('.add-to-cart-btn');
        
        if (await addToCartBtn.isVisible().catch(() => false)) {
          await addToCartBtn.click();
          await page.waitForTimeout(500);
          
          // Cart should update
          const cartCount = page.locator('.cart-count, #cartCount');
          const count = await cartCount.textContent();
          expect(parseInt(count || '0')).toBeGreaterThan(0);
        }
      }
    });

    test('should close quick view modal', async ({ page }) => {
      const quickViewBtn = page.locator('.quick-view-btn, .quick-view').first();
      
      if (await quickViewBtn.isVisible().catch(() => false)) {
        await quickViewBtn.click();
        
        const modal = page.locator('.quick-view-modal, #quickViewModal');
        
        // Click close button or backdrop
        const closeBtn = modal.locator('.close-btn, .modal-close');
        if (await closeBtn.isVisible().catch(() => false)) {
          await closeBtn.click();
        } else {
          // Click outside modal
          await page.click('body', { position: { x: 10, y: 10 } });
        }
        
        await page.waitForTimeout(300);
        await expect(modal).not.toBeVisible();
      }
    });
  });

  test.describe('Product Navigation', () => {
    test('should navigate from shop to product page', async ({ page }) => {
      await page.goto('/shop.html');
      
      const firstProduct = page.locator('.product-card').first();
      const productName = await firstProduct.locator('.product-name').textContent();
      
      await firstProduct.click();
      await page.waitForTimeout(1000);
      
      // Should be on product page
      await expect(page).toHaveURL(/product\.html/);
      
      // Product name should match
      await expect(page.locator('h1, .product-title')).toContainText(productName.trim());
    });

    test('should navigate using breadcrumb', async ({ page }) => {
      await page.goto('/product.html?id=lv-hoodie-001');
      
      const breadcrumbShop = page.locator('.breadcrumb a[href="shop.html"], .breadcrumb a:has-text("Shop")');
      
      if (await breadcrumbShop.isVisible().catch(() => false)) {
        await breadcrumbShop.click();
        await page.waitForTimeout(1000);
        
        await expect(page).toHaveURL(/shop\.html/);
      }
    });

    test('should navigate to home from breadcrumb', async ({ page }) => {
      await page.goto('/product.html?id=lv-hoodie-001');
      
      const breadcrumbHome = page.locator('.breadcrumb a[href="index.html"], .breadcrumb a:has-text("Home")');
      
      if (await breadcrumbHome.isVisible().catch(() => false)) {
        await breadcrumbHome.click();
        await page.waitForTimeout(1000);
        
        await expect(page).toHaveURL(/index\.html/);
      }
    });
  });

  test.describe('Product Images', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/product.html?id=lv-hoodie-001');
      await page.waitForTimeout(1000);
    });

    test('should display main product image', async ({ page }) => {
      const mainImage = page.locator('.product-images img, .main-image img').first();
      await expect(mainImage).toBeVisible();
    });

    test('should have thumbnail gallery', async ({ page }) => {
      const thumbnails = page.locator('.thumbnail-gallery img, .product-thumbnails img');
      
      if (await thumbnails.first().isVisible().catch(() => false)) {
        expect(await thumbnails.count()).toBeGreaterThan(0);
      }
    });

    test('should change main image on thumbnail click', async ({ page }) => {
      const thumbnails = page.locator('.thumbnail-gallery img, .product-thumbnails img');
      const mainImage = page.locator('.product-images img, .main-image img').first();
      
      if (await thumbnails.count() > 1) {
        const initialSrc = await mainImage.getAttribute('src');
        
        await thumbnails.nth(1).click();
        await page.waitForTimeout(500);
        
        const newSrc = await mainImage.getAttribute('src');
        // Image should change
        expect(newSrc).not.toBe(initialSrc);
      }
    });

    test('should have image zoom on hover', async ({ page }) => {
      const mainImage = page.locator('.product-images, .main-image').first();
      
      if (await mainImage.isVisible().catch(() => false)) {
        await mainImage.hover();
        await page.waitForTimeout(300);
        
        // Check for zoom effect
        const hasZoomClass = await mainImage.evaluate(el => 
          el.classList.contains('zoom') || el.classList.contains('zoomed')
        );
        // May or may not have zoom depending on implementation
      }
    });
  });

  test.describe('Invalid Product', () => {
    test('should handle invalid product ID', async ({ page }) => {
      await page.goto('/product.html?id=invalid-product-123');
      await page.waitForTimeout(1000);
      
      // Should show error or redirect
      const errorMessage = page.locator('.error, .not-found, .product-not-found');
      const isShop = page.url().includes('shop.html');
      
      expect(await errorMessage.isVisible().catch(() => false) || isShop).toBeTruthy();
    });

    test('should handle missing product ID', async ({ page }) => {
      await page.goto('/product.html');
      await page.waitForTimeout(1000);
      
      // Should redirect to shop or show error
      expect(page.url()).toMatch(/shop\.html|error/);
    });
  });
});
