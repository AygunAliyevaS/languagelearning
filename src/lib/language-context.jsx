import React from 'react';
import { DEMO_LEARNER_EMAIL } from '@/app/lib/api-loader';
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  getTranslation,
  normalizeLanguage,
} from '@/lib/languages';

const STORAGE_KEY = 'languagelearning.preferredLanguage';

const LanguageContext = React.createContext({
  language: DEFAULT_LANGUAGE,
  setLanguage: async () => {},
  t: (key, values) => getTranslation(DEFAULT_LANGUAGE, key, values),
  supportedLanguages: SUPPORTED_LANGUAGES,
  isSaving: false,
});

function getStoredLanguage() {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE;
  }

  return normalizeLanguage(window.localStorage.getItem(STORAGE_KEY));
}

async function updatePreferredLanguage(language) {
  const response = await fetch('/api/user', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: DEMO_LEARNER_EMAIL,
      preferred_language: language,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to persist preferred language.');
  }

  return response.json();
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = React.useState(getStoredLanguage);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadPreferredLanguage() {
      try {
        const response = await fetch(`/api/user?email=${encodeURIComponent(DEMO_LEARNER_EMAIL)}`);
        if (!response.ok) {
          return;
        }

        const user = await response.json();
        if (!cancelled && user?.preferred_language) {
          setLanguageState(normalizeLanguage(user.preferred_language));
        }
      } catch {
        // Keep local fallback when profile persistence is unavailable.
      }
    }

    loadPreferredLanguage();

    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = React.useCallback(async (nextLanguage) => {
    const normalized = normalizeLanguage(nextLanguage);
    setLanguageState(normalized);
    window.localStorage.setItem(STORAGE_KEY, normalized);
    setIsSaving(true);

    try {
      await updatePreferredLanguage(normalized);
    } catch {
      // Local persistence remains available when the API cannot be reached.
    } finally {
      setIsSaving(false);
    }
  }, []);

  const value = React.useMemo(
    () => ({
      language,
      setLanguage,
      t: (key, values) => getTranslation(language, key, values),
      supportedLanguages: SUPPORTED_LANGUAGES,
      isSaving,
    }),
    [language, setLanguage, isSaving]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  return React.useContext(LanguageContext);
}

export function useLocalizedDocument(title, description) {
  React.useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    if (title) {
      document.title = title;
    }

    if (description) {
      let element = document.querySelector('meta[name="description"]');
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute('name', 'description');
        document.head.appendChild(element);
      }
      element.setAttribute('content', description);
    }
  }, [title, description]);
}
