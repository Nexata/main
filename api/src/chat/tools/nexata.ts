import { File } from '@api/file';
import { OauthProvider, OauthScope } from '@api/schema';
import type { JwtPayload } from '@api/utils/auth';
import { getCredentialsForUser } from '@api/utils/credential';
import { Nullish, tObject } from '@api/utils/type';
import type { Static } from '@sinclair/typebox';
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
		activeUser: JwtPayload,
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
				description: 'Page number (offset-based) for cursor-based pagination.',
			}),
		}),
	];

	export async function listFilesOnThread(
		ctx: { activeUser: JwtPayload; threadId: string },
		input: Static<typeof listFilesOnThreadInput>,
	) {
		return File.search(ctx.activeUser, { threadId: ctx.threadId, ...input });
	}

	export const [listFilesOnMessageDescription, listFilesOnMessageInput] = [
		'Current message has attachments. This tool lists the files from the database.',
		tObject({
			page: Nullish(t.Integer({ min: 1, default: 1 }), {
				description: 'Page number (offset-based) for cursor-based pagination.',
			}),
		}),
	];

	export async function listFilesOnMessage(
		ctx: { activeUser: JwtPayload; fileIds: string[] },
		input: Static<typeof listFilesOnMessageInput>,
	) {
		return File.search(ctx.activeUser, { fileIds: ctx.fileIds, ...input });
	}
}
