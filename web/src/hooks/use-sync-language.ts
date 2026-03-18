import { useEffect, useRef, useState } from 'react';
import { setLocale, isLocale } from '@/paraglide/runtime';
import { useMe, useUpdateMe, type Language } from '@/lib/user';

// localStorage is the source of truth for language.
// If the API user language differs, update the API to match.
export function useSyncLocale() {
  const { data: me } = useMe();
  const updateMe = useUpdateMe();
  const updateMeRef = useRef(updateMe);
  updateMeRef.current = updateMe;

  useEffect(() => {
    const storedLanguage = getStoredLanguage();
    const locale = storedLanguage as unknown as string;
    if (isLocale(locale)) {
      setLocale(locale, { reload: false });
    }
    if (me?.language && me.language !== storedLanguage) {
      updateMeRef.current({ language: storedLanguage });
    }
  }, [me?.language]);
}

const LANGUAGE_STORAGE_KEY = 'nexata_language';

export function getStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    const found = LANGUAGE_OPTIONS.find((l) => l.value === stored);
    return found?.value ?? LANGUAGE_OPTIONS[0].value;
  } catch {
    return LANGUAGE_OPTIONS[0].value;
  }
}

export function usePersistedLanguage() {
  const [language, setLanguage] = useState<Language>(getStoredLanguage);

  useEffect(() => {
    const locale = language as unknown as string;
    if (isLocale(locale)) {
      setLocale(locale, { reload: false });
    }
  }, [language]);

  const setAndPersist = (lang: Language) => {
    setLanguage(lang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {}
  };

  return [language, setAndPersist] as const;
}

export const LANGUAGE_OPTIONS = [
  {
    value: 'es' as Language,
    label: 'Español',
    country: 'ar',
  },
  {
    value: 'en' as Language,
    label: 'English',
    country: 'us',
  },
] as const;
