import { deepinfra } from '@ai-sdk/deepinfra';
import { groq } from '@ai-sdk/groq';
import type * as schema from '@api/schema';
import { log, requireEnv, warnEnv } from '@api/utils/env';
import { neon, neonConfig } from '@neondatabase/serverless';
import { Redis } from '@upstash/redis';
import { createFallback } from 'ai-fallback';
import { upstashCache } from 'drizzle-orm/cache/upstash';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { createTransport } from 'nodemailer';

export const IS_PRODUCTION = warnEnv('NODE_ENV', 'production') === 'production';
export const NEXATA_SECRET = requireEnv('NEXATA_SECRET');

if (!IS_PRODUCTION && process.env.NEON_PROXY_URL) {
	const proxyUrl = process.env.NEON_PROXY_URL;
	neonConfig.fetchEndpoint = (_host) => `${proxyUrl}/sql`;
}

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
	models: [deepinfra('zai-org/GLM-5'), groq('openai/gpt-oss-120b')],
});

export const LIGHT_MODEL = createFallback({
	...FALLBACK_BEHAVIOR,
	models: [groq('openai/gpt-oss-20b'), deepinfra('zai-org/GLM-4.7-Flash')],
});

export const REASONING_MODEL = createFallback({
	...FALLBACK_BEHAVIOR,
	models: [
		deepinfra('moonshotai/Kimi-K2.5'),
		groq('moonshotai/kimi-k2-instruct-0905'),
	],
});

const deepinfraVlm = deepinfra('meta-llama/Llama-4-Scout-17B-16E-Instruct');
(deepinfraVlm as any).supportsStructuredOutputs = true;

export const VLM_MODEL = createFallback({
	...FALLBACK_BEHAVIOR,
	models: [groq('meta-llama/llama-4-scout-17b-16e-instruct'), deepinfraVlm],
});

export const EMBEDDING_MODEL = deepinfra.embeddingModel('BAAI/bge-m3');
export const EMBEDDING_DIMENSIONS = 1024;
export const EMBEDDING_SIZE = 768;
export const EMBEDDING_OVERLAP = 94;

export const SMTP = createTransport({
	host: requireEnv('SMTP_HOST'),
	port: Number(warnEnv('SMTP_PORT', '587')),
	auth: {
		user: requireEnv('SMTP_USERNAME'),
		pass: requireEnv('SMTP_PASSWORD'),
	},
	requireTLS: true,
});
