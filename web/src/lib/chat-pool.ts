import { Chat as AIChat, type UIMessage } from '@ai-sdk/react';
import { useChatUIStore } from './chat.store';
import { createAuthenticatedChatTransport } from './chat-transport';

/**
 * Module-level pool of AI SDK Chat instances, keyed by thread ID.
 * Each thread gets its own Chat instance so streams don't collide.
 */
const chatPool = new Map<string, AIChat<UIMessage>>();

export const NEW_CHAT_KEY = '__new__';

/**
 * Only auto-continue when the LAST part of the last assistant message is a
 * tool call that has just been fully resolved (state === 'output-available')
 * or a tool approval that has been responded to (state === 'approval-responded').
 *
 * Why this predicate instead of `lastAssistantMessageIsCompleteWithToolCalls`:
 * - Server-executed tools (Gmail, Drive, …) are already resolved inline by
 *   the server's streamText — the model continues in the same stream and ends
 *   with a text part, so this predicate returns false (no extra round-trip).
 * - NexataAskQuestions has no server-side execute fn → the stream ends on the
 *   tool-call part (state: 'input-available').  This predicate stays false
 *   until the user submits answers and addToolOutput flips it to
 *   'output-available', at which point we send to /chat/answer.
 * - NexataReingest has needsApproval: true → the stream ends with a
 *   'tool-approval-request' event (state: 'approval-requested').  This
 *   predicate stays false until the user approves/denies via
 *   addToolApprovalResponse, which flips it to 'approval-responded'.
 *
 * The old predicate fired as soon as any tool call appeared (regardless of
 * output state), triggering an unwanted /chat request that made the model
 * repeat the same tool call → visible duplication in the UI.
 */
function shouldSendAutomatically({
	messages,
}: {
	messages: UIMessage[];
}): boolean {
	const last = messages.at(-1);
	if (last?.role !== 'assistant') return false;
	const parts = last.parts ?? [];
	if (parts.length === 0) return false;
	const lastPart = parts.at(-1) as any;
	const isToolPart =
		typeof lastPart?.type === 'string' &&
		(lastPart.type.startsWith('tool-') || lastPart.type === 'dynamic-tool');
	return (
		isToolPart &&
		(lastPart?.state === 'output-available' ||
			lastPart?.state === 'approval-responded')
	);
}

export function getChatInstance(threadId: string | null): AIChat<UIMessage> {
	const key = threadId ?? NEW_CHAT_KEY;
	if (!chatPool.has(key)) {
		chatPool.set(
			key,
			new AIChat({
				transport: createAuthenticatedChatTransport(),
				sendAutomaticallyWhen: shouldSendAutomatically,
				onData: (dataPart) => {
					if (dataPart.type === 'data-synced') {
						const data = dataPart.data as {
							success: boolean;
							error?: string;
						};
						if (data.success) {
							useChatUIStore.getState().markThreadSynced(key);
						}
					}
				},
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
