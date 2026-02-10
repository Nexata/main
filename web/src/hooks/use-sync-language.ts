import { useEffect } from 'react';
import { setLocale, isLocale } from '@/paraglide/runtime';
import { useMe, type Language } from '@/lib/user';

export function useSyncLocale() {
  const { data: me } = useMe();

  useEffect(() => {
    if (!me?.language) return;

    const locale = me.language as unknown as string;

    if (!isLocale(locale)) return;

    setLocale(locale, { reload: false });
  }, [me?.language]);
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
