import { user } from '@api/schema';
import { sqlArray } from '@api/utils/sql';
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
	OUTLOOK_CALENDAR = 'outlook_calendar',
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
		OauthScope.OUTLOOK_CALENDAR,
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
	[OauthScope.ONE_DRIVE]: ['https://graph.microsoft.com/Files.Read'],
	[OauthScope.OUTLOOK_CALENDAR]: ['https://graph.microsoft.com/Calendars.Read'],
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
		isGlobal: boolean().notNull().default(false),
		provider: OauthProviderEnum().notNull(),
		scope: OauthScopeEnum()
			.array()
			.notNull()
			.default(sqlArray([], OauthScopeEnum.enumName)),
		accessToken: varchar({ length: 4096 }).notNull(),
		accessTokenExpiresAt: timestamp().notNull(),
		refreshToken: varchar({ length: 4096 }).notNull(),
		refreshTokenExpiresAt: timestamp().notNull(),
		createdAt: timestamp().notNull().defaultNow(),
	},
	(table) => [
		index('credential_created_at_desc').on(desc(table.createdAt)),
		uniqueIndex('credential_unicity').on(
			table.userId,
			table.provider,
			table.scope,
		),
	],
);
