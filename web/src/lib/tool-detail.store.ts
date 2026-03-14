import { create } from 'zustand';

export type ToolDetailData = {
	toolName: string;
	toolCallId: string;
	state: string;
	input: unknown;
	output: unknown;
};

type ToolDetailState = {
	selectedTool: ToolDetailData | null;
	isOpen: boolean;
	openTool: (tool: ToolDetailData) => void;
	close: () => void;
};

export const useToolDetailStore = create<ToolDetailState>()((set) => ({
	selectedTool: null,
	isOpen: false,
	openTool: (tool) => set({ selectedTool: tool, isOpen: true }),
	close: () => set({ selectedTool: null, isOpen: false }),
}));
