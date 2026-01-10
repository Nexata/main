import { matchRegex } from '@api/utils/sql';
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
		baseBill: integer().notNull().default(20), // PRICING.baseBill
		messageLimit: integer().notNull().default(100), // PRICING.baseBillMessages
		defaultMessageLimit: integer().notNull().default(100), // PRICING.baseBillMessages
		createdAt: timestamp().notNull().defaultNow(),
	},
	(t) => [check('tenant_slug_regex', matchRegex(t.slug, /^[a-z0-9]{2,16}$/))],
);
