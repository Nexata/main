import { useEffect } from 'react';
import { setLocale, isLocale } from '@/paraglide/runtime';
import { useMe } from '@/lib/user';
import { Language } from '@api/schema/user';

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
    value: Language.ES,
    label: 'Español',
    country: 'ar',
  },
  {
    value: Language.EN,
    label: 'English',
    country: 'us',
  },
] as const;
