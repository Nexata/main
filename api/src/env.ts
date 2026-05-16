import { createOpenAI } from '@ai-sdk/openai';
import type * as schema from '@api/schema';
import { requireEnv, warnEnv } from '@api/utils/env';
import { neon, neonConfig } from '@neondatabase/serverless';
import { Redis } from '@upstash/redis';
import { defaultEmbeddingSettingsMiddleware, wrapEmbeddingModel } from 'ai';
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

const novita = createOpenAI({
	baseURL: 'https://api.novita.ai/openai',
	apiKey: requireEnv('NOVITA_API_KEY'),
});

export const MODEL = novita.chat('deepseek/deepseek-v4-flash');
export const LIGHT_MODEL = novita.chat('openai/gpt-oss-120b');
export const REASONING_MODEL = novita.chat('moonshotai/kimi-k2.6');
export const VLM_MODEL_NAME = warnEnv(
	'VLM_MODEL_NAME',
	'google/gemma-4-26b-a4b-it',
);
export const VLM_MODEL = novita.chat(VLM_MODEL_NAME);
export const EMBEDDING_DIMENSIONS = 2048;
export const EMBEDDING_MODEL = wrapEmbeddingModel({
	model: novita.embeddingModel('qwen/qwen3-embedding-8b'),
	middleware: defaultEmbeddingSettingsMiddleware({
		settings: {
			providerOptions: {
				openai: { dimensions: EMBEDDING_DIMENSIONS },
			},
		},
	}),
});
export const EMBEDDING_SIZE = 500;
export const EMBEDDING_OVERLAP = 62;
export const EMBEDDING_DB_MAX = 768;
export const EMBEDDING_BYTES = EMBEDDING_DIMENSIONS * 4;

export const SMTP = createTransport({
	host: requireEnv('SMTP_HOST'),
	port: Number(warnEnv('SMTP_PORT', '587')),
	auth: {
		user: requireEnv('SMTP_USERNAME'),
		pass: requireEnv('SMTP_PASSWORD'),
	},
	requireTLS: true,
});
