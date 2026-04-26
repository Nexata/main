import { Redis } from '@upstash/redis';

const CACHE_CREDENTIALS = {
	url: process.env.UPSTASH_REDIS_REST_URL,
	token: process.env.UPSTASH_REDIS_REST_TOKEN,
};

export const cache = new Redis(CACHE_CREDENTIALS);
