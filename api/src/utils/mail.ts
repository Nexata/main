import { SMTP, SRC_DIR } from '@api/env';
import { Language } from '@api/schema';
import { log } from '@api/utils/env';
import Handlebars from 'handlebars';

export enum Template {
	FEEDBACK_UPDATED = 'feedback-updated',
}

const TEMPLATES_DIR = `${SRC_DIR}/templates`;
const LOCALES_DIR = `${SRC_DIR}/locales`;
const FROM = '"Nexata" <noreply@nexata.app>';

async function loadLocale(
	template: Template,
	language: Language,
): Promise<Record<string, string>> {
	const path = `${LOCALES_DIR}/${language}/${template}.json`;
	const fallbackPath = `${LOCALES_DIR}/${Language.EN}/${template}.json`;

	const file = Bun.file(path);
	if (await file.exists()) return file.json();

	log('warn', `Locale ${language}/${template} not found, falling back to en`);
	return Bun.file(fallbackPath).json();
}

export async function compileTemplate(
	template: Template,
	data: Record<string, unknown>,
	language: Language = Language.EN,
): Promise<string> {
	const [source, locale] = await Promise.all([
		Bun.file(`${TEMPLATES_DIR}/${template}.hbs`).text(),
		loadLocale(template, language),
	]);

	const compiled = Handlebars.compile(source);
	return compiled({ t: locale, ...data });
}

export async function sendMail(options: {
	to: string;
	subject: string;
	html: string;
}): Promise<void> {
	await SMTP.sendMail({
		from: FROM,
		to: options.to,
		subject: options.subject,
		html: options.html,
	});
}

export async function sendTemplateMail(options: {
	to: string;
	template: Template;
	data: Record<string, unknown>;
	language?: Language;
}): Promise<void> {
	const language = options.language ?? Language.EN;

	const [source, locale] = await Promise.all([
		Bun.file(`${TEMPLATES_DIR}/${options.template}.hbs`).text(),
		loadLocale(options.template, language),
	]);

	if (!locale.subject)
		throw new Error(`Missing subject in locale for ${options.template}`);

	const compiled = Handlebars.compile(source);
	const html = compiled({ t: locale, ...options.data });

	await sendMail({
		to: options.to,
		subject: locale.subject,
		html,
	});
}
