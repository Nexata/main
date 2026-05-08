import { log } from '@api/utils/env';
import { APICallError, RetryError } from 'ai';
import pLimit from 'p-limit';

const VLM_CONCURRENCY = envInt('VLM_CONCURRENCY', 2, 1);
const VLM_MIN_DELAY_MS = envInt('VLM_MIN_DELAY_MS', 750, 0);
const VLM_COOLDOWN_MS = envInt('VLM_COOLDOWN_MS', 15_000, 0);
const VLM_MAX_RETRIES = envInt('VLM_MAX_RETRIES', 6, 0);
const VLM_BASE_RETRY_DELAY_MS = envInt('VLM_BASE_RETRY_DELAY_MS', 2_000, 0);
const VLM_MAX_RETRY_DELAY_MS = envInt('VLM_MAX_RETRY_DELAY_MS', 60_000, 1);

const vlmLimit = pLimit(VLM_CONCURRENCY);
let cooldownUntil = 0;
let nextStartAt = 0;
let startGate: Promise<void> = Promise.resolve();

function envInt(key: string, fallback: number, min: number): number {
	const value = process.env[key];
	if (!value) return fallback;

	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return fallback;

	return Math.max(min, Math.floor(parsed));
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : '';
}

function getRetryHeaders(error: unknown): Record<string, string> | undefined {
	if (!error || typeof error !== 'object') return undefined;

	const headers = (error as { responseHeaders?: unknown }).responseHeaders;
	if (!headers || typeof headers !== 'object') return undefined;

	return Object.fromEntries(
		Object.entries(headers).map(([key, value]) => [
			key.toLowerCase(),
			String(value),
		]),
	);
}

function getRetryAfterMs(error: unknown): number | null {
	const headers = getRetryHeaders(error);
	if (!headers) return null;

	const retryAfterMs = headers['retry-after-ms'];
	if (retryAfterMs) {
		const parsed = Number(retryAfterMs);
		if (Number.isFinite(parsed) && parsed >= 0) return parsed;
	}

	const retryAfter = headers['retry-after'];
	if (!retryAfter) return null;

	const seconds = Number(retryAfter);
	if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;

	const dateDelay = Date.parse(retryAfter) - Date.now();
	return Number.isFinite(dateDelay) && dateDelay >= 0 ? dateDelay : null;
}

function isRateLimitError(error: unknown): boolean {
	if (APICallError.isInstance(error)) {
		const status =
			(error as { statusCode?: number; status?: number }).statusCode ??
			(error as { status?: number }).status;
		return (
			status === 429 || getErrorMessage(error).includes('Too Many Requests')
		);
	}

	if (RetryError.isInstance(error))
		return (
			error.errors.some(isRateLimitError) || isRateLimitError(error.lastError)
		);

	return getErrorMessage(error).includes('Too Many Requests');
}

function isRetryableVlmError(error: unknown): boolean {
	if (isRateLimitError(error)) return true;

	if (error instanceof Error && error.name === 'TimeoutError') return true;

	if (APICallError.isInstance(error)) {
		const status =
			(error as { statusCode?: number; status?: number }).statusCode ??
			(error as { status?: number }).status;
		return (
			(error as { isRetryable?: boolean }).isRetryable === true ||
			status === 500 ||
			status === 502 ||
			status === 503 ||
			status === 504
		);
	}

	if (RetryError.isInstance(error))
		return (
			error.errors.some(isRetryableVlmError) ||
			isRetryableVlmError(error.lastError)
		);

	const message = getErrorMessage(error);
	return (
		message.includes('fetch failed') ||
		message.includes('ECONNRESET') ||
		message.includes('ETIMEDOUT') ||
		message.includes('UND_ERR_CONNECT_TIMEOUT') ||
		message.includes('operation timed out') ||
		message.includes('socket hang up') ||
		message.includes('Service unavailable')
	);
}

function retryDelay(error: unknown, attempt: number): number {
	const retryAfterMs = getRetryAfterMs(error);
	if (retryAfterMs !== null) return retryAfterMs;

	const exponential = VLM_BASE_RETRY_DELAY_MS * 2 ** attempt;
	const jitter = Math.floor(Math.random() * Math.min(1_000, exponential));
	return Math.min(exponential + jitter, VLM_MAX_RETRY_DELAY_MS);
}

async function waitForStartSlot() {
	let release!: () => void;
	const previous = startGate;
	startGate = new Promise((resolve) => {
		release = resolve;
	});

	await previous;

	try {
		const waitUntil = Math.max(cooldownUntil, nextStartAt);
		const waitMs = waitUntil - Date.now();
		if (waitMs > 0) await sleep(waitMs);

		nextStartAt = Date.now() + VLM_MIN_DELAY_MS;
	} finally {
		release();
	}
}

function applyCooldown(error: unknown, delayMs: number) {
	if (!isRateLimitError(error)) return;

	const cooldownMs = Math.max(
		delayMs,
		getRetryAfterMs(error) ?? VLM_COOLDOWN_MS,
	);
	cooldownUntil = Math.max(cooldownUntil, Date.now() + cooldownMs);
	log('warn', {
		event: 'vlm_rate_limited',
		cooldownMs,
		message: getErrorMessage(error),
	});
}

export async function withVlmRateLimit<T>(fn: () => Promise<T>): Promise<T> {
	return vlmLimit(async () => {
		let lastError: unknown;

		for (let attempt = 0; attempt <= VLM_MAX_RETRIES; attempt++) {
			await waitForStartSlot();

			try {
				return await fn();
			} catch (error) {
				lastError = error;

				if (attempt >= VLM_MAX_RETRIES || !isRetryableVlmError(error))
					throw error;

				const delayMs = retryDelay(error, attempt);
				applyCooldown(error, delayMs);
				await sleep(delayMs);
			}
		}

		throw lastError;
	});
}
