import { SMTP } from '@api/env';
import enFeedbackUpdated from '@api/locales/en/feedback-updated.json' with {
	type: 'json',
};
import enTenantCreation from '@api/locales/en/tenant-creation.json' with {
	type: 'json',
};
import esFeedbackUpdated from '@api/locales/es/feedback-updated.json' with {
	type: 'json',
};
import esTenantCreation from '@api/locales/es/tenant-creation.json' with {
	type: 'json',
};
import { Language } from '@api/schema';
import feedbackUpdatedHbs from '@api/templates/feedback-updated.hbs' with {
	type: 'text',
};
import tenantCreationHbs from '@api/templates/tenant-creation.hbs' with {
	type: 'text',
};
import Handlebars from 'handlebars';

export enum Template {
	FEEDBACK_UPDATED = 'feedback-updated',
	TENANT_CREATION = 'tenant-creation',
}

const FROM = '"Nexata" <noreply@nexata.app>';

const templateSources: Record<Template, string> = {
	[Template.FEEDBACK_UPDATED]: feedbackUpdatedHbs,
	[Template.TENANT_CREATION]: tenantCreationHbs,
};

const templateLocales: Record<
	Template,
	Record<Language, Record<string, string>>
> = {
	[Template.FEEDBACK_UPDATED]: {
		[Language.EN]: enFeedbackUpdated,
		[Language.ES]: esFeedbackUpdated,
	},
	[Template.TENANT_CREATION]: {
		[Language.EN]: enTenantCreation,
		[Language.ES]: esTenantCreation,
	},
};

function getLocale(
	template: Template,
	language: Language,
): Record<string, string> {
	return (
		templateLocales[template][language] ??
		templateLocales[template][Language.EN]
	);
}

export function compileTemplate(
	template: Template,
	data: Record<string, unknown>,
	language: Language = Language.EN,
): string {
	const source = templateSources[template];
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
