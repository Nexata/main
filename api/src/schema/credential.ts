import { user } from '@api/schema/user';
import { desc } from 'drizzle-orm';
import { index } from 'drizzle-orm/gel-core';
import {
	boolean,
	pgEnum,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

export enum OauthProvider {
	GOOGLE = 'google',
	MICROSOFT = 'microsoft',
	DROPBOX = 'dropbox',
	NOTION = 'notion',
}

export enum OauthScope {
	GMAIL = 'gmail',
	DRIVE = 'drive',
	CALENDAR = 'calendar',
	OUTLOOK = 'outlook',
	MICROSOFT_CALENDAR = 'microsoft_calendar',
	ONE_DRIVE = 'onedrive',
	DROPBOX = 'dropbox',
}

export const scopesPerProvider: Record<OauthProvider, OauthScope[]> = {
	[OauthProvider.GOOGLE]: [
		OauthScope.GMAIL,
		OauthScope.DRIVE,
		OauthScope.CALENDAR,
	],
	[OauthProvider.MICROSOFT]: [
		OauthScope.OUTLOOK,
		OauthScope.MICROSOFT_CALENDAR,
		OauthScope.ONE_DRIVE,
	],
	[OauthProvider.DROPBOX]: [OauthScope.DROPBOX],
	[OauthProvider.NOTION]: [],
} as const;

export const realOauthScopes: Record<OauthScope, string[]> = {
	[OauthScope.GMAIL]: ['https://www.googleapis.com/auth/gmail.readonly'],
	[OauthScope.DRIVE]: ['https://www.googleapis.com/auth/drive.readonly'],
	[OauthScope.CALENDAR]: ['https://www.googleapis.com/auth/calendar.readonly'],
	[OauthScope.OUTLOOK]: ['https://graph.microsoft.com/Mail.Read'],
	[OauthScope.MICROSOFT_CALENDAR]: [
		'https://graph.microsoft.com/Calendars.Read',
	],
	[OauthScope.ONE_DRIVE]: [
		'https://graph.microsoft.com/Files.Read.All',
		'https://graph.microsoft.com/Sites.Read.All',
	],
	[OauthScope.DROPBOX]: ['files.metadata.read', 'files.content.read'],
} as const;

export const OauthProviderEnum = pgEnum(
	'oauth_provider',
	Object.values(OauthProvider) as [OauthProvider],
);

export const OauthScopeEnum = pgEnum(
	'oauth_scope',
	Object.values(OauthScope) as [OauthScope],
);

export const credential = pgTable(
	'credential',
	{
		id: uuid().primaryKey().defaultRandom(),
		userId: uuid()
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		email: varchar({ length: 320 }).notNull(),
		provider: OauthProviderEnum().notNull(),
		scope: OauthScopeEnum().notNull(),
		isGlobal: boolean().notNull().default(false),
		accessToken: varchar({ length: 4096 }).notNull(),
		accessTokenExpiresAt: timestamp().notNull(),
		refreshToken: varchar({ length: 4096 }).notNull(),
		refreshTokenExpiresAt: timestamp(),
		createdAt: timestamp().notNull().defaultNow(),
	},
	(t) => [
		index('credential_created_at_desc').on(desc(t.createdAt)),
		uniqueIndex('credential_unicity').on(t.email, t.provider, t.scope),
	],
);
