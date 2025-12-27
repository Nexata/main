import { OauthProvider, OauthScope } from '@api/schema';
import type { JwtPayload } from '@api/utils/auth';
import { getCredentialsForUser } from '@api/utils/credential';
import { Nullish, tObject } from '@api/utils/type';
import type { Static } from '@sinclair/typebox';
import { jsonSchema, tool } from 'ai';
import { t } from 'elysia';

const NexataListCredentialsInput = tObject({
	providers: Nullish(t.Array(t.Enum(OauthProvider)), {
		description: 'Limit the search to a set of providers.',
	}),
	scopes: Nullish(t.Array(t.Enum(OauthScope)), {
		description: 'Limit the search to specific scopes.',
	}),
	mails: Nullish(t.Array(t.String({ format: 'email' })), {
		description:
			'Limit the search to specific credential owners (based on their email).',
	}),
});

export const NexataListCredentialsTool = (activeUser: JwtPayload) =>
	tool({
		description:
			"Nexata tool to list and search user's available credentials. If user is admin, they can visualize credentials across all the tenant, else only their own or shared with them.",
		inputSchema: jsonSchema<Static<typeof NexataListCredentialsInput>>(
			NexataListCredentialsInput,
		),
		execute: async (input) => {
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
				credentials = credentials.filter((cred) =>
					input.mails?.includes(cred.ownedBy.email),
				);

			return credentials;
		},
	});
