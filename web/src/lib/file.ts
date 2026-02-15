import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient, withAuthRetry } from "@/api";

/* ======================================================
   Types
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
  path?: string | null;
  recursive?: boolean | null;
  limit?: number | null;
};

export type ListDriveDirInput =
  | ListDirPageTokenInput
  | ListDirParamsInput;


/* ======================================================
   DROPBOX
====================================================== */

// List directory
export async function listDropboxDir(credentialId: string) {
  return withAuthRetry((headers) =>
    apiClient.integration.dropbox[credentialId]!.get({
      $headers: headers,
    })
  );
}

export type DropboxDir = Awaited<ReturnType<typeof listDropboxDir>>;

export function useDropboxDir(credentialId?: string) {
  return useQuery({
    queryKey: ["dropbox-dir", credentialId],
    queryFn: () => listDropboxDir(credentialId!),
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
  return withAuthRetry((headers) =>
    apiClient.integration.google.drive[credentialId]!.get({
      $headers: headers,
      query: input,
    })
  );
}

export type DriveDir = Awaited<ReturnType<typeof listDriveDir>>;

export function useDriveDir(
  credentialId?: string,
  input?: ListDriveDirInput
) {
  return useQuery({
    queryKey: ["drive-dir", credentialId, input],
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
