import { create } from 'zustand';

type MobileSidebarState = {
	isOpen: boolean;
	open: () => void;
	close: () => void;
	toggle: () => void;
};

export const useMobileSidebarStore = create<MobileSidebarState>()((set) => ({
	isOpen: false,
	open: () => set({ isOpen: true }),
	close: () => set({ isOpen: false }),
	toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));
