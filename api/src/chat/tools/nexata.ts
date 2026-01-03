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
			scopes: Nullish(t.Array(t.Enum(OauthScope)), {
				description: 'Limit the search to specific scopes.',
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

		if (input.scopes?.length)
			credentials = credentials.filter((cred) =>
				input.scopes?.some((s) => cred.scopes.includes(s)),
			);

		if (input.mails?.length)
			credentials = credentials.filter(
				(cred) => !cred.email || input.mails?.includes(cred.email),
			);

		return credentials;
	}
}
