const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function isTransientError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;

	const message = error.message;
	const name = error.name;

	if (
		name === 'TimeoutError' ||
		message.includes('fetch failed') ||
		message.includes('ECONNRESET') ||
		message.includes('ETIMEDOUT') ||
		message.includes('UND_ERR_CONNECT_TIMEOUT') ||
		message.includes('operation timed out') ||
		message.includes('socket hang up')
	)
		return true;

	for (const code of TRANSIENT_STATUS_CODES)
		if (message.includes(`${code}`)) return true;

	if ('status' in error && typeof error.status === 'number')
		return TRANSIENT_STATUS_CODES.has(error.status);

	if (
		'cause' in error &&
		error.cause instanceof Error &&
		isTransientError(error.cause)
	)
		return true;

	return false;
}

export async function withRetry<T>(
	fn: () => Promise<T>,
	maxRetries = 3,
	baseDelay = 1000,
): Promise<T> {
	let lastError: unknown;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;

			if (attempt >= maxRetries || !isTransientError(error)) throw error;

			const delay = baseDelay * 2 ** attempt;
			await new Promise((r) => setTimeout(r, delay));
		}
	}

	throw lastError;
}
