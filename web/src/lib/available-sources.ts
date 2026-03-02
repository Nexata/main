import type { CredentialItem } from '@/lib/credential';
import { getDropboxCredentialUrl, getGoogleCredentialUrl } from '@/lib/oauth';
import {
  listDriveDir,
  listDropboxDir,
  ingestFromDrive,
  ingestFromDropbox,
  type ListDriveDirInput,
  type IngestPayload,
} from "./file";
import { apiClient } from '@/api';

type OauthProvider = `${CredentialItem['provider']}`;
type OauthScope = `${CredentialItem['scope']}`;

export type SourceConfig = {
	id: string;
	provider: OauthProvider;
	name: string;
	icon: string;
	scope: OauthScope;
	connect: () => Promise<string>;
	kind: 'dynamic' | 'storage';
  getFileTree?: (credentialId: string, input?: ListDriveDirInput) => Promise<any>;
	ingest?: (payload: IngestPayload) => Promise<any>;
};

export function credentialsBySource(
	source: SourceConfig,
	credentials: CredentialItem[],
): CredentialItem[] {
	return credentials.filter((cred) => cred.provider === source.provider && cred.scope.includes(source.scope));
}

export const DINAMIC_DATA_SOURCES: SourceConfig[] = [
	{
		id: 'gmail',
		provider: 'google',
		name: 'Gmail',
		icon: '/datasource_icons/gmail.png',
		scope: 'gmail',
		connect: () => getGoogleCredentialUrl('gmail'),
		kind: 'dynamic',
	},
	{
		id: 'gcalendar',
		provider: 'google',
		name: 'Google Calendar',
		icon: '/datasource_icons/gcalendar.png',
		scope: 'calendar',
		connect: () => getGoogleCredentialUrl('calendar'),
		kind: 'dynamic',
	},
	{
		id: 'outlook',
		provider: 'microsoft',
		name: 'Outlook',
		icon: '/datasource_icons/outlook.png',
		scope: 'outlook',
		connect: async () => '',
		kind: 'dynamic',
	},
	{
		id: 'outlook_calendar',
		provider: 'microsoft',
		name: 'Outlook Calendar',
		icon: '/datasource_icons/ocalendar.png',
		scope: 'outlook_calendar',
		connect: async () => '',
		kind: 'dynamic',
	},
];

export const STORAGE_DATA_SOURCES: SourceConfig[] = [
	{
		id: 'drive',
		provider: 'google',
		name: 'Google Drive',
		icon: '/datasource_icons/gdrive.png',
		scope: 'drive',
		connect: () => getGoogleCredentialUrl('drive'),
		kind: 'storage',
    getFileTree: (credentialId, input) => listDriveDir(credentialId, input),
    ingest: ingestFromDrive,
  },
  {
		id: 'dropbox',
		provider: 'dropbox',
		name: 'Dropbox',
		icon: '/datasource_icons/dropbox.png',
		scope: 'dropbox',
		connect: () => getDropboxCredentialUrl(),
		kind: 'storage',
    getFileTree: (credentialId, input) => listDropboxDir(credentialId, input),
    ingest: ingestFromDropbox,
  },
	{
		id: 'onedrive',
		provider: 'microsoft',
		name: 'OneDrive',
		icon: '/datasource_icons/onedrive.png',
		scope: 'onedrive',
		connect: async () => '',
		kind: 'storage',
		getFileTree: async (_credentialId) => {
			return [];
		},
	},
];
