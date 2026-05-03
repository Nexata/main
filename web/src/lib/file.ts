import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient, withAuthRetry } from '@/api';

/* ======================================================
   Types + Helper
====================================================== */

export type FileSelectionItem = {
	id: string;
	isDir: boolean;
};

export type IngestPayload = {
	credentialId: string;
	selection: FileSelectionItem[];
};

type ListDirPageTokenInput = {
	pageToken: string;
};

type ListDirParamsInput = {
	path?: string;
	recursive?: boolean;
	limit?: number;
};

export type ListDriveDirInput = ListDirPageTokenInput | ListDirParamsInput;

type SearchDirPageTokenInput = {
	pageToken: string;
};

type SearchDirParamsInput = {
	query: string;
	path?: string;
	maxResults?: number;
};

export type SearchDirInput = SearchDirPageTokenInput | SearchDirParamsInput;

function normalizeDirInput(input?: ListDriveDirInput):
	| { cursor: string }
	| {
			path?: string;
			recursive?: boolean;
			limit?: number;
	  } {
	if (!input) return {};

	// translate pageToken -> cursor
	if ('pageToken' in input) {
		return { cursor: input.pageToken };
	}

	const clean: {
		path?: string;
		recursive?: boolean;
		limit?: number;
	} = {};

	if (input.path !== undefined) clean.path = input.path;
	if (input.recursive !== undefined) clean.recursive = input.recursive;
	if (input.limit !== undefined) clean.limit = input.limit;

	return clean;
}

function normalizeSearchInput(input: SearchDirInput):
	| { cursor: string }
	| {
			query: string;
			path?: string;
			maxResults?: number;
	  } {
	if ('pageToken' in input) {
		return { cursor: input.pageToken };
	}

	const clean: {
		query: string;
		path?: string;
		maxResults?: number;
	} = {
		query: input.query,
	};

	if (input.path !== undefined) clean.path = input.path;
	if (input.maxResults !== undefined) clean.maxResults = input.maxResults;

	return clean;
}

/* ======================================================
   DROPBOX
====================================================== */

// List directory
export async function listDropboxDir(
	credentialId: string,
	input?: ListDriveDirInput,
) {
	const query = normalizeDirInput(input);

	return withAuthRetry((headers) =>
		apiClient.integration.dropbox[credentialId]!.get({
			$headers: headers,
			$query: query,
		}),
	);
}

export type DropboxDir = Awaited<ReturnType<typeof listDropboxDir>>;

export function useDropboxDir(
	credentialId?: string,
	input?: ListDriveDirInput,
) {
	return useQuery({
		queryKey: ['dropbox-dir', credentialId, JSON.stringify(input ?? {})],
		queryFn: () => listDropboxDir(credentialId!, input),
		enabled: !!credentialId,
	});
}

export async function searchDropboxDir(
	credentialId: string,
	input: SearchDirInput,
) {
	const query = normalizeSearchInput(input);

	return withAuthRetry((headers) =>
		apiClient.integration.dropbox.search[credentialId]!.get({
			$headers: headers,
			$query: query,
		}),
	);
}

// Ingest
export async function ingestFromDropbox(payload: IngestPayload) {
	return withAuthRetry((headers) =>
		apiClient.integration.dropbox.ingest.post({
			$headers: headers,
			...payload,
		}),
	);
}

export function useIngestFromDropbox() {
	return useMutation({
		mutationFn: ingestFromDropbox,
	});
}

// Re-ingest
export async function reIngestFromDropbox(payload: IngestPayload) {
	return withAuthRetry((headers) =>
		apiClient.integration.dropbox['re-ingest'].post({
			$headers: headers,
			...payload,
		}),
	);
}

/* ======================================================
   GOOGLE DRIVE
====================================================== */

// List directory
export async function listDriveDir(
	credentialId: string,
	input?: ListDriveDirInput,
) {
	const query = normalizeDirInput(input);

	return withAuthRetry((headers) =>
		apiClient.integration.google.drive[credentialId]!.get({
			$headers: headers,
			$query: query,
		}),
	);
}

export type DriveDir = Awaited<ReturnType<typeof listDriveDir>>;

export function useDriveDir(credentialId?: string, input?: ListDriveDirInput) {
	return useQuery({
		queryKey: ['drive-dir', credentialId, JSON.stringify(input ?? {})],
		queryFn: () => listDriveDir(credentialId!, input),
		enabled: !!credentialId,
	});
}

