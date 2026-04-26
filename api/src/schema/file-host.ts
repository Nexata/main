import { pgEnum } from 'drizzle-orm/pg-core';

export enum FileHost {
	NEXATA = 'nexata',
	DRIVE = 'drive',
	ONE_DRIVE = 'one_drive',
	DROPBOX = 'dropbox',
	LEGAJOX = 'legajox',
}

export const PROVIDER_LABELS: Record<FileHost, string> = {
	[FileHost.NEXATA]: 'Nexata',
	[FileHost.DRIVE]: 'Google Drive',
	[FileHost.DROPBOX]: 'Dropbox',
	[FileHost.ONE_DRIVE]: 'OneDrive',
	[FileHost.LEGAJOX]: 'Legajox',
};

export const FileHostEnum = pgEnum(
	'file_host',
	Object.values(FileHost) as [FileHost],
);
