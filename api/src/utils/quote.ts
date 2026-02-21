import type { Language } from '@api/schema';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';

export async function getUsdArsQuote(language?: Language): Promise<number> {
	return 2; // TODO: REMOVE. THIS IS FOR TESTING PURPOSES ONLY
	const res = await fetch('https://dolarapi.com/v1/dolares');

	if (!res.ok)
		throw httpError(HttpCode.CONFLICT, ErrorCode.EXTERNAL_ERROR, language);

	const arr = (await res.json()) as { casa: string; venta: number }[];
	const oficial = arr.find((x) => x.casa === 'oficial');

	if (!oficial?.venta)
		throw httpError(HttpCode.CONFLICT, ErrorCode.EXTERNAL_ERROR, language);

	return oficial.venta;
}
