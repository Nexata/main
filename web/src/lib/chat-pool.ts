import { Chat as AIChat, type UIMessage } from '@ai-sdk/react';
import { lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { createAuthenticatedChatTransport } from './chat-transport';

/**
 * Module-level pool of AI SDK Chat instances, keyed by thread ID.
 * Each thread gets its own Chat instance so streams don't collide.
 */
const chatPool = new Map<string, AIChat<UIMessage>>();

export const NEW_CHAT_KEY = '__new__';

export function getChatInstance(threadId: string | null): AIChat<UIMessage> {
	const key = threadId ?? NEW_CHAT_KEY;
	if (!chatPool.has(key)) {
		chatPool.set(
			key,
			new AIChat({
				transport: createAuthenticatedChatTransport(),
				sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
			}),
		);
	}
	return chatPool.get(key)!;
}

/**
 * After a new chat gets assigned a real threadId by the server (via SSE),
 * migrate the __new__ instance to the real key so subsequent lookups find it.
 */
export function promoteChatInstance(realThreadId: string): void {
	const instance = chatPool.get(NEW_CHAT_KEY);
	if (instance) {
		chatPool.set(realThreadId, instance);
		chatPool.delete(NEW_CHAT_KEY);
	}
}

/**
 * Clean up when a thread is deleted.
 */
export function removeChatInstance(threadId: string): void {
	chatPool.delete(threadId);
}

/**
 * Get the raw pool map (for background stream monitoring).
 */
export function getChatPool(): Map<string, AIChat<UIMessage>> {
	return chatPool;
}
