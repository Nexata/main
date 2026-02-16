import { db } from '@api/env';
import { Dropbox } from '@api/integration/dropbox';
import { Drive } from '@api/integration/google/drive';
import { externalDir, FileHost, file } from '@api/schema';
import { and, eq, inArray } from 'drizzle-orm';

export type NexataListDirEntry = {
	id: string;
	name: string;
	alreadyIngested: boolean;
	url?: string;
	size?: number; // in MB
	path?: string;
	ext?: 'dir' | string;
	updatedAt?: Date;
	extra?: object;
};

export async function getIngestedFileIds(
	ids: string[],
	provider: FileHost,
): Promise<string[]> {
	if (!ids.length) return [];
	const rows = await db
		.select({ externalId: file.externalId })
		.from(file)
		.where(and(eq(file.provider, provider), inArray(file.externalId, ids)));
	return rows.map((r) => r.externalId!);
}

export async function getIngestedDirIds(
	ids: string[],
	provider: FileHost,
): Promise<string[]> {
	if (!ids.length) return [];
	const rows = await db
		.select({ externalId: externalDir.externalId })
		.from(externalDir)
		.where(
			and(
				eq(externalDir.provider, provider),
				inArray(externalDir.externalId, ids),
			),
		);
	return rows.map((r) => r.externalId);
}

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
