/**
 * LA VAGUE - Test Setup
 * Global test configuration and mocks for Vitest
 */

import { vi } from 'vitest';

// ==========================================
// LOCALSTORAGE MOCK
// ==========================================
const localStorageMock = {
  store: {},
  getItem(key) {
    return this.store[key] || null;
  },
  setItem(key, value) {
    this.store[key] = String(value);
  },
  removeItem(key) {
    delete this.store[key];
  },
  clear() {
    this.store = {};
  }
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});

// ==========================================
// BROWSER SECURITY HELPERS
// ==========================================
window.BrowserSecurity = Object.freeze({
  escapeHTML(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  },
  safeURL(value, { allowDataImage = false } = {}) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (allowDataImage && /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i.test(raw)) {
      return raw;
    }
    try {
      const url = new URL(raw, window.location.origin);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  },
  safeClassToken(value) {
    return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  },
  safeColor(value, fallback = '#111111') {
    const color = String(value ?? '').trim();
    return /^#[0-9a-f]{3,8}$/i.test(color) ? color : fallback;
  }
});

// ==========================================
// MATCH MEDIA MOCK
// ==========================================
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

// ==========================================
// CUSTOM EVENT MOCK HELPERS
// ==========================================
window.CustomEvent = class CustomEvent extends Event {
  constructor(event, params = {}) {
    super(event, params);
    this.detail = params.detail || null;
  }
};

// ==========================================
// SCROLL TO MOCK
// ==========================================
window.scrollTo = vi.fn();

// ==========================================
// INTERSECTION OBSERVER MOCK
// ==========================================
class IntersectionObserverMock {
  constructor(callback) {
    this.callback = callback;
  }
  observe() { }
  unobserve() { }
  disconnect() { }
}

window.IntersectionObserver = IntersectionObserverMock;

// ==========================================
// ALERT/CONFIRM/PROMPT MOCKS
// ==========================================
window.alert = vi.fn();
window.confirm = vi.fn(() => true);
window.prompt = vi.fn(() => null);

// ==========================================
// CONSOLE MOCK (optional - uncomment to suppress console output during tests)
// ==========================================
// vi.spyOn(console, 'log').mockImplementation(() => {});
// vi.spyOn(console, 'warn').mockImplementation(() => {});
// vi.spyOn(console, 'error').mockImplementation(() => {});

// ==========================================
// IMAGE MOCK
// ==========================================
class ImageMock {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this.src = '';
  }
  set src(value) {
    this._src = value;
    // Simulate successful image load
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 0);
  }
  get src() {
    return this._src;
  }
}

window.Image = ImageMock;

// ==========================================
// REQUEST ANIMATION FRAME MOCK
// ==========================================
global.requestAnimationFrame = vi.fn((callback) => setTimeout(callback, 0));
global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id));

// ==========================================
// RESET LOCAL STORAGE BEFORE EACH TEST
// ==========================================
beforeEach(() => {
  localStorageMock.clear();
});

// ==========================================
// CLEANUP AFTER EACH TEST
// ==========================================
afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
});
