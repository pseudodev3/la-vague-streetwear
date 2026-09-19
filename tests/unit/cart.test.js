/**
 * LA VAGUE - Cart Unit Tests
 * Covers the current shared cart/wishlist implementation and NGN-only currency config.
 */

import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createMockCartItem } from '../fixtures/test-data.js';
import { setupCartDOM, setupWishlistDOM, clearCartData, getCart, getWishlist } from '../helpers/test-helpers.js';

let CartState;
let CurrencyConfig;

beforeAll(async () => {
  global.CATEGORIES = [
    { id: 'hoodies', name: 'Hoodies' },
    { id: 'tees', name: 'T-Shirts' }
  ];

  global.I18n = undefined;
  const fetchMock = vi.fn().mockImplementation(async url => {
    if (String(url).includes('/products/inventory/check/')) {
      return {
        ok: true,
        json: async () => ({ success: true, available: 12, inStock: true })
      };
    }

    return {
      ok: true,
      json: async () => ({ success: true, rates: { NGN: 1 } })
    };
  });
  global.fetch = fetchMock;
  window.fetch = fetchMock;

  await import('../../src/scripts/cart.js');
  CartState = window.CartState;
  CurrencyConfig = window.CurrencyConfig;
});

beforeEach(() => {
  setupCartDOM();
  setupWishlistDOM();
  clearCartData();
  CartState.cart = [];
  CartState.wishlist = [];
  global.I18n = undefined;
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('CartState', () => {
  it('starts with an empty cart and wishlist after reset', () => {
    expect(getCart()).toEqual([]);
    expect(getWishlist()).toEqual([]);
  });

  it('adds an in-stock item and persists it', async () => {
    const item = createMockCartItem({
      id: 'lv-hoodie-001',
      name: 'Classic Oversized Hoodie',
      color: 'Black',
      size: 'L',
      quantity: 1
    });

    await CartState.addToCart(item);

    expect(getCart()).toHaveLength(1);
    expect(getCart()[0]).toMatchObject(item);
  });

  it('combines the same product variant', async () => {
    const item = createMockCartItem({
      id: 'lv-hoodie-001',
      color: 'Black',
      size: 'L',
      quantity: 1
    });

    await CartState.addToCart(item);
    await CartState.addToCart({ ...item, quantity: 2 });

    expect(getCart()).toHaveLength(1);
    expect(getCart()[0].quantity).toBe(3);
  });

  it('keeps different variants as separate cart lines', async () => {
    await CartState.addToCart(createMockCartItem({
      id: 'lv-hoodie-001',
      color: 'Black',
      size: 'L',
      quantity: 1
    }));
    await CartState.addToCart(createMockCartItem({
      id: 'lv-hoodie-001',
      color: 'Ash Grey',
      size: 'M',
      quantity: 1
    }));

    expect(getCart()).toHaveLength(2);
  });

  it('fails closed when live stock cannot be verified', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network down'));
    window.fetch = global.fetch;
    const showToast = vi.spyOn(CartState, 'showToast').mockImplementation(() => {});
    const item = createMockCartItem({
      id: 'lv-hoodie-001',
      color: 'Black',
      size: 'L',
      quantity: 1
    });

    await CartState.addToCart(item);

    expect(getCart()).toEqual([]);
    expect(showToast).toHaveBeenCalledWith('Sorry, this item is out of stock', 'error');
  });

  it('does not exceed known stock', async () => {
    const showToast = vi.spyOn(CartState, 'showToast').mockImplementation(() => {});
    const item = createMockCartItem({
      id: 'lv-hoodie-001',
      color: 'Black',
      size: 'XS',
      quantity: 13
    });

    await CartState.addToCart(item);

    expect(getCart()).toEqual([]);
    expect(showToast).toHaveBeenCalledWith('Only 12 items available in stock', 'error');
  });

  it('updates quantity and persists the new value', async () => {
    CartState.cart = [createMockCartItem({
      id: 'lv-hoodie-001',
      color: 'Black',
      size: 'L',
      quantity: 1
    })];
    CartState.saveCart();

    await CartState.updateCartItemQuantity(0, 2);

    expect(getCart()[0].quantity).toBe(3);
  });

  it('removes a cart line when quantity would fall below one', async () => {
    CartState.cart = [createMockCartItem({
      id: 'lv-hoodie-001',
      color: 'Black',
      size: 'L',
      quantity: 1
    })];
    CartState.saveCart();

    await CartState.updateCartItemQuantity(0, -1);

    expect(getCart()).toEqual([]);
  });

  it('removes a cart line by index', () => {
    CartState.cart = [
      createMockCartItem({ id: 'lv-hoodie-001' }),
      createMockCartItem({ id: 'lv-tee-001' })
    ];
    CartState.saveCart();

    CartState.removeFromCart(0);

    expect(getCart()).toHaveLength(1);
    expect(getCart()[0].id).toBe('lv-tee-001');
  });

  it('toggles wishlist membership and persists it', () => {
    expect(CartState.addToWishlist('lv-hoodie-001')).toBe(true);
    expect(getWishlist()).toEqual(['lv-hoodie-001']);

    expect(CartState.addToWishlist('lv-hoodie-001')).toBe(false);
    expect(getWishlist()).toEqual([]);
  });

  it('updates the cart badge using total quantity', () => {
    CartState.cart = [
      createMockCartItem({ quantity: 2 }),
      createMockCartItem({ id: 'lv-tee-001', quantity: 3 })
    ];

    CartState.updateCartCount();

    const badge = document.getElementById('cartCount');
    expect(badge.textContent).toBe('5');
    expect(badge.classList.contains('active')).toBe(true);
  });
});

describe('CurrencyConfig', () => {
  it('uses NGN as the only current currency', () => {
    expect(CurrencyConfig.getCurrentCurrency()).toBe('NGN');
    expect(CurrencyConfig.getSupportedCurrencies()).toEqual(['NGN']);
  });

  it('accepts NGN and rejects unsupported currency switching', () => {
    expect(CurrencyConfig.setCurrency('NGN')).toBe(true);
    expect(CurrencyConfig.setCurrency('USD')).toBe(false);
  });

  it('does not convert NGN amounts', () => {
    expect(CurrencyConfig.convert(125000)).toBe(125000);
  });

  it('formats prices as whole-number naira', () => {
    expect(CurrencyConfig.formatPrice(125000)).toBe('₦125,000');
  });
});
