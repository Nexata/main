import { credential } from '@api/schema/credential';
import { FileHostEnum } from '@api/schema/file-host';
import {
	boolean,
	jsonb,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

export const externalDir = pgTable(
	'external_dir',
	{
		id: uuid().primaryKey().defaultRandom(),
		externalId: varchar().notNull(),
		credentialId: uuid().references(() => credential.id, {
			onDelete: 'cascade',
		}),
		name: varchar({ length: 512 }).notNull(),
		provider: FileHostEnum().notNull(),
		url: varchar(),
		autoSync: boolean().notNull().default(false),
		metadata: jsonb(),
		modifiedAt: timestamp().notNull().defaultNow(),
		createdAt: timestamp().notNull().defaultNow(),
	},
	(t) => [
		uniqueIndex('external_dir_provider_external_id').on(
			t.provider,
			t.externalId,
		),
	],
);
