import { Nexata } from '@api/chat/tools/nexata';
import { Dropbox } from '@api/integration/dropbox';
import { OauthScope } from '@api/schema';
import type { JwtPayload } from '@api/utils/auth';
import { getCredentialsForUser } from '@api/utils/credential';
import { encode } from '@toon-format/toon';
import { jsonSchema, type ToolSet, tool } from 'ai';
import type { Static, TSchema } from 'elysia';

const toolify = <
	TInput extends TSchema,
	TMultiContext,
	TContext,
	TOutput,
	TResult,
>(
	description: string,
	inputSchema: TInput,
	context: TMultiContext,
	wrapper: (ctx: TMultiContext) => TContext[] | TContext,
	execute: (ctx: TContext, input: Static<TInput>) => Promise<TOutput>,
	mold?: (output: TOutput, ctx: TMultiContext, i: number) => TResult,
) =>
	tool({
		toModelOutput: (op) => ({ type: 'text', value: encode(op.output) }),
		description,
		// @ts-expect-error
		inputSchema: jsonSchema<Static<TInput>>(inputSchema),
		// @ts-expect-error
		execute: async (input) => {
			const ctxs = wrapper(context);

			if (!Array.isArray(ctxs))
				return mold
					? mold(await execute(ctxs, input), context, 0)
					: await execute(ctxs, input);

			const res = await Promise.all(ctxs.map((ctx) => execute(ctx, input)));
			return mold
				? res.length === 1
					? mold(res[0]!, context, 0)
					: res.map((output, i) => mold(output, context, i))
				: res;
		},
	});

export const getTools = async (
	activeUser: JwtPayload,
	_threadId: string | null = null,
) => {
	const credentials = await getCredentialsForUser(activeUser, 'usage');

	let tools: ToolSet = {
		NexataListCredentials: toolify(
			Nexata.listCredentialsDescription,
			Nexata.listCredentialsInput,
			activeUser,
			(au) => au,
			async (au, input) => Nexata.listCredentials(au, input),
		),
	};

	const dropboxCredentials = credentials.filter((c) =>
		c.scopes.includes(OauthScope.DROPBOX),
	);
	if (dropboxCredentials.length)
		tools = {
			...tools,
			dropboxSearch: toolify(
				Dropbox.searchDescription,
				Dropbox.searchInput,
				dropboxCredentials,
				(credentials) =>
					credentials.map((c) => Dropbox.fromToken(c.accessToken)),
				async (dpx, input) => Dropbox.search(dpx, input),
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
			dropboxListDir: toolify(
				Dropbox.listDirDescription,
				Dropbox.listDirInput,
				dropboxCredentials,
				(credentials) =>
					credentials.map((c) => Dropbox.fromToken(c.accessToken)),
				async (dpx, input) => Dropbox.listDir(dpx, input),
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
		};

	return tools;
};
