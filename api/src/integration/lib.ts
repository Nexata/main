export type NexataListDirEntry = {
	id: string;
	name: string;
	url?: string;
	size?: number; // in MB
	path?: string;
	ext?: 'dir' | string;
	updatedAt?: Date;
	extra?: object;
};

export type NexataListDir = {
	cursor: string | null;
	entries: NexataListDirEntry[];
};
