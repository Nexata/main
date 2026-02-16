import { db } from '@api/env';
import { NexataFile } from '@api/file';
import { OauthProvider, OauthScope, user } from '@api/schema';
import type { ActiveUser } from '@api/utils/auth';
import { getCredentialsForUser } from '@api/utils/credential';
import { Nullish, tObject } from '@api/utils/type';
import type { Static } from '@sinclair/typebox';
import { and, eq, ilike, isNotNull, or, type SQL } from 'drizzle-orm';
import { t } from 'elysia';

export namespace Nexata {
	export const [listCredentialsDescription, listCredentialsInput] = [
		"Nexata tool to list and search user's available credentials. If user is admin, they can visualize credentials across all the tenant, else only their own or shared with them.",
		tObject({
			providers: Nullish(t.Array(t.Enum(OauthProvider)), {
				description: 'Limit the search to a set of providers.',
			}),
			scope: Nullish(t.Enum(OauthScope), {
				description: 'Limit the search to a specific scope.',
			}),
			mails: Nullish(t.Array(t.String({ format: 'email' })), {
				description: 'Limit the search to specific credentials based on mails.',
			}),
		}),
	];

	export async function listCredentials(
		activeUser: ActiveUser,
		input: Static<typeof listCredentialsInput>,
	) {
		let credentials = await getCredentialsForUser(activeUser, 'display');

		if (input.providers?.length)
			credentials = credentials.filter((cred) =>
				input.providers?.includes(cred.provider),
			);

		if (input.scope)
			credentials = credentials.filter((cred) => cred.scope === input.scope);

		if (input.mails?.length)
			credentials = credentials.filter(
				(cred) => !cred.email || input.mails?.includes(cred.email),
			);

		return credentials;
	}

	export const [listFilesOnThreadDescription, listFilesOnThreadInput] = [
		'Nexata tool to list files attached to the current conversation thread.',
		tObject({
			page: Nullish(t.Integer({ min: 1, default: 1 }), {
				description: 'Page number for offset-based pagination.',
			}),
		}),
	];

	export async function listFilesOnThread(
		ctx: { activeUser: ActiveUser; threadId: string },
		input: Static<typeof listFilesOnThreadInput>,
	) {
		return NexataFile.search(ctx.activeUser, {
			threadId: ctx.threadId,
			...input,
		});
	}

	export const [listFilesOnMessageDescription, listFilesOnMessageInput] = [
		'Current message has attachments. This tool lists the files from the database.',
		tObject({
			page: Nullish(t.Integer({ min: 1, default: 1 }), {
				description: 'Page number for offset-based pagination.',
			}),
		}),
	];

	export async function listFilesOnMessage(
		ctx: { activeUser: ActiveUser; fileIds: string[] },
		input: Static<typeof listFilesOnMessageInput>,
	) {
		return NexataFile.search(ctx.activeUser, {
			fileIds: ctx.fileIds,
			...input,
		});
	}

	export const [listUsersDescription, listUsersInput] = [
		'Nexata tool to list users in the tenant. Supports filtering by name or email. Only returns users belonging to the same tenant as the requesting user.',
		tObject({
			search: Nullish(t.String(), {
				description: 'Search query to filter users by display name or email.',
			}),
		}),
	];

	export async function listUsers(
		activeUser: ActiveUser,
		input: Static<typeof listUsersInput>,
	) {
		return db
			.select({
				id: user.id,
				email: user.email,
				displayName: user.displayName,
				pfpUrl: user.pfpUrl,
				hasApiKey: isNotNull(user.apiKey) as SQL<boolean>,
				isAdmin: user.isAdmin,
			})
			.from(user)
			.where(
				and(
					eq(user.slug, activeUser.slug),
					input.search
						? or(
								ilike(user.displayName, `%${input.search}%`),
								ilike(user.email, `%${input.search}%`),
							)
						: undefined,
				),
			);
	}
}
