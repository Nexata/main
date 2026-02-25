import { db } from '@api/env';
import { NexataFile } from '@api/file';
import { providerIngestors } from '@api/integration/lib';
import {
	credential,
	credentialPermission,
	FileHost,
	file,
	filePermission,
	OauthProvider,
	OauthScope,
	user,
} from '@api/schema';
import type { ActiveUser } from '@api/utils/auth';
import { checkTenantCanIngest } from '@api/utils/billing';
import { getCredentialsForUser } from '@api/utils/credential';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { Nullish, tObject } from '@api/utils/type';
import type { Static } from '@sinclair/typebox';
import {
	and,
	eq,
	exists,
	ilike,
	isNotNull,
	not,
	or,
	type SQL,
} from 'drizzle-orm';
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

	export const [reingestDescription, reingestInput] = [
		'Nexata tool to re-ingest (refresh / update) an already ingested file by its Nexata file ID. This re-fetches the file content from its source and re-processes it. Only use this tool when the user explicitly requests a file re-ingestion or when the latest up-to-date data is explicitly required. Do not use this tool proactively.',
		tObject({
			fileId: t.String({
				format: 'uuid',
				description: 'The Nexata file UUID to re-ingest.',
			}),
		}),
	];

	export async function reingest(
		activeUser: ActiveUser,
		input: Static<typeof reingestInput>,
	) {
		const existing = (
			await db
				.select({
					id: file.id,
					provider: file.provider,
					externalId: file.externalId,
					credentialId: file.credentialId,
					userId: file.userId,
					name: file.name,
					slug: user.slug,
				})
				.from(file)
				.innerJoin(user, eq(user.id, file.userId))
				.where(
					and(
						eq(file.id, input.fileId),
						not(eq(file.provider, FileHost.NEXATA)),
						activeUser.isAdmin
							? eq(user.slug, activeUser.slug)
							: or(
									exists(
										db
											.select({ credentialId: credential.id })
											.from(credential)
											.where(
												and(
													eq(credential.id, file.credentialId),
													or(
														eq(credential.userId, activeUser.id),
														exists(
															db
																.select({
																	userId: credentialPermission.userId,
																})
																.from(credentialPermission)
																.where(
																	and(
																		eq(
																			credentialPermission.credentialId,
																			credential.id,
																		),
																		eq(
																			credentialPermission.userId,
																			activeUser.id,
																		),
																	),
																),
														),
													),
												),
											),
									),
									eq(file.userId, activeUser.id),
									exists(
										db
											.select({ id: filePermission.id })
											.from(filePermission)
											.where(
												and(
													eq(filePermission.fileId, file.id),
													or(
														eq(filePermission.userId, activeUser.id),
														eq(filePermission.email, activeUser.email),
													),
												),
											),
									),
								),
					),
				)
		).at(0);

		if (!existing)
			throw httpError(
				HttpCode.NOT_FOUND,
				ErrorCode.FILE_NOT_FOUND,
				activeUser.language,
			);

		if (!existing.externalId || !existing.credentialId)
			throw httpError(
				HttpCode.UNPROCESSABLE_ENTITY,
				ErrorCode.FILE_NOT_FOUND,
				activeUser.language,
			);

		const blockReason = await checkTenantCanIngest(activeUser.slug);
		if (blockReason)
			throw httpError(
				blockReason === ErrorCode.PAYMENT_REQUIRED
					? HttpCode.PAYMENT_REQUIRED
					: HttpCode.PRECONDITION_FAILED,
				ErrorCode[blockReason as keyof typeof ErrorCode],
				activeUser.language,
			);

		const ingestor = providerIngestors[existing.provider];
		if (!ingestor)
			throw httpError(
				HttpCode.UNPROCESSABLE_ENTITY,
				ErrorCode.EXTERNAL_ERROR,
				activeUser.language,
			);

		const result = await ingestor(
			existing.userId,
			existing.slug,
			existing.credentialId,
			[{ isDir: false, id: existing.externalId }],
		);

		return { fileId: existing.id, name: existing.name, result };
	}

	const choiceOption = t.Object({
		value: t.String(),
		recommended: t.Boolean({ default: false }),
	});

	export const [askQuestionsDescription, askQuestionsInput] = [
		'Nexata tool to ask the user one or more structured questions when clarification or input is needed before proceeding. Only use when user input is genuinely required to continue — do not ask unnecessary questions.',
		tObject({
			questions: t.Array(
				t.Union([
					t.Object({
						question: t.String({ description: 'The question to ask.' }),
						recommendation: Nullish(t.String(), {
							description:
								'A suggestion or note from the agent for this question.',
						}),
						type: t.Literal('multiple_choice'),
						data: t.Array(choiceOption, { minItems: 2 }),
					}),
					t.Object({
						question: t.String({ description: 'The question to ask.' }),
						recommendation: Nullish(t.String(), {
							description:
								'A suggestion or note from the agent for this question.',
						}),
						type: t.Literal('multi_select'),
						data: t.Array(choiceOption, { minItems: 2 }),
					}),
					t.Object({
						question: t.String({ description: 'The question to ask.' }),
						recommendation: Nullish(t.String(), {
							description:
								'A suggestion or note from the agent for this question.',
						}),
						type: t.Literal('boolean'),
					}),
					t.Object({
						question: t.String({ description: 'The question to ask.' }),
						recommendation: Nullish(t.String(), {
							description:
								'A suggestion or note from the agent for this question.',
						}),
						type: t.Literal('text'),
						data: Nullish(
							t.Object({
								placeholder: Nullish(t.String()),
							}),
						),
					}),
					t.Object({
						question: t.String({ description: 'The question to ask.' }),
						recommendation: Nullish(t.String(), {
							description:
								'A suggestion or note from the agent for this question.',
						}),
						type: t.Literal('number'),
						data: Nullish(
							t.Object({
								min: Nullish(t.Number()),
								max: Nullish(t.Number()),
							}),
						),
					}),
					t.Object({
						question: t.String({ description: 'The question to ask.' }),
						recommendation: Nullish(t.String(), {
							description:
								'A suggestion or note from the agent for this question.',
						}),
						type: t.Literal('date'),
					}),
				]),
				{
					minItems: 1,
					description: 'Array of questions to present to the user.',
				},
			),
		}),
	];
}
