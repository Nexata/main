import type * as schema from '@api/schema';
import { requireEnv } from '@api/utils/env';
import { neon } from '@neondatabase/serverless';
import { Redis } from '@upstash/redis';
import { upstashCache } from 'drizzle-orm/cache/upstash';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const NEXATA_SECRET = requireEnv('NEXATA_SECRET');

const CACHE_CREDENTIALS = {
	url: requireEnv('UPSTASH_REDIS_REST_URL'),
	token: requireEnv('UPSTASH_REDIS_REST_TOKEN'),
};

export const cache = new Redis(CACHE_CREDENTIALS);

export const db = drizzle({
	client: neon(requireEnv('DATABASE_URL')),
	cache: upstashCache({
		...CACHE_CREDENTIALS,
		global: true,
		config: { ex: 120 },
	}),
	casing: 'snake_case',
	logger: !IS_PRODUCTION,
}) as NeonHttpDatabase<typeof schema>;

export const PRICING = {
	baseBill: 20,
	baseBillMessages: 100,
	oneMessageRefill: 0.1,
	embedPerMb: 0.009,
	storedMbPerMonth: 0.002,
};
