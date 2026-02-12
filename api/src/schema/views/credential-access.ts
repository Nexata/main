import { credential } from '@api/schema/credential';
import { credentialPermission } from '@api/schema/credential-permission';
import { user } from '@api/schema/user';
import { aliasedColumn, sqlCase, whenThen } from '@api/utils/sql';
import { and, eq, isNotNull, or, sql } from 'drizzle-orm';
import { alias, pgView } from 'drizzle-orm/pg-core';

export enum AccessLevel {
	TENANT_ADMIN = 'tenant-admin',
	ADMIN = 'admin',
	READ = 'read',
	GLOBAL = 'global',
}

export const allAccessLevelEntries = (
	credentialId: string,
	adminOnly: boolean = false,
) =>
	Object.values(AccessLevel)
		.filter(
			(level) =>
				!adminOnly ||
				[AccessLevel.ADMIN, AccessLevel.TENANT_ADMIN].includes(level),
		)
		.map((level) => `${credentialId}:${level}`);

export const encodeCredentialAccess = (id: string, level: AccessLevel) =>
	`${id}:${level}`;

export const decodeCredentialAccess = (entry: string) => {
	const [id, level] = entry.split(':');
	return { id: id!, level: level as AccessLevel };
};

export const isAdminAccessLevel = (level: AccessLevel) =>
	level === AccessLevel.TENANT_ADMIN || level === AccessLevel.ADMIN;

const owner = alias(user, 'owner');

export const credentialAccess = pgView('credential_access').as((qb) =>
	qb
		.select({
			id: credential.id,
			userId: aliasedColumn(user.id, 'user_id'),
			accessLevel: sqlCase<AccessLevel>(
				sql`'global'`,
				whenThen(eq(user.isAdmin, true), sql`'tenant-admin'`),
				whenThen(
					or(
						eq(credential.userId, user.id),
						eq(credentialPermission.isAdmin, true),
					)!,
					sql`'admin'`,
				),
				whenThen(eq(credentialPermission.isAdmin, false), sql`'read'`),
			).as('access_level'),
			ownerId: aliasedColumn(owner.id, 'owner_id'),
			ownerEmail: aliasedColumn(owner.email, 'owner_email'),
			provider: credential.provider,
			scope: credential.scope,
			email: credential.email,
			isGlobal: credential.isGlobal,
			accessToken: credential.accessToken,
			refreshToken: credential.refreshToken,
			accessTokenExpiresAt: credential.accessTokenExpiresAt,
			createdAt: credential.createdAt,
		})
		.from(credential)
		.innerJoin(owner, eq(owner.id, credential.userId))
		.innerJoin(user, eq(user.slug, owner.slug))
		.leftJoin(
			credentialPermission,
			and(
				eq(credentialPermission.credentialId, credential.id),
				eq(credentialPermission.userId, user.id),
			),
		)
		.where(
			or(
				eq(user.isAdmin, true),
				eq(credential.userId, user.id),
				isNotNull(credentialPermission.userId),
				eq(credential.isGlobal, true),
			),
		),
);
