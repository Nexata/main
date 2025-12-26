import { PRICING } from '@api/env';
import { matchRegex } from '@api/utils/sql';
import { gte } from 'drizzle-orm';
import {
	check,
	integer,
	pgTable,
	timestamp,
	varchar,
} from 'drizzle-orm/pg-core';

export const tenant = pgTable(
	'tenant',
	{
		slug: varchar({ length: 16 }).primaryKey(),
		displayName: varchar({ length: 64 }),
		logoUrl: varchar(),
		baseBill: integer().notNull().default(PRICING.baseBill),
		messageLimit: integer().notNull().default(PRICING.baseBillMessages),
		defaultMessageLimit: integer().notNull().default(PRICING.baseBillMessages),
		usedMessages: integer().notNull().default(0),
		createdAt: timestamp().notNull().defaultNow(),
	},
	(table) => [
		check('slug_regex', matchRegex(table.slug, /^[a-z0-9]{2,16}$/)),
		check('message_limit', gte(table.messageLimit, table.usedMessages)),
	],
);
