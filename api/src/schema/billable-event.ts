import { bill } from '@api/schema/bill';
import { tenant } from '@api/schema/tenant';
import { user } from '@api/schema/user';
import { desc, isNotNull, or } from 'drizzle-orm';
import {
	check,
	date,
	index,
	numeric,
	pgEnum,
	pgTable,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

export enum BillableEventType {
	EMBED = 'embed', // Consumption in token usage
	STORAGE = 'storage', // Consumption in MBs
	REFILL = 'refill', // Consumption in messages
}

export const BillableEventTypeEnum = pgEnum(
	'billable_event_type',
	Object.values(BillableEventType) as [BillableEventType],
);

export const billableEvent = pgTable(
	'billable_event',
	{
		id: uuid().primaryKey().defaultRandom(),
		type: BillableEventTypeEnum().notNull(),
		consumption: numeric().notNull(),
		billId: uuid().references(() => bill.id),
		userId: uuid().references(() => user.id),
		slug: varchar({ length: 32 }).references(() => tenant.slug),
		createdAt: date().notNull().defaultNow(),
	},
	(t) => [
		check(
			'bill_event_identifiers',
			or(isNotNull(t.userId), isNotNull(t.slug))!.getSQL(),
		),
		index('billable_event_created_at_desc').on(desc(t.createdAt)),
	],
);
