export type NexataListDirEntry = {
	id: string;
	name: string;
	size?: number; // in MB
	path?: string;
	ext?: 'folder' | string;
	updatedAt?: Date;
	extra?: object;
};

export type NexataListDir = {
	entries: NexataListDirEntry[];
	cursor: string | null;
};
