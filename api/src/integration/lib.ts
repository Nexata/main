import { Dropbox } from '@api/integration/dropbox';
import { Drive } from '@api/integration/google/drive';
import { FileHost } from '@api/schema';

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

export type IngestSelection = {
	isDir: boolean;
	id: string;
};

export type ProviderIngestor = (
	userId: string,
	slug: string,
	credentialId: string,
	selection: IngestSelection[],
) => Promise<string>;

export const providerIngestors: Partial<Record<FileHost, ProviderIngestor>> = {
	[FileHost.DROPBOX]: Dropbox.ingestFromCredential,
	[FileHost.DRIVE]: Drive.ingestFromCredential,
};
