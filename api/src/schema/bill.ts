import { PlanEnum, tenant } from '@api/schema/tenant';
import { desc } from 'drizzle-orm';
import {
	boolean,
	date,
	index,
	integer,
	json,
	numeric,
	pgEnum,
	pgTable,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

export enum BillSource {
	PERIODIC = 'periodic',
	PLAN_CHANGE = 'plan_change',
	REFILL = 'refill',
}

export const BillSourceEnum = pgEnum(
	'bill_source',
	Object.values(BillSource) as [BillSource],
);

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
		source: BillSourceEnum().notNull().default(BillSource.PERIODIC),
		months: integer().notNull().default(1),
		details: json().notNull(),
	},
	(table) => [index('bill_created_at_desc').on(desc(table.createdAt))],
);

export type BillDetails = {
	baseBill: number;
	storage?: number;
	embed?: number;
	message?: number;
	refill?: number;
};
