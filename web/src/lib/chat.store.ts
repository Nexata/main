import { create } from 'zustand';

export type OptimisticThread = {
  id: string;
  title: string;
  isTyping: boolean;
};

type ChatUIState = {
  activeThreadId: string | null;
  optimisticThreads: Record<string, OptimisticThread>;
  setActiveThreadId: (id: string | null) => void;
  upsertOptimisticThread: (thread: OptimisticThread) => void;
  removeOptimisticThread: (threadId: string) => void;
};

export const useChatUIStore = create<ChatUIState>((set) => ({
  activeThreadId: null,
  optimisticThreads: {},

  setActiveThreadId: (id) => set({ activeThreadId: id }),

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
}));
