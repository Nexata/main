import { db } from '@api/env';
import { Dropbox } from '@api/integration/dropbox';
import { Drive } from '@api/integration/google/drive';
import { OneDrive } from '@api/integration/microsoft/onedrive';
import { externalDir, FileHost, file } from '@api/schema';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { and, eq, inArray } from 'drizzle-orm';

export type NexataListDirEntry = {
	id: string;
	name: string;
	nexataId: string | null;
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
): Promise<Map<string, string>> {
	if (!ids.length) return new Map();
	const rows = await db
		.select({ id: file.id, externalId: file.externalId })
		.from(file)
		.where(and(eq(file.provider, provider), inArray(file.externalId, ids)));
	return new Map(rows.map((r) => [r.externalId!, r.id]));
}

export async function getIngestedDirIds(
	ids: string[],
	provider: FileHost,
): Promise<Map<string, string>> {
	if (!ids.length) return new Map();
	const rows = await db
		.select({ id: externalDir.id, externalId: externalDir.externalId })
		.from(externalDir)
		.where(
			and(
				eq(externalDir.provider, provider),
				inArray(externalDir.externalId, ids),
			),
		);
	return new Map(rows.map((r) => [r.externalId, r.id]));
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
	[FileHost.ONE_DRIVE]: OneDrive.ingestFromCredential,
};

export async function resolveNexataSelection(
	selection: { id: string; isDir: boolean }[],
	provider: FileHost,
): Promise<{ id: string; isDir: boolean }[]> {
	const fileItems = selection.filter((s) => !s.isDir);
	const dirItems = selection.filter((s) => s.isDir);

	const [resolvedFiles, resolvedDirs] = await Promise.all([
		fileItems.length
			? db
					.select({ id: file.id, externalId: file.externalId })
					.from(file)
					.where(
						and(
							inArray(
								file.id,
								fileItems.map((f) => f.id),
							),
							eq(file.provider, provider),
						),
					)
			: [],
		dirItems.length
			? db
					.select({ id: externalDir.id, externalId: externalDir.externalId })
					.from(externalDir)
					.where(
						and(
							inArray(
								externalDir.id,
								dirItems.map((d) => d.id),
							),
							eq(externalDir.provider, provider),
						),
					)
			: [],
	]);

	if (
		resolvedFiles.length !== fileItems.length ||
		resolvedDirs.length !== dirItems.length
	)
		throw httpError(HttpCode.NOT_FOUND, ErrorCode.FILE_NOT_FOUND);

	return [
		...resolvedFiles.map((f) => ({ id: f.externalId!, isDir: false })),
		...resolvedDirs.map((d) => ({ id: d.externalId, isDir: true })),
	];
}
