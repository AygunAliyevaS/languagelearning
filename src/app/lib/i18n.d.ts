export const DEFAULT_LOCALE: string;
export const LANGUAGE_STORAGE_KEY: string;
export const LANGUAGE_COOKIE_KEY: string;

export interface SupportedLocale {
  id: string;
  label: string;
  flag: string;
}

export const supportedLocales: SupportedLocale[];

export function resolveLocale(locale: string | null | undefined): string;
export function getLocaleMeta(locale: string | null | undefined): SupportedLocale;
export function t(locale: string | null | undefined, key: string, variables?: Record<string, string | number>): string;
export function getLocalizedText(
  locale: string | null | undefined,
  value: string | Record<string, string> | null | undefined
): string;
export function readLocaleFromCookie(cookieHeader?: string): string;