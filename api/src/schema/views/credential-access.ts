import { credential } from '@api/schema/credential';
import { credentialPermission } from '@api/schema/credential-permission';
import { user } from '@api/schema/user';
import {
	aliasedColumn,
	coalesce,
	jsonAgg,
	jsonBuildObject,
	sqlCase,
	whenThen,
} from '@api/utils/sql';
import { and, eq, isNotNull, not, or, sql } from 'drizzle-orm';
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

const [owner, permUser] = [alias(user, 'owner'), alias(user, 'perm_user')];
export const credentialAccess = pgView('credential_access').as((qb) =>
	qb
		.select({
			id: credential.id,
			userId: aliasedColumn(user.id, 'user_id'),
			accessLevel: sqlCase<AccessLevel>(
				sql`'global'`,
				whenThen(eq(user.isAdmin, true), sql`'tenant-admin'`),
				whenThen(
					or(eq(owner.id, user.id), eq(credentialPermission.isAdmin, true))!,
					sql`'admin'`,
				),
				whenThen(eq(credentialPermission.isAdmin, false), sql`'read'`),
			).as('access_level'),
			provider: credential.provider,
			scope: credential.scope,
			email: credential.email,
			isGlobal: credential.isGlobal,
			ownedBy: jsonBuildObject({
				id: owner.id,
				email: owner.email,
				pfpUrl: owner.pfpUrl,
				displayName: owner.displayName,
				isTenantAdmin: owner.isAdmin,
			}).as('owned_by'),
			permissions: coalesce(
				jsonAgg(
					jsonBuildObject({
						id: permUser.id,
						displayName: permUser.displayName,
						email: permUser.email,
						pfpUrl: permUser.pfpUrl,
						accessLevel: sqlCase<AccessLevel>(
							sql`'global'`,
							whenThen(eq(permUser.isAdmin, true), sql`'tenant-admin'`),
							whenThen(
								or(
									eq(owner.id, permUser.id),
									eq(credentialPermission.isAdmin, true),
								)!,
								sql`'admin'`,
							),
							whenThen(eq(credentialPermission.isAdmin, false), sql`'read'`),
						),
					}),
					and(isNotNull(permUser.id), not(eq(permUser.id, owner.id))),
				),
				sql`'[]'::json`,
			).as('permissions'),
			accessToken: credential.accessToken,
			refreshToken: credential.refreshToken,
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
		.leftJoin(
			permUser,
			and(
				eq(permUser.slug, user.slug),
				or(
					eq(permUser.id, credentialPermission.userId),
					eq(permUser.isAdmin, true),
				),
			),
		)
		.where(
			or(
				eq(user.isAdmin, true),
				eq(owner.id, user.id),
				isNotNull(permUser.id),
				eq(credential.isGlobal, true),
			),
		)
		.groupBy(credential.id, user.id, owner.id, credentialPermission.isAdmin),
);
