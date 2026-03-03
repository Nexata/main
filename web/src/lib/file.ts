import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient, withAuthRetry } from "@/api";

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

export type ListDriveDirInput =
  | ListDirPageTokenInput
  | ListDirParamsInput;


  function normalizeDirInput(
    input?: ListDriveDirInput
  ):
    | { cursor: string }
    | {
        path?: string;
        recursive?: boolean;
        limit?: number;
      } {
    if (!input) return {};

    // translate pageToken -> cursor
    if ("pageToken" in input) {
      return { cursor: input.pageToken };
    }

    const clean: {
      path?: string;
      recursive?: boolean;
      limit?: number;
    } = {};

    if (input.path !== undefined) clean.path = input.path;
    if (input.recursive !== undefined)
      clean.recursive = input.recursive;
    if (input.limit !== undefined) clean.limit = input.limit;

    return clean;
  }

/* ======================================================
   DROPBOX
====================================================== */

// List directory
export async function listDropboxDir(
  credentialId: string,
  input?: ListDriveDirInput
) {
  const query = normalizeDirInput(input);

  return withAuthRetry((headers) =>
    apiClient.integration.dropbox[credentialId]!.get({
      $headers: headers,
      $query: query,
    })
  );
}

export type DropboxDir = Awaited<ReturnType<typeof listDropboxDir>>;

export function useDropboxDir(
  credentialId?: string,
  input?: ListDriveDirInput
) {
  return useQuery({
    queryKey: [
      "dropbox-dir",
      credentialId,
      JSON.stringify(input ?? {}),
    ],
    queryFn: () => listDropboxDir(credentialId!, input),
    enabled: !!credentialId,
  });
}

// Ingest
export async function ingestFromDropbox(payload: IngestPayload) {
  return withAuthRetry((headers) =>
    apiClient.integration.dropbox.ingest.post({
      $headers: headers,
      ...payload,
    })
  );
}

export function useIngestFromDropbox() {
  return useMutation({
    mutationFn: ingestFromDropbox,
  });
}

/* ======================================================
   GOOGLE DRIVE
====================================================== */

// List directory
export async function listDriveDir(
  credentialId: string,
  input?: ListDriveDirInput
) {
  const query = normalizeDirInput(input);

  return withAuthRetry((headers) =>
    apiClient.integration.google.drive[credentialId]!.get({
      $headers: headers,
      $query: query,
    })
  );
}

export type DriveDir = Awaited<ReturnType<typeof listDriveDir>>;

export function useDriveDir(
  credentialId?: string,
 input?: ListDriveDirInput
) {
  return useQuery({
    queryKey: [
      "drive-dir",
      credentialId,
      JSON.stringify(input ?? {}),
    ],
    queryFn: () => listDriveDir(credentialId!, input),
    enabled: !!credentialId,
  });
}

// Ingest
export async function ingestFromDrive(payload: IngestPayload) {
  return withAuthRetry((headers) =>
    apiClient.integration.google.drive.ingest.post({
      $headers: headers,
      ...payload,
    })
  );
}

export function useIngestFromDrive() {
  return useMutation({
    mutationFn: ingestFromDrive,
  });
}

/* ======================================================
ONEDRIVE
====================================================== */

// List directory
export async function listOneDriveDir(
  credentialId: string,
  input?: ListDriveDirInput
) {
  const query = normalizeDirInput(input);

  return withAuthRetry((headers) =>
    apiClient.integration.microsoft.onedrive[credentialId]!.get({
      $headers: headers,
      $query: query,
    })
  );
}

export type OneDriveDir = Awaited<ReturnType<typeof listDriveDir>>;

export function useOneDriveDir(
  credentialId?: string,
 input?: ListDriveDirInput
) {
  return useQuery({
    queryKey: [
      "onedrive-dir",
      credentialId,
      JSON.stringify(input ?? {}),
    ],
    queryFn: () => listOneDriveDir(credentialId!, input),
    enabled: !!credentialId,
  });
}

// Ingest
export async function ingestFromOneDrive(payload: IngestPayload) {
  return withAuthRetry((headers) =>
    apiClient.integration.microsoft.onedrive.ingest.post({
      $headers: headers,
      ...payload,
    })
  );
}

export function useIngestFromOneDrive() {
  return useMutation({
    mutationFn: ingestFromOneDrive,
  });
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

export type SearchFilesParams = Parameters<typeof apiClient.file.get>[0]["$query"];

type IngestBody = Parameters<typeof apiClient.file.post>[0];
export type IngestFilesPayload = Pick<IngestBody, "files" | "metadata">;

/* ---------- Ingest ---------- */

export async function ingestFiles(payload: IngestFilesPayload) {
  return withAuthRetry((headers) =>
    apiClient.file.post({
      $headers: headers,
      ...payload,
    })
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
    })
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
    })
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
    })
  );
}

export type SearchFilesResult = Awaited<ReturnType<typeof searchFiles>>;

export function useSearchFiles(params?: SearchFilesParams) {
  return useQuery({
    queryKey: ["platform-files", JSON.stringify(params ?? {})],
    queryFn: () => searchFiles(params),
  });
}
