import { matchRegex } from '@api/utils/sql';
import {
	check,
	pgEnum,
	pgTable,
	timestamp,
	varchar,
} from 'drizzle-orm/pg-core';

export enum Plan {
	FREE = 'free',
	PERSONAL = 'personal',
	BUSINESS = 'business',
	PAY_AS_YOU_GO = 'pay_as_you_go',
}

export const PLANS: Record<
	Plan,
	{
		baseBill: number; // In USDs
		messageLimit: number | null; // 1 = 1 message
		storageLimit: number | null; // In MBs
		embedLimit: number | null; // In tokens
		hasApiAccess: boolean;
	}
> = {
	[Plan.FREE]: {
		baseBill: 0,
		messageLimit: 10,
		storageLimit: 10,
		embedLimit: 10 * 250_000,
		hasApiAccess: false,
	},
	[Plan.PERSONAL]: {
		baseBill: 20,
		messageLimit: 125,
		storageLimit: 1 * 1024,
		embedLimit: 1000 * 250_000,
		hasApiAccess: false,
	},
	[Plan.BUSINESS]: {
		baseBill: 100,
		messageLimit: 1000,
		storageLimit: 10 * 1024,
		embedLimit: 5 * 1000 * 250_000,
		hasApiAccess: true,
	},
	[Plan.PAY_AS_YOU_GO]: {
		baseBill: 200,
		messageLimit: null,
		storageLimit: null,
		embedLimit: null,
		hasApiAccess: true,
	},
};

export const USAGE_BASED_PRICING = {
	// In USDs
	perMessage: 0.09, // extraReason implies double
	storagePerMbPerDay: 0.0009,
	embedPerToken: 0.04 / 1000000,
};

export const REFILL_PRICING = {
	perMessage: USAGE_BASED_PRICING.perMessage,
	discounts: [
		{ value: 100, rate: 0.2 },
		{ value: 1000, rate: 0.2 },
	],
};

export const PlanEnum = pgEnum('plan', Object.values(Plan) as [Plan]);

export const tenant = pgTable(
	'tenant',
	{
		slug: varchar({ length: 16 }).primaryKey(),
		displayName: varchar({ length: 64 }),
		logoUrl: varchar(),
		plan: PlanEnum().notNull().default(Plan.FREE),
		billingAt: timestamp().notNull().defaultNow(),
		createdAt: timestamp().notNull().defaultNow(),
	},
	(t) => [check('tenant_slug_regex', matchRegex(t.slug, /^[a-z0-9]{2,16}$/))],
);
