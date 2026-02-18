import { PlanEnum, tenant } from '@api/schema/tenant';
import { desc } from 'drizzle-orm';
import {
	boolean,
	date,
	index,
	json,
	numeric,
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
		amount: numeric().notNull(),
		plan: PlanEnum().notNull(),
		details: json().notNull(),
	},
	(table) => [index('bill_created_at_desc').on(desc(table.createdAt))],
);
