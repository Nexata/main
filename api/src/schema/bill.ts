import { tenant } from '@api/schema/tenant';
import { desc } from 'drizzle-orm';
import {
	boolean,
	date,
	index,
	json,
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
		usageBasedBilling: boolean().notNull().default(false),
		details: json().notNull(), // keys being BillableEventType enum keys, values the totals
	},
	(table) => [index('bill_created_at_desc').on(desc(table.createdAt))],
);
