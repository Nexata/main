import type { CredentialItem } from '@/lib/credential';
import {
	getDropboxCredentialUrl,
	getGoogleCredentialUrl,
	getMicrosoftCredentialUrl,
} from '@/lib/oauth';
import {
	type IngestPayload,
	ingestFromDrive,
	ingestFromDropbox,
	ingestFromLegajox,
	ingestFromOneDrive,
	type ListDriveDirInput,
	type SearchDirInput,
	listDriveDir,
	listDropboxDir,
	listLegajoxDir,
	listOneDriveDir,
	searchDriveDir,
	searchDropboxDir,
	searchLegajoxDir,
} from './file';

type OauthProvider = `${CredentialItem['provider']}`;
type OauthScope = `${CredentialItem['scope']}`;

export type IngestResult = {
	ok: number;
	unmodified: number;
	failed: number;
};

export type SourceConfig = {
	id: string;
	provider: OauthProvider;
	name: string;
	icon: string;
	scope: OauthScope;
	connect: () => Promise<string>;
	kind: 'dynamic' | 'storage';
	searchMode?: 'remote' | 'local';
	minSearchLength?: number;
	getFileTree?: (
		credentialId: string,
		input?: ListDriveDirInput,
	) => Promise<any>;
	searchFiles?: (credentialId: string, input: SearchDirInput) => Promise<any>;
	ingest?: (payload: IngestPayload) => Promise<IngestResult>;
};

export function credentialsBySource(
	source: SourceConfig,
	credentials: CredentialItem[],
): CredentialItem[] {
	return credentials.filter(
		(cred) =>
			cred.provider === source.provider && cred.scope.includes(source.scope),
	);
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
		connect: async () => getMicrosoftCredentialUrl('outlook'),
		kind: 'dynamic',
	},
	{
		id: 'microsoft_calendar',
		provider: 'microsoft',
		name: 'Outlook Calendar',
		icon: '/datasource_icons/ocalendar.png',
		scope: 'microsoft_calendar',
		connect: async () => getMicrosoftCredentialUrl('microsoft_calendar'),
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
		searchMode: 'remote',
		getFileTree: (credentialId, input) => listDriveDir(credentialId, input),
		searchFiles: (credentialId, input) => searchDriveDir(credentialId, input),
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
		searchMode: 'remote',
		getFileTree: (credentialId, input) => listDropboxDir(credentialId, input),
		searchFiles: (credentialId, input) => searchDropboxDir(credentialId, input),
		ingest: ingestFromDropbox,
	},
	{
		id: 'onedrive',
		provider: 'microsoft',
		name: 'OneDrive',
		icon: '/datasource_icons/onedrive.png',
		scope: 'onedrive',
		connect: async () => getMicrosoftCredentialUrl('onedrive'),
		kind: 'storage',
		searchMode: 'local',
		getFileTree: (credentialId, input) => listOneDriveDir(credentialId, input),
		ingest: ingestFromOneDrive,
	},
];

export const LEGAJOX_SOURCE: SourceConfig = {
	id: 'legajox',
	provider: 'google' as OauthProvider, // unused — Legajox has no OAuth
	name: 'Legajox',
	icon: '/datasource_icons/legajox.svg',
	scope: 'drive' as OauthScope, // unused
	connect: async () => '',
	kind: 'storage',
	searchMode: 'remote',
	minSearchLength: 3,
	getFileTree: (credentialId, input) => listLegajoxDir(credentialId, input),
	searchFiles: (credentialId, input) => searchLegajoxDir(credentialId, input),
	ingest: ingestFromLegajox,
};
