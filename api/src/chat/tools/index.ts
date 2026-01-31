import { Nexata } from '@api/chat/tools/nexata';
import { NexataFeedback } from '@api/feedback';
import { NexataFile } from '@api/file';
import { Dropbox } from '@api/integration/dropbox';
import { Calendar, Drive, Gmail } from '@api/integration/google';
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
	threadId: string | null = null,
	fileIds: string[] | null = null,
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
		NexataFileSearch: toolify(
			NexataFile.searchDescription,
			NexataFile.searchInput,
			activeUser,
			(au) => au,
			async (au, input) => NexataFile.search(au, input),
		),
		NexataFileRead: toolify(
			NexataFile.readDescription,
			NexataFile.readInput,
			activeUser,
			(au) => au,
			async (au, input) => NexataFile.read(au, input),
		),
		NexataFeedbackList: toolify(
			NexataFeedback.listDescription,
			NexataFeedback.listInput,
			activeUser,
			(au) => au,
			async (au, input) => NexataFeedback.list(au, input),
		),
		NexataFeedbackCreate: toolify(
			NexataFeedback.createDescription,
			NexataFeedback.createInput,
			activeUser,
			(au) => au,
			async (au, input) => NexataFeedback.create(au, input),
		),
	};

	if (threadId) {
		tools = {
			...tools,
			NexataListFilesOnThread: toolify(
				Nexata.listFilesOnThreadDescription,
				Nexata.listFilesOnThreadInput,
				{ activeUser, threadId },
				(ctx) => ctx,
				async (ctx, input) => Nexata.listFilesOnThread(ctx, input),
			),
		};
	}

	if (fileIds?.length) {
		tools = {
			...tools,
			NexataListFilesOnMessage: toolify(
				Nexata.listFilesOnMessageDescription,
				Nexata.listFilesOnMessageInput,
				{ activeUser, fileIds },
				(ctx) => ctx,
				async (ctx, input) => Nexata.listFilesOnMessage(ctx, input),
			),
		};
	}

	const dropboxCredentials = credentials.filter(
		(c) => c.scope === OauthScope.DROPBOX,
	);
	if (dropboxCredentials.length)
		tools = {
			...tools,
			dropboxSearch: toolify(
				Dropbox.searchDescription,
				Dropbox.searchInput,
				dropboxCredentials,
				(credentials) =>
					credentials.map((c) =>
						Dropbox.fromTokens(c.accessToken, c.refreshToken),
					),
				async (dpx, input) => Dropbox.search(dpx, input),
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
			dropboxListDir: toolify(
				Dropbox.listDirDescription,
				Dropbox.listDirInput,
				dropboxCredentials,
				(credentials) =>
					credentials.map((c) =>
						Dropbox.fromTokens(c.accessToken, c.refreshToken),
					),
				async (dpx, input) => Dropbox.listDir(dpx, input),
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
		};

	const driveCredentials = credentials.filter(
		(c) => c.scope === OauthScope.DRIVE,
	);
	if (driveCredentials.length)
		tools = {
			...tools,
			DriveSearch: toolify(
				Drive.searchDescription,
				Drive.searchInput,
				driveCredentials,
				(credentials) =>
					credentials.map((c) =>
						Drive.fromTokens(c.accessToken, c.refreshToken),
					),
				async (drv, input) => Drive.search(drv, input),
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
			DriveListDir: toolify(
				Drive.listDirDescription,
				Drive.listDirInput,
				driveCredentials,
				(credentials) =>
					credentials.map((c) =>
						Drive.fromTokens(c.accessToken, c.refreshToken),
					),
				async (drv, input) => Drive.listDir(drv, input),
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
		};

	const gmailCredentials = credentials.filter(
		(c) => c.scope === OauthScope.GMAIL,
	);
	if (gmailCredentials.length)
		tools = {
			...tools,
			GmailSearch: toolify(
				Gmail.searchDescription,
				Gmail.searchInput,
				gmailCredentials,
				(credentials) =>
					credentials.map((c) =>
						Gmail.fromTokens(c.accessToken, c.refreshToken),
					),
				async (client, input) => Gmail.search(client, input),
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
			GmailRead: toolify(
				Gmail.readDescription,
				Gmail.readInput,
				gmailCredentials,
				(credentials) =>
					credentials.map((c) =>
						Gmail.fromTokens(c.accessToken, c.refreshToken),
					),
				async (client, input) => Gmail.read(client, input),
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
		};

	const calendarCredentials = credentials.filter(
		(c) => c.scope === OauthScope.CALENDAR,
	);
	if (calendarCredentials.length)
		tools = {
			...tools,
			CalendarList: toolify(
				Calendar.listDescription,
				Calendar.listInput,
				calendarCredentials,
				(credentials) =>
					credentials.map((c) =>
						Calendar.fromTokens(c.accessToken, c.refreshToken),
					),
				async (client, input) => Calendar.list(client, input),
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
			CalendarEvents: toolify(
				Calendar.eventsDescription,
				Calendar.eventsInput,
				calendarCredentials,
				(credentials) =>
					credentials.map((c) =>
						Calendar.fromTokens(c.accessToken, c.refreshToken),
					),
				async (client, input) => Calendar.events(client, input),
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
			CalendarRead: toolify(
				Calendar.readDescription,
				Calendar.readInput,
				calendarCredentials,
				(credentials) =>
					credentials.map((c) =>
						Calendar.fromTokens(c.accessToken, c.refreshToken),
					),
				async (client, input) => Calendar.read(client, input),
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
		};

	return tools;
};
