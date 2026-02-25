import { Nexata } from '@api/chat/tools/nexata';
import { NexataFeedback } from '@api/feedback';
import { NexataFile } from '@api/file';
import { Dropbox } from '@api/integration/dropbox';
import { Calendar, Drive, Gmail } from '@api/integration/google';
import {
	MicrosoftCalendar,
	OneDrive,
	Outlook,
} from '@api/integration/microsoft';
import { OauthScope } from '@api/schema';
import type { ActiveUser } from '@api/utils/auth';
import {
	type CachedCredential,
	ensureFreshTokens,
	getCredentialsForUser,
} from '@api/utils/credential';
import { captureException } from '@sentry/bun';
import { Value } from '@sinclair/typebox/value';
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
	execute:
		| ((ctx: TContext, input: Static<TInput>) => Promise<TOutput>)
		| undefined,
	mold?: (output: TOutput, ctx: TMultiContext, i: number) => TResult,
	options?: { needsApproval?: boolean },
) =>
	tool({
		needsApproval: options?.needsApproval,
		toModelOutput: (op) => ({ type: 'text', value: encode(op.output) }),
		description,
		// @ts-expect-error
		inputSchema: jsonSchema<Static<TInput>>(inputSchema),
		// @ts-expect-error
		execute: execute
			? async (input: Static<TInput>) => {
					const inputValidationErrors = [...Value.Errors(inputSchema, input)];
					if (inputValidationErrors.length) return { inputValidationErrors };

					try {
						const ctxs = wrapper(context);

						if (!Array.isArray(ctxs))
							return mold
								? mold(await execute(ctxs, input), context, 0)
								: await execute(ctxs, input);

						const res = await Promise.all(
							ctxs.map((ctx) => execute(ctx, input)),
						);
						return mold
							? res.length === 1
								? mold(res[0]!, context, 0)
								: res.map((output, i) => mold(output, context, i))
							: res;
					} catch (error) {
						captureException(error, {
							tags: { source: 'tool' },
							extra: { input },
						});

						throw error;
					}
				}
			: undefined,
	});

