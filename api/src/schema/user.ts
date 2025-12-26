import { tenant } from '@api/schema';
import { lowerIndex } from '@api/utils/sql';
import {
	boolean,
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
		isAdmin: boolean().notNull().default(false),
	},
	(table) => [
		lowerIndex(table.email, false),
		uniqueIndex('email_slug').on(table.email, table.slug),
	],
);
