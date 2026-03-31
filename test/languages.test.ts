import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LANGUAGE,
  getTranslation,
  isSupportedLanguage,
  normalizeLanguage,
} from '@/lib/languages';

describe('language helper', () => {
  it('normalizes supported language codes', () => {
    expect(normalizeLanguage('EN')).toBe('en');
    expect(normalizeLanguage('TR')).toBe('tr');
    expect(normalizeLanguage('ru-RU')).toBe('ru');
  });

  it('falls back to the default language for unsupported values', () => {
    expect(normalizeLanguage('de')).toBe(DEFAULT_LANGUAGE);
    expect(isSupportedLanguage('de')).toBe(false);
    expect(isSupportedLanguage('en')).toBe(true);
  });

  it('interpolates translated strings', () => {
    expect(getTranslation('en', 'home.lessonCount', { count: 3 })).toBe('3 lessons');
    expect(getTranslation('az', 'home.lessonCount', { count: 3 })).toBe('3 dərs');
    expect(getTranslation('tr', 'practicePage.packLabel', { key: '25' })).toBe('Paket 25');
    expect(getTranslation('ru', 'progressPage.storageAmount', { amount: 500 })).toBe('500 MB');
  });
});