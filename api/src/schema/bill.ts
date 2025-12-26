import { tenant } from '@api/schema';
import { desc } from 'drizzle-orm';
import {
	boolean,
	date,
	index,
	pgTable,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

export const bill = pgTable(
	'bill',
	{
		id: uuid().primaryKey().defaultRandom(),
		slug: varchar({ length: 32 })
			.notNull()
			.references(() => tenant.slug, { onDelete: 'cascade' }),
		createdAt: date().notNull().defaultNow(),
		paid: boolean().notNull().default(false),
	},
	(table) => [index('bill_created_at_desc').on(desc(table.createdAt))],
);
