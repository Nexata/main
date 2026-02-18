import { SMTP } from '@api/env';
import { locales } from '@api/locales';
import { Language } from '@api/schema';
import { templates } from '@api/templates';
import Handlebars from 'handlebars';

export enum Template {
	BILL_GENERATED = 'bill-generated',
	FEEDBACK_UPDATED = 'feedback-updated',
	TENANT_CREATION = 'tenant-creation',
	USER_INVITED = 'user-invited',
}

const FROM = '"Nexata" <noreply@nexata.app>';

function getLocale(
	template: Template,
	language: Language,
): Record<string, string> {
	return (
		locales[language]?.[template] ?? locales[Language.EN]?.[template] ?? {}
	);
}

export function compileTemplate(
	template: Template,
	data: Record<string, unknown>,
	language: Language = Language.EN,
): string {
	const source = templates[template];
	if (!source) throw new Error(`Missing template source for ${template}`);

	const locale = getLocale(template, language);
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
	const locale = getLocale(options.template, language);

	if (!locale.subject)
		throw new Error(`Missing subject in locale for ${options.template}`);

	const html = compileTemplate(options.template, options.data, language);

	await sendMail({
		to: options.to,
		subject: locale.subject,
		html,
	});
}