export async function searchDriveDir(
	credentialId: string,
	input: SearchDirInput,
) {
	const query = normalizeSearchInput(input);

	return withAuthRetry((headers) =>
		apiClient.integration.google.drive.search[credentialId]!.get({
			$headers: headers,
			$query: query,
		}),
	);
}

// Ingest
export async function ingestFromDrive(payload: IngestPayload) {
	return withAuthRetry((headers) =>
		apiClient.integration.google.drive.ingest.post({
			$headers: headers,
			...payload,
		}),
	);
}

export function useIngestFromDrive() {
	return useMutation({
		mutationFn: ingestFromDrive,
	});
}

// Re-ingest
export async function reIngestFromDrive(payload: IngestPayload) {
	return withAuthRetry((headers) =>
		apiClient.integration.google.drive['re-ingest'].post({
			$headers: headers,
			...payload,
		}),
	);
}

/* ======================================================
ONEDRIVE
====================================================== */

// List directory
export async function listOneDriveDir(
	credentialId: string,
	input?: ListDriveDirInput,
) {
	const query = normalizeDirInput(input);

	return withAuthRetry((headers) =>
		apiClient.integration.microsoft.onedrive[credentialId]!.get({
			$headers: headers,
			$query: query,
		}),
	);
}

export type OneDriveDir = Awaited<ReturnType<typeof listDriveDir>>;

export function useOneDriveDir(
	credentialId?: string,
	input?: ListDriveDirInput,
) {
	return useQuery({
		queryKey: ['onedrive-dir', credentialId, JSON.stringify(input ?? {})],
		queryFn: () => listOneDriveDir(credentialId!, input),
		enabled: !!credentialId,
	});
}

export async function searchOneDriveDir(
	credentialId: string,
	input: SearchDirInput,
) {
	const query = normalizeSearchInput(input);

	return withAuthRetry((headers) =>
		apiClient.integration.microsoft.onedrive.search[credentialId]!.get({
			$headers: headers,
			$query: query,
		}),
	);
}

// Ingest
export async function ingestFromOneDrive(payload: IngestPayload) {
	return withAuthRetry((headers) =>
		apiClient.integration.microsoft.onedrive.ingest.post({
			$headers: headers,
			...payload,
		}),
	);
}

export function useIngestFromOneDrive() {
	return useMutation({
		mutationFn: ingestFromOneDrive,
	});
}

// Re-ingest
export async function reIngestFromOneDrive(payload: IngestPayload) {
	return withAuthRetry((headers) =>
		apiClient.integration.microsoft.onedrive['re-ingest'].post({
			$headers: headers,
			...payload,
		}),
	);
}

/* ======================================================
   RE-INGEST DISPATCHER
====================================================== */

export type ReIngestResult = { ok: number; unmodified: number; failed: number };

/**
 * Routes a re-ingest call to the correct provider endpoint.
 * Only integration providers (drive, one_drive, dropbox) are supported.
 */
export async function reIngestByProvider(
	provider: string,
	payload: IngestPayload,
): Promise<ReIngestResult> {
	switch (provider) {
		case 'drive':
			return reIngestFromDrive(payload) as Promise<ReIngestResult>;
		case 'one_drive':
			return reIngestFromOneDrive(payload) as Promise<ReIngestResult>;
		case 'dropbox':
			return reIngestFromDropbox(payload) as Promise<ReIngestResult>;
		case 'legajox':
			return reIngestFromLegajox(payload) as Promise<ReIngestResult>;
		default:
			throw new Error(`Unsupported provider for re-ingest: ${provider}`);
	}
}

/* ======================================================
   PLATFORM FILES
====================================================== */

/* ---------- Types ---------- */

export type PlatformFile = {
	id: string;
	name: string;
	metadata?: unknown;
	provider?: string;
	type?: string;
	createdAt: string;
};

export type DeleteFilesPayload = {
	ids: string[];
};

export type UpdateFilePayload = {
	id: string;
	name?: string;
	metadata?: unknown;
};

export type SearchFilesParams = Parameters<
	typeof apiClient.file.get
>[0]['$query'];

type IngestBody = Parameters<typeof apiClient.file.post>[0];
export type IngestFilesPayload = Pick<IngestBody, 'files' | 'metadata'>;

/* ---------- Ingest ---------- */

