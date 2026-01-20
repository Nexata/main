import { tenant } from '@api/schema';
import { lowerIndex } from '@api/utils/sql';
import {
	boolean,
	index,
	pgTable,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

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
	},
	(t) => [
		lowerIndex(t.email, false),
		uniqueIndex('user_email_slug').on(t.email, t.slug),
		index('user_api_key').on(t.apiKey),
	],
);
