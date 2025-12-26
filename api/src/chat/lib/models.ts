import { deepinfra } from '@ai-sdk/deepinfra';
import { groq } from '@ai-sdk/groq';
import { createFallback } from 'ai-fallback';

export const FALLBACK_BEHAVIOR: {
	retryAfterOutput?: boolean;
	modelResetInterval?: number;
	shouldRetryThisError?: (error: Error) => boolean;
	onError?: (error: Error, modelId: string) => void | Promise<void>;
} = {
	onError: (error, modelId) => console.error({ error, modelId }),
	shouldRetryThisError: (e) =>
		'statusCode' in e &&
		typeof e.statusCode === 'number' &&
		e.statusCode >= 401,
};

export const MODEL = createFallback({
	...FALLBACK_BEHAVIOR,
	models: [groq('openai/gpt-oss-120b'), deepinfra('deepseek-ai/DeepSeek-V3.2')],
});

export const REASONING_MODEL = createFallback({
	...FALLBACK_BEHAVIOR,
	models: [
		groq('moonshotai/kimi-k2-instruct-0905'),
		deepinfra('moonshotai/Kimi-K2-Thinking'),
	],
});
