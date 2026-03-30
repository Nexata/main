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
 * Only auto-continue when the last assistant message contains a non-provider
 * tool call that has just been fully resolved (state === 'output-available')
 * or a tool approval that has been responded to (state === 'approval-responded').
 *
 * The AI SDK re-evaluates auto-submit after tool responses are added and again
 * after the follow-up stream finishes, so we pair this predicate with a per-chat
 * one-shot toolCallId guard below. That lets one continuation fire for a given
 * resolved tool call while suppressing the duplicate terminal submit.
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

	// Scan ALL parts (not just the last) because the LLM may append a text
	// part after the tool call (e.g. "Please fill in the form above"),
	// pushing the tool part away from the tail position.
	//
	// Exclude providerExecuted tools — those were resolved inline by the
	// server during streaming and don't need a client-initiated round-trip.
	return parts.some((p: any) => {
		const isToolPart =
			typeof p?.type === 'string' &&
			(p.type.startsWith('tool-') || p.type === 'dynamic-tool');
		return (
			isToolPart &&
			!p.providerExecuted &&
			(p?.state === 'output-available' || p?.state === 'approval-responded')
		);
	});
}

function getLatestAutoSubmittableToolCallId(
	messages: UIMessage[],
): string | null {
	const last = messages.at(-1);
	if (last?.role !== 'assistant') return null;

	const parts = last.parts ?? [];
	for (let index = parts.length - 1; index >= 0; index -= 1) {
		const part = parts[index] as any;
		const isToolPart =
			typeof part?.type === 'string' &&
			(part.type.startsWith('tool-') || part.type === 'dynamic-tool');
		if (!isToolPart || part.providerExecuted) continue;
		if (
			part?.state !== 'output-available' &&
			part?.state !== 'approval-responded'
		) {
			continue;
		}

		return typeof part.toolCallId === 'string' ? part.toolCallId : null;
	}

	return null;
}

export function getChatInstance(threadId: string | null): AIChat<UIMessage> {
	const key = threadId ?? NEW_CHAT_KEY;
	if (!chatPool.has(key)) {
		const keyRef = { current: key };
		const autoSubmitState = { lastToolCallId: null as string | null };
		keyRefs.set(key, keyRef);
		chatPool.set(
			key,
			new AIChat({
				transport: createAuthenticatedChatTransport(),
				sendAutomaticallyWhen: ({ messages }) => {
					if (!shouldSendAutomatically({ messages })) return false;

					const toolCallId = getLatestAutoSubmittableToolCallId(messages);
					if (!toolCallId) return false;
					if (autoSubmitState.lastToolCallId === toolCallId) return false;

					autoSubmitState.lastToolCallId = toolCallId;
					return true;
				},
				onFinish: ({ isAbort, isDisconnect, isError }) => {
					if (isAbort || isDisconnect || isError) {
						autoSubmitState.lastToolCallId = null;
					}
				},
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
