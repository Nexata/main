import { db } from '@api/env';
import { Dropbox } from '@api/integration/dropbox';
import { Drive } from '@api/integration/google/drive';
import { Legajox } from '@api/integration/legajox';
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

/**
 * Checks if a file is unmodified by comparing the remote modifiedAt
 * against the stored modifiedAt in the database.
 * Returns true if the file exists and has not been modified (skip download).
 */
export async function isFileUnmodified(
	provider: FileHost,
	externalId: string,
	remoteModifiedAt: Date | undefined,
): Promise<boolean> {
	if (!remoteModifiedAt) return false;

	const existing = (
		await db
			.select({ modifiedAt: file.modifiedAt })
			.from(file)
			.where(and(eq(file.provider, provider), eq(file.externalId, externalId)))
	).at(0);

	return !!existing && existing.modifiedAt >= remoteModifiedAt;
}

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

export type IngestResult = {
	ok: number;
	unmodified: number;
	failed: number;
};

export type ProviderIngestor = (
	userId: string,
	slug: string,
	credentialId: string,
	selection: IngestSelection[],
) => Promise<IngestResult>;

export function ingestResultToStatus(results: IngestResult): string {
	return !results.failed && results.ok
		? 'OK'
		: results.ok && results.failed
			? 'PARTIAL'
			: results.failed
				? 'FAILED'
				: 'UNMODIFIED';
}

export const providerIngestors: Partial<Record<FileHost, ProviderIngestor>> = {
	[FileHost.DROPBOX]: Dropbox.ingestFromCredential,
	[FileHost.DRIVE]: Drive.ingestFromCredential,
	[FileHost.LEGAJOX]: Legajox.ingestFromCredential,
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
