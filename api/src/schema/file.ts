import { credential, thread, user } from '@api/schema';
import {
	boolean,
	jsonb,
	pgEnum,
	pgTable,
	timestamp,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

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

export const file = pgTable('file', {
	id: uuid().primaryKey().defaultRandom(),
	userId: uuid()
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	provider: FileHostEnum().notNull().default(FileHost.NEXATA),
	threadId: uuid().references(() => thread.id),
	externalId: varchar({ length: 256 }),
	credentialId: uuid().references(() => credential.id),
	autoSync: boolean().notNull().default(true),
	url: varchar(),
	name: varchar({ length: 96 }).notNull(),
	extension: varchar({ length: 8 }),
	metadata: jsonb(),
	modifiedAt: timestamp().notNull().defaultNow(),
	createdAt: timestamp().notNull().defaultNow(),
});
