import { SRC_DIR } from '@api/env';
import { Language } from '@api/schema';
import { log } from '@api/utils/env';

const LOCALES_DIR = `${SRC_DIR}/locales`;

export async function loadLocale(
	file: string,
	language: Language,
): Promise<Record<string, string>> {
	const path = `${LOCALES_DIR}/${language}/${file}.json`;
	const fallbackPath = `${LOCALES_DIR}/${Language.EN}/${file}.json`;

	const f = Bun.file(path);
	if (await f.exists()) return f.json();

	log('warn', `Locale ${language}/${file} not found, falling back to en`);
	return Bun.file(fallbackPath).json();
}
