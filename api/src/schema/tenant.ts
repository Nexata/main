import { matchRegex } from '@api/utils/sql';
import {
	boolean,
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
		hasApiAccess: boolean().notNull().default(false),
		usageBasedBilling: boolean().notNull().default(false),
		storageLimit: integer()
			.notNull()
			.default(5 * 1024), // 5GB in MB
		embedLimit: integer()
			.notNull()
			.default(2 * 1024 * 250_000), // 2GB worth of tokens (250k tokens/MB)
		createdAt: timestamp().notNull().defaultNow(),
	},
	(t) => [check('tenant_slug_regex', matchRegex(t.slug, /^[a-z0-9]{2,16}$/))],
);
