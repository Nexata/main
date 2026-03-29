import { Chat as AIChat, type UIMessage } from '@ai-sdk/react';
import { useChatUIStore } from './chat.store';
import { createAuthenticatedChatTransport } from './chat-transport';

/**
 * Module-level pool of AI SDK Chat instances, keyed by thread ID.
 * Each thread gets its own Chat instance so streams don't collide.
 */
const chatPool = new Map<string, AIChat<UIMessage>>();

/**
 * Mutable key refs so the `onData` closure always sees the current key
 * even after a __new__ → realThreadId promotion.
 */
const keyRefs = new Map<string, { current: string }>();

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

	// Collect all tool-related parts (tool-invocation, tool-approval, dynamic-tool)
	const toolParts = parts.filter((part: any) => {
		const type = part?.type;
		return (
			typeof type === 'string' &&
			(type.startsWith('tool-') || type === 'dynamic-tool')
		);
	}) as any[];

	// Must have at least one tool part
	if (toolParts.length === 0) return false;

	// ALL tool parts must be in a resolved state.
	// If ANY tool part is still pending approval or awaiting input, do NOT auto-send.
	return toolParts.every(
		(part) =>
			part.state === 'output-available' || part.state === 'approval-responded',
	);
}

export function getChatInstance(threadId: string | null): AIChat<UIMessage> {
	const key = threadId ?? NEW_CHAT_KEY;
	if (!chatPool.has(key)) {
		const keyRef = { current: key };
		keyRefs.set(key, keyRef);
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
							useChatUIStore.getState().markThreadSynced(keyRef.current);
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

		// Migrate the mutable keyRef so the onData closure sees the real ID
		const ref = keyRefs.get(NEW_CHAT_KEY);
		if (ref) {
			ref.current = realThreadId;
			keyRefs.set(realThreadId, ref);
			keyRefs.delete(NEW_CHAT_KEY);
		}

		// Migrate unsynced state: clear the __new__ entry (now stale)
		// and ensure the real thread ID is tracked as unsynced.
		const store = useChatUIStore.getState();
		store.markThreadSynced(NEW_CHAT_KEY);
		store.markThreadUnsynced(realThreadId);
	}
}

/**
 * Clean up when a thread is deleted.
 */
export function removeChatInstance(threadId: string): void {
	chatPool.delete(threadId);
	keyRefs.delete(threadId);
}

/**
 * Get the raw pool map (for background stream monitoring).
 */
export function getChatPool(): Map<string, AIChat<UIMessage>> {
	return chatPool;
}