export const getTools = async (
	activeUser: ActiveUser,
	threadId: string | null = null,
	fileIds: string[] | null = null,
	interactive = true,
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
		NexataListUsers: toolify(
			Nexata.listUsersDescription,
			Nexata.listUsersInput,
			activeUser,
			(au) => au,
			async (au, input) => Nexata.listUsers(au, input),
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

	if (interactive) {
		tools = {
			...tools,
			NexataReingest: toolify(
				Nexata.reingestDescription,
				Nexata.reingestInput,
				activeUser,
				(au) => au,
				async (au, input) => Nexata.reingest(au, input),
				undefined,
				{ needsApproval: true },
			),
			NexataAskQuestions: toolify(
				Nexata.askQuestionsDescription,
				Nexata.askQuestionsInput,
				activeUser,
				(au) => au,
				undefined,
			),
		};
	}

	const freshClient = async <T>(
		c: CachedCredential,
		create: (at: string, rt: string) => T,
	) => {
		const { at, rt } = await ensureFreshTokens(
			c.id,
			c.provider,
			c.accessToken,
			c.refreshToken,
			c.accessTokenExpiresAt,
			activeUser.slug,
			activeUser.language,
		);

		return create(at, rt);
	};

	const dropboxCredentials = credentials.filter(
		(c) => c.scope === OauthScope.DROPBOX,
	);
	if (dropboxCredentials.length)
		tools = {
			...tools,
			DropboxSearch: toolify(
				Dropbox.searchDescription,
				Dropbox.searchInput,
				dropboxCredentials,
				(credentials) => credentials,
				async (c, input) =>
					Dropbox.search(await freshClient(c, Dropbox.fromTokens), input),
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
			DropboxListDir: toolify(
				Dropbox.listDirDescription,
				Dropbox.listDirInput,
				dropboxCredentials,
				(credentials) => credentials,
				async (c, input) =>
					Dropbox.listDir(await freshClient(c, Dropbox.fromTokens), input),
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
				(credentials) => credentials,
				async (c, input) =>
					Drive.search(await freshClient(c, Drive.fromTokens), input),
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
			DriveListDir: toolify(
				Drive.listDirDescription,
				Drive.listDirInput,
				driveCredentials,
				(credentials) => credentials,
				async (c, input) =>
					Drive.listDir(await freshClient(c, Drive.fromTokens), input),
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
				(credentials) => credentials,
				async (c, input) =>
					Gmail.search(await freshClient(c, Gmail.fromTokens), input),
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
			GmailRead: toolify(
				Gmail.readDescription,
				Gmail.readInput,
				gmailCredentials,
				(credentials) => credentials,
				async (c, input) =>
					Gmail.read(await freshClient(c, Gmail.fromTokens), input),
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
		};

	const outlookCredentials = credentials.filter(
		(c) => c.scope === OauthScope.OUTLOOK,
	);
	if (outlookCredentials.length)
		tools = {
			...tools,
			OutlookSearch: toolify(
				Outlook.searchDescription,
				Outlook.searchInput,
				outlookCredentials,
				(credentials) => credentials,
				async (c, input) =>
					Outlook.search(await freshClient(c, Outlook.fromTokens), input),
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
			OutlookRead: toolify(
				Outlook.readDescription,
				Outlook.readInput,
				outlookCredentials,
				(credentials) => credentials,
				async (c, input) =>
					Outlook.read(await freshClient(c, Outlook.fromTokens), input),
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
		};

	const microsoftCalendarCredentials = credentials.filter(
		(c) => c.scope === OauthScope.MICROSOFT_CALENDAR,
	);
	if (microsoftCalendarCredentials.length)
		tools = {
			...tools,
			MicrosoftCalendarList: toolify(
				MicrosoftCalendar.listDescription,
				MicrosoftCalendar.listInput,
				microsoftCalendarCredentials,
				(credentials) => credentials,
				async (c, input) =>
					MicrosoftCalendar.list(
						await freshClient(c, MicrosoftCalendar.fromTokens),
						input,
					),
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
			MicrosoftCalendarEvents: toolify(
				MicrosoftCalendar.eventsDescription,
				MicrosoftCalendar.eventsInput,
				microsoftCalendarCredentials,
				(credentials) => credentials,
				async (c, input) =>
					MicrosoftCalendar.events(
						await freshClient(c, MicrosoftCalendar.fromTokens),
						input,
					),
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
			MicrosoftCalendarRead: toolify(
				MicrosoftCalendar.readDescription,
				MicrosoftCalendar.readInput,
				microsoftCalendarCredentials,
				(credentials) => credentials,
				async (c, input) =>
					MicrosoftCalendar.read(
						await freshClient(c, MicrosoftCalendar.fromTokens),
						input,
					),
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
		};

	const oneDriveCredentials = credentials.filter(
		(c) => c.scope === OauthScope.ONE_DRIVE,
	);
	if (oneDriveCredentials.length)
		tools = {
			...tools,
			OneDriveSearch: toolify(
				OneDrive.searchDescription,
				OneDrive.searchInput,
				oneDriveCredentials,
				(credentials) => credentials,
				async (c, input) =>
					OneDrive.search(await freshClient(c, OneDrive.fromTokens), input),
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
			OneDriveListDir: toolify(
				OneDrive.listDirDescription,
				OneDrive.listDirInput,
				oneDriveCredentials,
				(credentials) => credentials,
				async (c, input) =>
					OneDrive.listDir(await freshClient(c, OneDrive.fromTokens), input),
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
				(credentials) => credentials,
				async (c, input) =>
					Calendar.list(await freshClient(c, Calendar.fromTokens), input),
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
			CalendarEvents: toolify(
				Calendar.eventsDescription,
				Calendar.eventsInput,
				calendarCredentials,
				(credentials) => credentials,
				async (c, input) =>
					Calendar.events(await freshClient(c, Calendar.fromTokens), input),
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
			CalendarRead: toolify(
				Calendar.readDescription,
				Calendar.readInput,
				calendarCredentials,
				(credentials) => credentials,
				async (c, input) =>
					Calendar.read(await freshClient(c, Calendar.fromTokens), input),
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
		};

	return tools;
};
