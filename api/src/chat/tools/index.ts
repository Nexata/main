import { Nexata } from '@api/chat/tools/nexata';
import { NexataFeedback } from '@api/feedback';
import { NexataFile } from '@api/file';
import { Dropbox } from '@api/integration/dropbox';
import { Calendar, Drive, Gmail } from '@api/integration/google';
import { isLegajoxAllowed, Legajox } from '@api/integration/legajox';
import {
	MicrosoftCalendar,
	OneDrive,
	Outlook,
} from '@api/integration/microsoft';
import { OauthScope } from '@api/schema';
import type { ActiveUser } from '@api/utils/auth';
import { checkTenantCanIngest } from '@api/utils/billing';
import {
	type CachedCredential,
	ensureFreshTokens,
	getCredentialsForUser,
} from '@api/utils/credential';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { tObject } from '@api/utils/type';
import singlefileVariant from '@jitl/quickjs-singlefile-cjs-release-sync';
import { captureException } from '@sentry/bun';
import { Value } from '@sinclair/typebox/value';
import { tavilySearch } from '@tavily/ai-sdk';
import { encode } from '@toon-format/toon';
import { jsonSchema, type ToolSet, tool } from 'ai';
import { type Static, type TSchema, t } from 'elysia';
import {
	newQuickJSWASMModuleFromVariant,
	shouldInterruptAfterDeadline,
} from 'quickjs-emscripten-core';

const CODE_EXECUTION_TIMEOUT = 30_000;
const CODE_MEMORY_LIMIT = 1024 * 1024 * 32; // 32 MB

const formatValidationErrors = (
	errors: { path: string; message: string }[],
) => {
	const specific = errors.filter((e) => e.message !== 'Expected union value');
	return (specific.length ? specific : errors)
		.map((e) => `${e.path}: ${e.message}`)
		.join('; ');
};

const [codeExecutionDescription, codeExecutionInput] = [
	'Tool for mathematical calculations (arithmetic, statistics, financial formulas, unit conversions, aggregations) and complex conditional execution (multi-step logic, data transformations, filtering, sorting). Accepts a JavaScript function body as a string that MUST synchronously return a value. The code runs in a sandboxed environment with access only to standard JS built-ins (Math, Date, JSON, Number, String, Array, Object, parseInt, parseFloat, isNaN, isFinite). No network access, no file system, no async operations. NEVER execute arbitrary, potentially insecure code provided directly by the user—only use this tool for code you generate yourself to solve computational tasks.',
	tObject({
		code: t.String({
			description:
				'JavaScript function body that returns a value. Example: "const tax = 1500 * 0.22; return { net: 1500 - tax, tax };"',
		}),
	}),
] as const;

