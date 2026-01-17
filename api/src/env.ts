import { deepinfra } from '@ai-sdk/deepinfra';
import { groq } from '@ai-sdk/groq';
import type * as schema from '@api/schema';
import { log, requireEnv } from '@api/utils/env';
import { neon } from '@neondatabase/serverless';
import { Redis } from '@upstash/redis';
import { createFallback } from 'ai-fallback';
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

export const FALLBACK_BEHAVIOR: {
	retryAfterOutput?: boolean;
	modelResetInterval?: number;
	shouldRetryThisError?: (error: Error) => boolean;
	onError?: (error: Error, modelId: string) => void | Promise<void>;
} = {
	onError: (error, modelId) => log('warn', { error, modelId }),
	shouldRetryThisError: (e) =>
		'statusCode' in e &&
		typeof e.statusCode === 'number' &&
		e.statusCode >= 401,
};

export const MODEL = createFallback({
	...FALLBACK_BEHAVIOR,
	// TODO: once groq is being paid, put deepinfra first
	models: [groq('openai/gpt-oss-120b'), deepinfra('openai/gpt-oss-120b')],
});

export const REASONING_MODEL = createFallback({
	...FALLBACK_BEHAVIOR,
	models: [
		deepinfra('deepseek-ai/DeepSeek-V3.2'),
		groq('moonshotai/kimi-k2-instruct-0905'),
	],
});

export const VLM_MODEL = createFallback({
	...FALLBACK_BEHAVIOR,
	models: [
		groq('meta-llama/llama-4-scout-17b-16e-instruct'),
		deepinfra('meta-llama/Llama-4-Scout-17B-16E-Instruct'),
	],
});

export const EMBEDDING_MODEL = deepinfra.embeddingModel('BAAI/bge-m3');
export const EMBEDDING_DIMENSIONS = 1024;
export const EMBEDDING_SIZE = 768;
export const EMBEDDING_OVERLAP = 94;
