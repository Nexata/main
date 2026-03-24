/**
 * Safely extract backend error text from an unknown caught error.
 *
 * `withAuthRetry` throws `{ status, message?: string }` where `message`
 * is a JSON-encoded string like `'{"message":{"text":"..."}}'`.
 * The AI SDK `useChat` hook throws `Error` objects with a similar `.message`.
 */
export function extractErrorText(error: unknown): string | undefined {
	const raw =
		typeof error === 'object' && error !== null && 'message' in error
			? (error as { message: unknown }).message
			: undefined;

	if (typeof raw !== 'string') return undefined;

	try {
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed === 'object' && parsed !== null && 'message' in parsed) {
			const inner = (parsed as { message: unknown }).message;
			if (
				typeof inner === 'object' &&
				inner !== null &&
				'text' in inner &&
				typeof (inner as { text: unknown }).text === 'string'
			) {
				return (inner as { text: string }).text;
			}
		}
	} catch {
		// Not JSON — no backend text available
	}

	return undefined;
}