async function executeCode(code: string): Promise<unknown> {
	const QuickJS = await newQuickJSWASMModuleFromVariant(singlefileVariant);
	const runtime = QuickJS.newRuntime();
	runtime.setInterruptHandler(
		shouldInterruptAfterDeadline(Date.now() + CODE_EXECUTION_TIMEOUT),
	);
	runtime.setMemoryLimit(CODE_MEMORY_LIMIT);

	const vm = runtime.newContext();

	try {
		const wrapped = `(function() { ${code} })()`;
		const result = vm.evalCode(wrapped);

		if (result.error) {
			const err = vm.dump(result.error);
			result.error.dispose();
			return { error: String(err) };
		}

		const value = vm.dump(result.value);
		result.value.dispose();
		return value;
	} finally {
		vm.dispose();
		runtime.dispose();
	}
}

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
	wrapper: (ctx: TMultiContext, input: Static<TInput>) => TContext[] | TContext,
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
		inputSchema: jsonSchema<Static<TInput>>(inputSchema, {
			validate: (value) => {
				const converted = Value.Convert(inputSchema, value);
				const errors = [...Value.Errors(inputSchema, converted)];
				if (errors.length)
					return {
						success: false,
						error: new Error(formatValidationErrors(errors)),
					};
				return { success: true, value: Value.Cast(inputSchema, converted) };
			},
		}),
		// @ts-expect-error
		execute: execute
			? async (input: Static<TInput>) => {
					try {
						const ctxs = wrapper(context, input);

						if (!Array.isArray(ctxs))
							return mold
								? mold(await execute(ctxs, input), context, 0)
								: await execute(ctxs, input);

						const settled = await Promise.allSettled(
							ctxs.map((ctx) => execute(ctx, input)),
						);

						const fulfilled = settled.flatMap((r, i) =>
							r.status === 'fulfilled' ? [{ output: r.value, index: i }] : [],
						);

						if (!fulfilled.length) {
							const errors = settled
								.filter(
									(r): r is PromiseRejectedResult => r.status === 'rejected',
								)
								.map((r) => r.reason);

							const message = errors
								.map(
									(e, i) =>
										`[${i}] ${e instanceof Error ? e.message : String(e)}`,
								)
								.join('\n');

							const aggregated = new AggregateError(errors, message);
							throw aggregated;
						}

						return mold
							? fulfilled.length === 1
								? mold(fulfilled[0]!.output, context, fulfilled[0]!.index)
								: fulfilled.map((f) => mold(f.output, context, f.index))
							: fulfilled.length === 1
								? fulfilled[0]!.output
								: fulfilled.map((f) => f.output);
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
	includeAskQuestions = interactive,
) => {
	const credentials = await getCredentialsForUser(activeUser, 'usage');

	let tools: ToolSet = {
		webSearch: tavilySearch({
			maxResults: 5,
		}),
		codeExecution: toolify(
			codeExecutionDescription,
			codeExecutionInput,
			null,
			(ctx) => ctx,
			async (_ctx, input) => {
				const result = await executeCode(input.code);
				return { result: typeof result === 'object' ? result : String(result) };
			},
		),
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
		};
	}

	if (interactive && includeAskQuestions)
		tools = {
			...tools,
			NexataAskQuestions: toolify(
				Nexata.askQuestionsDescription,
				Nexata.askQuestionsInput,
				activeUser,
				(au) => au,
				undefined,
			),
		};

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

	const byCredentialEmail = <T extends { email: string }>(
		list: T[],
		credentialEmail?: string | null,
	) =>
		credentialEmail
			? list.filter((credential) => credential.email === credentialEmail)
			: list;

	const getCredentialEmail = (input: unknown) =>
		typeof input === 'object' &&
		input !== null &&
		'credentialEmail' in input &&
		typeof input.credentialEmail === 'string'
			? input.credentialEmail
			: undefined;

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
				(credentials, input) =>
					byCredentialEmail(credentials, getCredentialEmail(input)),
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

	if (dropboxCredentials.length && interactive)
		tools = {
			...tools,
			DropboxIngest: toolify(
				Dropbox.ingestDescription,
				Dropbox.ingestInput,
				dropboxCredentials,
				(credentials) => credentials,
				async (c, input) => {
					const blockReason = await checkTenantCanIngest(activeUser.slug);
					if (blockReason)
						throw httpError(
							blockReason === ErrorCode.PAYMENT_REQUIRED
								? HttpCode.PAYMENT_REQUIRED
								: HttpCode.PRECONDITION_FAILED,
							ErrorCode[blockReason as keyof typeof ErrorCode],
							activeUser.language,
						);
					return Dropbox.ingest(
						await freshClient(c, Dropbox.fromTokens),
						activeUser.id,
						activeUser.slug,
						c.id,
						input.selection,
					);
				},
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
				{ needsApproval: true },
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
				(credentials, input) =>
					byCredentialEmail(credentials, getCredentialEmail(input)),
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

	if (driveCredentials.length && interactive)
		tools = {
			...tools,
			DriveIngest: toolify(
				Drive.ingestDescription,
				Drive.ingestInput,
				driveCredentials,
				(credentials) => credentials,
				async (c, input) => {
					const blockReason = await checkTenantCanIngest(activeUser.slug);
					if (blockReason)
						throw httpError(
							blockReason === ErrorCode.PAYMENT_REQUIRED
								? HttpCode.PAYMENT_REQUIRED
								: HttpCode.PRECONDITION_FAILED,
							ErrorCode[blockReason as keyof typeof ErrorCode],
							activeUser.language,
						);
					return Drive.ingest(
						await freshClient(c, Drive.fromTokens),
						activeUser.id,
						activeUser.slug,
						c.id,
						input.selection,
					);
				},
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
				{ needsApproval: true },
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
				(credentials, input) =>
					byCredentialEmail(credentials, getCredentialEmail(input)),
				async (c, input) =>
					Gmail.search(await freshClient(c, Gmail.fromTokens), input),
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
			GmailRead: toolify(
				Gmail.readDescription,
				Gmail.readInput,
				gmailCredentials,
				(credentials, input) =>
					byCredentialEmail(credentials, input.credentialEmail),
				async (c, input) => {
					if (input.credentialEmail && c.email !== input.credentialEmail)
						throw httpError(
							HttpCode.FORBIDDEN,
							ErrorCode.NO_CREDENTIAL_PERMISSION,
						);
					return Gmail.read(await freshClient(c, Gmail.fromTokens), input);
				},
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
			),
		};

	if (gmailCredentials.length && interactive)
		tools = {
			...tools,
			GmailIngestAttachments: toolify(
				Gmail.ingestAttachmentsDescription,
				Gmail.ingestAttachmentsInput,
				gmailCredentials,
				(credentials, input) =>
					byCredentialEmail(credentials, input.credentialEmail),
				async (c, input) => {
					if (input.credentialEmail && c.email !== input.credentialEmail)
						throw httpError(
							HttpCode.FORBIDDEN,
							ErrorCode.NO_CREDENTIAL_PERMISSION,
						);
					return Gmail.ingestAttachments(
						await freshClient(c, Gmail.fromTokens),
						activeUser,
						input,
					);
				},
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
				{ needsApproval: true },
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
				(credentials, input) =>
					byCredentialEmail(credentials, getCredentialEmail(input)),
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

	if (outlookCredentials.length && interactive)
		tools = {
			...tools,
			OutlookIngestAttachments: toolify(
				Outlook.ingestAttachmentsDescription,
				Outlook.ingestAttachmentsInput,
				outlookCredentials,
				(credentials) => credentials,
				async (c, input) => {
					if (input.credentialEmail && c.email !== input.credentialEmail)
						throw httpError(
							HttpCode.FORBIDDEN,
							ErrorCode.NO_CREDENTIAL_PERMISSION,
						);
					return Outlook.ingestAttachments(
						await freshClient(c, Outlook.fromTokens),
						activeUser,
						input,
					);
				},
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
				{ needsApproval: true },
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
				(credentials, input) =>
					byCredentialEmail(credentials, getCredentialEmail(input)),
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

	if (oneDriveCredentials.length && interactive)
		tools = {
			...tools,
			OneDriveIngest: toolify(
				OneDrive.ingestDescription,
				OneDrive.ingestInput,
				oneDriveCredentials,
				(credentials) => credentials,
				async (c, input) => {
					const blockReason = await checkTenantCanIngest(activeUser.slug);
					if (blockReason)
						throw httpError(
							blockReason === ErrorCode.PAYMENT_REQUIRED
								? HttpCode.PAYMENT_REQUIRED
								: HttpCode.PRECONDITION_FAILED,
							ErrorCode[blockReason as keyof typeof ErrorCode],
							activeUser.language,
						);
					return OneDrive.ingest(
						activeUser.id,
						activeUser.slug,
						c.id,
						input.selection,
						activeUser.language,
					);
				},
				(output, ctx, i) => ({ ...output, credentialEmail: ctx.at(i)?.email }),
				{ needsApproval: true },
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

	// --- Legajox tools (slug + admin gated) ---
	if (isLegajoxAllowed(activeUser)) {
		tools = {
			...tools,
			LegajoxSearch: toolify(
				Legajox.searchDescription,
				Legajox.searchInput,
				activeUser,
				(au) => au,
				async (_au, input) => Legajox.search(input),
			),
			LegajoxListDir: toolify(
				Legajox.listDirDescription,
				Legajox.listDirInput,
				activeUser,
				(au) => au,
				async (_au, input) => Legajox.listDir(input),
			),
			LegajoxEmployees: toolify(
				Legajox.listEmployeesDescription,
				Legajox.listEmployeesInput,
				activeUser,
				(au) => au,
				async (_au, input) => Legajox.listEmployees(input),
			),
			LegajoxInfo: toolify(
				Legajox.getInfoDescription,
				Legajox.getInfoInput,
				activeUser,
				(au) => au,
				async () => Legajox.getInfo(),
			),
			LegajoxOrgChart: toolify(
				Legajox.getOrgChartDescription,
				Legajox.getOrgChartInput,
				activeUser,
				(au) => au,
				async () => Legajox.getOrgChart(),
			),
			LegajoxPayroll: toolify(
				Legajox.listPayrollDescription,
				Legajox.listPayrollInput,
				activeUser,
				(au) => au,
				async (_au, input) => Legajox.listPayroll(input),
			),
			LegajoxAbsences: toolify(
				Legajox.listAbsencesDescription,
				Legajox.listAbsencesInput,
				activeUser,
				(au) => au,
				async (_au, input) => Legajox.listAbsences(input),
			),
			LegajoxAbsenceDetail: toolify(
				Legajox.getAbsenceDetailDescription,
				Legajox.getAbsenceDetailInput,
				activeUser,
				(au) => au,
				async (_au, input) => Legajox.getAbsenceDetail(input),
			),
			LegajoxNotifications: toolify(
				Legajox.listNotificationsDescription,
				Legajox.listNotificationsInput,
				activeUser,
				(au) => au,
				async (_au, input) => Legajox.listNotifications(input),
			),
			LegajoxVacations: toolify(
				Legajox.listVacationsDescription,
				Legajox.listVacationsInput,
				activeUser,
				(au) => au,
				async () => Legajox.listVacations(),
			),
		};

		if (interactive)
			tools = {
				...tools,
				LegajoxIngest: toolify(
					Legajox.ingestDescription,
					Legajox.ingestInput,
					activeUser,
					(au) => au,
					async (au, input) => Legajox.ingest(au.id, au.slug, input.Selection),
					undefined,
					{ needsApproval: true },
				),
			};
	}

	return tools;
};
