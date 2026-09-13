/**
 * LA VAGUE - i18n Unit Tests
 * Exercises the browser i18n implementation rather than a duplicated test-only copy.
 */

import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mockTranslations, mockLanguageMetadata } from '../fixtures/test-data.js';

let I18n;

beforeAll(async () => {
  globalThis.TRANSLATIONS = mockTranslations;
  globalThis.LANGUAGE_METADATA = mockLanguageMetadata;
  await import('../../src/scripts/i18n.js');
  I18n = window.I18n;
});

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
  I18n.currentLang = 'en';
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('I18n language state', () => {
  it('loads a saved supported language on init', () => {
    localStorage.setItem('laVagueLanguage', 'fr');
    I18n.init();

    expect(I18n.getCurrentLang()).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('uses English when no preference exists', () => {
    I18n.init();
    expect(I18n.getCurrentLang()).toBe('en');
  });

  it('falls back to English for unsupported languages', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});

    I18n.setLanguage('xx');

    expect(I18n.getCurrentLang()).toBe('en');
    expect(warning).toHaveBeenCalled();
  });

  it('persists language changes by default', () => {
    I18n.setLanguage('fr');
    expect(localStorage.getItem('laVagueLanguage')).toBe('fr');
  });

  it('can change language without persisting it', () => {
    I18n.setLanguage('ar', false);
    expect(localStorage.getItem('laVagueLanguage')).toBeNull();
  });

  it('sets RTL direction for Arabic', () => {
    I18n.setLanguage('ar');

    expect(I18n.getCurrentDir()).toBe('rtl');
    expect(I18n.isRTL()).toBe(true);
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('dispatches a languageChanged event', () => {
    const listener = vi.fn();
    window.addEventListener('languageChanged', listener, { once: true });

    I18n.setLanguage('fr');

    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].detail).toEqual({ language: 'fr', dir: 'ltr' });
  });
});

describe('I18n translations', () => {
  it('returns nested English translations', () => {
    I18n.setLanguage('en', false);
    expect(I18n.getTranslation('nav.home')).toBe('Home');
    expect(I18n.getTranslation('cart.title')).toBe('Your Cart');
  });

  it('returns the active-language translation when present', () => {
    I18n.setLanguage('fr', false);
    expect(I18n.getTranslation('nav.home')).toBe('Accueil');
  });

  it('falls back to English only when the active-language key is missing', () => {
    const original = mockTranslations.fr.toast.viewCart;
    delete mockTranslations.fr.toast.viewCart;

    try {
      I18n.setLanguage('fr', false);
      expect(I18n.getTranslation('toast.viewCart')).toBe('View Cart');
    } finally {
      mockTranslations.fr.toast.viewCart = original;
    }
  });

  it('returns null when a key is missing from every language', () => {
    I18n.setLanguage('fr', false);
    expect(I18n.getTranslation('does.not.exist')).toBeNull();
  });

  it('replaces translation variables', () => {
    const original = mockTranslations.en.test;
    mockTranslations.en.test = { greeting: 'Hello, {{name}}!' };

    try {
      I18n.setLanguage('en', false);
      expect(I18n.t('test.greeting', { name: 'Wave' })).toBe('Hello, Wave!');
    } finally {
      if (original === undefined) delete mockTranslations.en.test;
      else mockTranslations.en.test = original;
    }
  });

  it('returns the key from t() when no translation exists', () => {
    expect(I18n.t('does.not.exist')).toBe('does.not.exist');
  });
});

describe('Translation metadata', () => {
  it('defines English, French and Arabic metadata', () => {
    expect(mockLanguageMetadata.en).toMatchObject({ code: 'en', dir: 'ltr' });
    expect(mockLanguageMetadata.fr).toMatchObject({ code: 'fr', dir: 'ltr' });
    expect(mockLanguageMetadata.ar).toMatchObject({ code: 'ar', dir: 'rtl' });
  });

  it('keeps core navigation keys aligned across languages', () => {
    const englishKeys = Object.keys(mockTranslations.en.nav);
    expect(Object.keys(mockTranslations.fr.nav)).toEqual(englishKeys);
    expect(Object.keys(mockTranslations.ar.nav)).toEqual(englishKeys);
  });
});
