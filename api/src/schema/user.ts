import { tenant } from '@api/schema/tenant';
import { lowerIndex } from '@api/utils/sql';
import {
	boolean,
	index,
	pgEnum,
	pgTable,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

export enum Language {
	EN = 'en',
	ES = 'es',
}

export const LanguageEnum = pgEnum(
	'language',
	Object.values(Language) as [Language],
);

export const user = pgTable(
	'user',
	{
		id: uuid().primaryKey().defaultRandom(),
		slug: varchar({ length: 32 })
			.notNull()
			.references(() => tenant.slug, { onDelete: 'cascade' }),
		email: varchar({ length: 320 }).notNull(),
		displayName: varchar({ length: 64 }),
		pfpUrl: varchar(),
		apiKey: varchar({ length: 255 }),
		isAdmin: boolean().notNull().default(false),
		language: LanguageEnum().notNull().default(Language.EN),
	},
	(t) => [
		lowerIndex(t.email, false),
		uniqueIndex('user_email_slug').on(t.email, t.slug),
		index('user_api_key').on(t.apiKey),
	],
);