export async function ingestFiles(payload: IngestFilesPayload) {
	return withAuthRetry((headers) =>
		apiClient.file.post({
			$headers: headers,
			...payload,
		}),
	);
}

export function useIngestFiles() {
	return useMutation({
		mutationFn: ingestFiles,
	});
}

/* ---------- Delete ---------- */

export async function deleteFiles(payload: DeleteFilesPayload) {
	return withAuthRetry((headers) =>
		apiClient.file.delete({
			$headers: headers,
			...payload,
		}),
	);
}

export function useDeleteFiles() {
	return useMutation({
		mutationFn: deleteFiles,
	});
}

/* ---------- Update ---------- */

export async function updateFile(payload: UpdateFilePayload) {
	const { id, ...body } = payload;

	return withAuthRetry((headers) =>
		apiClient.file[id]!.patch({
			$headers: headers,
			...body,
		}),
	);
}

export function useUpdateFile() {
	return useMutation({
		mutationFn: updateFile,
	});
}

/* ---------- Search ---------- */

export async function searchFiles(params?: SearchFilesParams) {
	return withAuthRetry((headers) =>
		apiClient.file.get({
			$headers: headers,
			$query: params ?? {},
		}),
	);
}

export type SearchFilesResult = Awaited<ReturnType<typeof searchFiles>>;

export function useSearchFiles(params?: SearchFilesParams) {
	return useQuery({
		queryKey: ['platform-files', JSON.stringify(params ?? {})],
		queryFn: () => searchFiles(params),
	});
}

/* ---------- Update file autoSync ---------- */

export async function updateFileAutoSync(id: string, autoSync: boolean) {
	return withAuthRetry((headers) =>
		apiClient.file[id]!.patch({
			$headers: headers,
			autoSync,
		}),
	);
}

/* ======================================================
   EXTERNAL DIRECTORIES
====================================================== */

/* ---------- Types ---------- */

export type ExternalDirListParams = Parameters<
	typeof apiClient.file.dir.get
>[0]['$query'];

/* ---------- List ---------- */

export async function listExternalDirs(params?: ExternalDirListParams) {
	return withAuthRetry((headers) =>
		apiClient.file.dir.get({
			$headers: headers,
			$query: params ?? {},
		}),
	);
}

export type ExternalDirItem = Awaited<
	ReturnType<typeof listExternalDirs>
>[number];

export function useExternalDirs(params?: ExternalDirListParams) {
	return useQuery({
		queryKey: ['external-dirs', JSON.stringify(params ?? {})],
		queryFn: () => listExternalDirs(params),
	});
}

/* ---------- Update (autoSync) ---------- */

export async function updateExternalDir(id: string, autoSync: boolean) {
	return withAuthRetry((headers) =>
		apiClient.file.dir[id]!.patch({
			$headers: headers,
			autoSync,
		}),
	);
}

/* ---------- Delete ---------- */

export async function deleteExternalDir(id: string) {
	return withAuthRetry((headers) =>
		apiClient.file.dir[id]!.delete({
			$headers: headers,
		}),
	);
}

/* ======================================================
   LEGAJOX
====================================================== */

export async function listLegajoxDir(
	_credentialId: string,
	input?: ListDriveDirInput,
) {
	const query = normalizeDirInput(input);

	return withAuthRetry((headers) =>
		apiClient.integration.legajox.get({
			$headers: headers,
			$query: query as { path?: string },
		}),
	);
}

export async function searchLegajoxDir(
	_credentialId: string,
	input: SearchDirInput,
) {
	const query = normalizeSearchInput(input);

	if ('cursor' in query) {
		return listLegajoxDir(_credentialId, { pageToken: query.cursor });
	}

	return withAuthRetry((headers) =>
		apiClient.integration.legajox.search.get({
			$headers: headers,
			$query: {
				q: query.query,
				...(query.path ? { path: query.path } : {}),
			},
		}),
	);
}

export async function ingestFromLegajox(payload: IngestPayload) {
	return withAuthRetry((headers) =>
		apiClient.integration.legajox.ingest.post({
			$headers: headers,
			selection: payload.selection,
		}),
	);
}

export async function reIngestFromLegajox(payload: IngestPayload) {
	return withAuthRetry((headers) =>
		apiClient.integration.legajox['re-ingest'].post({
			$headers: headers,
			selection: payload.selection,
		}),
	);
}
