import { useMemo } from 'react';
import {
  'chat.suggestions.welcome_1' as chat_suggestions_welcome_1,
  'chat.suggestions.welcome_2' as chat_suggestions_welcome_2,
  'chat.suggestions.welcome_3' as chat_suggestions_welcome_3,
  'chat.suggestions.welcome_4' as chat_suggestions_welcome_4,
  'chat.suggestions.welcome_5' as chat_suggestions_welcome_5,
  'chat.suggestions.welcome_6' as chat_suggestions_welcome_6,
  'chat.suggestions.welcome_7' as chat_suggestions_welcome_7,
  'chat.suggestions.welcome_8' as chat_suggestions_welcome_8,
  'chat.suggestions.welcome_9' as chat_suggestions_welcome_9,
  'chat.suggestions.welcome_10' as chat_suggestions_welcome_10,
  'chat.suggestions.welcome_11' as chat_suggestions_welcome_11,
  'chat.suggestions.welcome_12' as chat_suggestions_welcome_12,
  'chat.suggestions.welcome_13' as chat_suggestions_welcome_13,
  'chat.suggestions.welcome_14' as chat_suggestions_welcome_14,
  'chat.suggestions.welcome_15' as chat_suggestions_welcome_15,
} from '@/paraglide/messages';

export function useRandomWelcome(name?: string) {
  return useMemo(() => {
    if (!name) return '';

    const messages = [
      chat_suggestions_welcome_1,
      chat_suggestions_welcome_2,
      chat_suggestions_welcome_3,
      chat_suggestions_welcome_4,
      chat_suggestions_welcome_5,
      chat_suggestions_welcome_6,
      chat_suggestions_welcome_7,
      chat_suggestions_welcome_8,
      chat_suggestions_welcome_9,
      chat_suggestions_welcome_10,
      chat_suggestions_welcome_11,
      chat_suggestions_welcome_12,
      chat_suggestions_welcome_13,
      chat_suggestions_welcome_14,
      chat_suggestions_welcome_15,
    ] as const;

    const randomIndex = Math.floor(Math.random() * messages.length);
    const message = messages[randomIndex];

    if (!message) return '';

    return message({ name });
  }, [name]);
}
