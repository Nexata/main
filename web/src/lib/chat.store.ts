import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type OptimisticThread = {
	id: string;
	title: string;
	isTyping: boolean;
};

export type ChatSessionStatus =
	| 'idle'
	| 'new'
	| 'hydrating'
	| 'streaming';

type ChatUIState = {
	activeThreadId: string | null;
	status: ChatSessionStatus;
	optimisticThreads: Record<string, OptimisticThread>;

	setActiveThreadId: (id: string | null) => void;
	upsertOptimisticThread: (thread: OptimisticThread) => void;
	removeOptimisticThread: (threadId: string) => void;

	startNewChat: () => void;
	hydrateChat: (threadId: string) => void;
	setStreaming: (threadId: string) => void;
	finishStreaming: () => void;
};

export const useChatUIStore = create<ChatUIState>()(
	persist(
		(set) => ({
			activeThreadId: null,
			status: 'idle',
			optimisticThreads: {},
			startNewChat: () =>
				set({
					activeThreadId: null,
					status: 'new',
				}),
			hydrateChat: (threadId) =>
				set((state) => {
					if (
						state.activeThreadId === threadId &&
						state.status === 'hydrating'
					) {
						return state;
					}

					return {
						activeThreadId: threadId,
						status:
							state.status === 'streaming'
								? state.status
								: 'hydrating',
					};
				}),
			setStreaming: (threadId) =>
				set({
					activeThreadId: threadId,
					status: 'streaming',
				}),
			finishStreaming: () =>
				set((state) => ({
					status: state.activeThreadId ? 'idle' : 'new',
				})),
			setActiveThreadId: (id) =>
				set({
					activeThreadId: id,
				}),
			upsertOptimisticThread: (thread) =>
				set((state) => ({
					optimisticThreads: {
						...state.optimisticThreads,
						[thread.id]: thread,
					},
				})),
			removeOptimisticThread: (threadId) =>
				set((state) => {
					const next = { ...state.optimisticThreads };
					delete next[threadId];
					return { optimisticThreads: next };
				}),
		}),
		{
			name: 'chat-ui-store',
			partialize: (state) => ({
				activeThreadId: state.activeThreadId,
			}),
		},
	),
);
