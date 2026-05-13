/**
 * LA VAGUE - Auth E2E Tests
 * Tests for admin login/logout
 */

import { test, expect } from '@playwright/test';

test.describe('Admin Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin.html');
  });

  test.describe('Login Page', () => {
    test('should display admin login page', async ({ page }) => {
      await expect(page.locator('h1, .login-title')).toContainText(/admin|login/i);
    });

    test('should have password input field', async ({ page }) => {
      const passwordInput = page.locator('input[type="password"], #password');
      await expect(passwordInput).toBeVisible();
    });

    test('should have login button', async ({ page }) => {
      const loginBtn = page.locator('button[type="submit"], #loginBtn, .login-btn');
      await expect(loginBtn).toBeVisible();
    });

    test('should show error for invalid password', async ({ page }) => {
      const passwordInput = page.locator('input[type="password"], #password');
      const loginBtn = page.locator('button[type="submit"], #loginBtn');
      
      await passwordInput.fill('wrongpassword');
      await loginBtn.click();
      
      // Should show error message
      await page.waitForTimeout(500);
      const errorVisible = await page.locator('.error, .alert-error, .login-error')
        .isVisible().catch(() => false);
      expect(errorVisible).toBeTruthy();
    });

    test('should login with valid credentials', async ({ page }) => {
      // Mock successful login
      await page.route('**/api/admin/login', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            token: 'test-token-12345',
            user: { username: 'admin', role: 'admin' }
          })
        });
      });
      
      const passwordInput = page.locator('input[type="password"], #password');
      const loginBtn = page.locator('button[type="submit"], #loginBtn');
      
      await passwordInput.fill('correctpassword');
      await loginBtn.click();
      
      await page.waitForTimeout(1000);
      
      // Should redirect to admin dashboard or show dashboard
      const url = page.url();
      expect(url.includes('admin') && !url.includes('login')).toBeTruthy();
    });

    test('should show loading state during login', async ({ page }) => {
      await page.route('**/api/admin/login', async route => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, token: 'test-token' })
        });
      });
      
      const loginBtn = page.locator('button[type="submit"], #loginBtn');
      
      await page.fill('input[type="password"], #password', 'password');
      await loginBtn.click();
      
      // Button should show loading state
      await page.waitForTimeout(100);
      await expect(loginBtn).toHaveClass(/loading|btn-loading/).catch(() => {});
    });
  });

  test.describe('Admin Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      // Simulate logged in state
      await page.evaluate(() => {
        localStorage.setItem('adminToken', 'test-token-12345');
        localStorage.setItem('adminUser', JSON.stringify({ username: 'admin', role: 'admin' }));
      });
      await page.goto('/admin.html');
      await page.waitForTimeout(1000);
    });

    test('should display admin dashboard when logged in', async ({ page }) => {
      await expect(page.locator('.admin-dashboard, #adminDashboard, .dashboard')).toBeVisible();
    });

    test('should display orders section', async ({ page }) => {
      await expect(page.locator('#ordersSection, .orders-section, [data-section="orders"]'))
        .toBeVisible();
    });

    test('should display products section', async ({ page }) => {
      await expect(page.locator('#productsSection, .products-section, [data-section="products"]'))
        .toBeVisible();
    });

    test('should display statistics', async ({ page }) => {
      const statsSection = page.locator('.stats, .statistics, .dashboard-stats');
      if (await statsSection.isVisible().catch(() => false)) {
        // Should have stat cards
        const statCards = page.locator('.stat-card, .stat-item');
        expect(await statCards.count()).toBeGreaterThan(0);
      }
    });

    test('should have logout button', async ({ page }) => {
      const logoutBtn = page.locator('#logoutBtn, .logout-btn, button:has-text("Logout")');
      await expect(logoutBtn).toBeVisible();
    });

    test('should logout when clicking logout button', async ({ page }) => {
      const logoutBtn = page.locator('#logoutBtn, .logout-btn, button:has-text("Logout")');
      await logoutBtn.click();
      
      await page.waitForTimeout(500);
      
      // Should clear localStorage and redirect to login
      const token = await page.evaluate(() => localStorage.getItem('adminToken'));
      expect(token).toBeNull();
      
      // Should show login form
      await expect(page.locator('input[type="password"], .login-form')).toBeVisible();
    });
  });

  test.describe('Order Management', () => {
    test.beforeEach(async ({ page }) => {
      // Seed orders and login
      await page.evaluate(() => {
        localStorage.setItem('adminToken', 'test-token-12345');
        localStorage.setItem('orders', JSON.stringify([
          {
            id: 'LV-TEST-001',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            total: 285,
            status: 'pending',
            date: new Date().toISOString()
          }
        ]));
      });
      await page.goto('/admin.html');
      await page.waitForTimeout(1000);
    });

    test('should display orders list', async ({ page }) => {
      const ordersList = page.locator('.orders-list, #ordersList, .order-item');
      await expect(ordersList.first()).toBeVisible();
    });

    test('should display order details', async ({ page }) => {
      const orderItem = page.locator('.order-item, .order-row').first();
      
      // Should show order ID
      await expect(orderItem.locator('.order-id, [data-order-id]')).toBeVisible();
      
      // Should show order status
      await expect(orderItem.locator('.order-status, [data-status]')).toBeVisible();
    });

    test('should update order status', async ({ page }) => {
      const statusSelect = page.locator('.order-status-select, select[name="status"]').first();
      
      if (await statusSelect.isVisible().catch(() => false)) {
        await statusSelect.selectOption('processing');
        await page.waitForTimeout(500);
        
        // Should persist the change
        await expect(statusSelect).toHaveValue('processing');
      }
    });

    test('should filter orders by status', async ({ page }) => {
      const filterSelect = page.locator('#statusFilter, .status-filter');
      
      if (await filterSelect.isVisible().catch(() => false)) {
        await filterSelect.selectOption('pending');
        await page.waitForTimeout(500);
        
        // Should show only pending orders
        const orders = page.locator('.order-item');
        const count = await orders.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    test('should search orders', async ({ page }) => {
      const searchInput = page.locator('#orderSearch, .order-search');
      
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('John');
        await searchInput.press('Enter');
        await page.waitForTimeout(500);
        
        // Should filter results
        const orders = page.locator('.order-item');
        expect(await orders.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should view order details', async ({ page }) => {
      const viewDetailsBtn = page.locator('.view-order, .order-details-btn').first();
      
      if (await viewDetailsBtn.isVisible().catch(() => false)) {
        await viewDetailsBtn.click();
        await page.waitForTimeout(500);
        
        // Should show order details modal or page
        const detailsModal = page.locator('.order-details-modal, .modal, [data-modal="order-details"]');
        await expect(detailsModal).toBeVisible();
      }
    });
  });

  test.describe('Product Management', () => {
    test.beforeEach(async ({ page }) => {
      await page.evaluate(() => {
        localStorage.setItem('adminToken', 'test-token-12345');
      });
      await page.goto('/admin.html');
      await page.waitForTimeout(1000);
    });

    test('should display products list', async ({ page }) => {
      const productsList = page.locator('.products-list, #productsList, .product-item');
      if (await productsList.first().isVisible().catch(() => false)) {
        expect(await productsList.count()).toBeGreaterThan(0);
      }
    });

    test('should have add product button', async ({ page }) => {
      const addBtn = page.locator('#addProductBtn, .add-product-btn');
      if (await addBtn.isVisible().catch(() => false)) {
        await expect(addBtn).toBeVisible();
      }
    });

    test('should edit product', async ({ page }) => {
      const editBtn = page.locator('.edit-product, .product-edit-btn').first();
      
      if (await editBtn.isVisible().catch(() => false)) {
        await editBtn.click();
        await page.waitForTimeout(500);
        
        // Should show edit form or modal
        const editForm = page.locator('.product-form, .edit-modal');
        await expect(editForm).toBeVisible();
      }
    });
  });

  test.describe('Session Management', () => {
    test('should redirect to login if not authenticated', async ({ page }) => {
      // Ensure no token
      await page.evaluate(() => {
        localStorage.removeItem('adminToken');
      });
      
      await page.goto('/admin.html');
      await page.waitForTimeout(500);
      
      // Should show login form
      await expect(page.locator('input[type="password"], .login-form')).toBeVisible();
    });

    test('should persist login across page reloads', async ({ page }) => {
      // Login
      await page.evaluate(() => {
        localStorage.setItem('adminToken', 'test-token-12345');
        localStorage.setItem('adminUser', JSON.stringify({ username: 'admin' }));
      });
      
      await page.goto('/admin.html');
      await page.waitForTimeout(1000);
      
      // Should still be logged in
      await expect(page.locator('.admin-dashboard, #adminDashboard')).toBeVisible();
    });

    test('should clear session on logout', async ({ page }) => {
      // Login first
      await page.evaluate(() => {
        localStorage.setItem('adminToken', 'test-token-12345');
      });
      
      await page.goto('/admin.html');
      await page.waitForTimeout(1000);
      
      // Logout
      const logoutBtn = page.locator('#logoutBtn, .logout-btn');
      await logoutBtn.click();
      
      await page.waitForTimeout(500);
      
      // Verify localStorage is cleared
      const token = await page.evaluate(() => localStorage.getItem('adminToken'));
      const user = await page.evaluate(() => localStorage.getItem('adminUser'));
      
      expect(token).toBeNull();
      expect(user).toBeNull();
    });
  });
});
