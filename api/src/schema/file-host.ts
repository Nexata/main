import { pgEnum } from 'drizzle-orm/pg-core';

export enum FileHost {
	NEXATA = 'nexata',
	DRIVE = 'drive',
	ONE_DRIVE = 'one_drive',
	DROPBOX = 'dropbox',
}

export const FileHostEnum = pgEnum(
	'file_host',
	Object.values(FileHost) as [FileHost],
);
