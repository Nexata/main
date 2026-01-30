import { credential } from '@api/schema/credential';
import { externalDir } from '@api/schema/external-dir';
import { message } from '@api/schema/message';
import { user } from '@api/schema/user';
import { isNotNull } from 'drizzle-orm';
import {
	boolean,
	jsonb,
	pgEnum,
	pgTable,
	timestamp,
	uniqueIndex,
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

export const file = pgTable(
	'file',
	{
		id: uuid().primaryKey().defaultRandom(),
		userId: uuid()
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		provider: FileHostEnum().notNull().default(FileHost.NEXATA),
		messageId: uuid().references(() => message.id, { onDelete: 'cascade' }),
		externalDirId: uuid().references(() => externalDir.id, {
			onDelete: 'cascade',
		}),
		externalId: varchar(),
		credentialId: uuid().references(() => credential.id),
		autoSync: boolean().notNull().default(false),
		url: varchar(),
		name: varchar({ length: 96 }).notNull(),
		type: varchar({ length: 256 }),
		metadata: jsonb(),
		modifiedAt: timestamp().notNull().defaultNow(),
		createdAt: timestamp().notNull().defaultNow(),
	},
	(t) => [
		uniqueIndex('file_provider_external_id_unique')
			.on(t.provider, t.externalId)
			.where(isNotNull(t.externalId)),
	],
);
