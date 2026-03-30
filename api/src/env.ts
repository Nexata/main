import { togetherai } from '@ai-sdk/togetherai';
import type * as schema from '@api/schema';
import { requireEnv, warnEnv } from '@api/utils/env';
import { neon, neonConfig } from '@neondatabase/serverless';
import { Redis } from '@upstash/redis';
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

export const MODEL = togetherai('moonshotai/Kimi-K2.5');
export const LIGHT_MODEL = togetherai(
	'mistralai/Mistral-Small-24B-Instruct-2501',
);
export const REASONING_MODEL = togetherai('zai-org/GLM-5');
export const VLM_MODEL = togetherai(
	'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
);
export const EMBEDDING_MODEL = togetherai.embeddingModel(
	'intfloat/multilingual-e5-large-instruct',
);
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
