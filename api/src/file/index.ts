import { authPlugin } from '@api/auth';
import { db, EMBEDDING_MODEL } from '@api/env';
import { stringToChunks, toStringChunks } from '@api/file/lib';
import {
	BillableEventType,
	billableEvent,
	chunk,
	credential,
	credentialPermission,
	FileHost,
	file,
	filePermission,
	message,
	TraceType,
	thread,
	trace,
	user,
} from '@api/schema';
import type { JwtPayload } from '@api/utils/auth';
import { uploadFile } from '@api/utils/s3';
import { caseWhenNull, jsonAgg, jsonBuildObject } from '@api/utils/sql';
import { Nullish, tObject } from '@api/utils/type';
import { embed } from 'ai';
import {
	and,
	asc,
	cosineDistance,
	desc,
	eq,
	exists,
	gt,
	gte,
	ilike,
	inArray,
	isNotNull,
	or,
	sql,
} from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-typebox';
import { Elysia, type Static, t } from 'elysia';

const _insertFile = createInsertSchema(file);
const insertFile = t.Omit(_insertFile, ['createdAt', 'modifiedAt']);

export namespace File {
	export const [searchDescription, searchInput] = [
		"Nexata tool to search for users's ingested files. This includes directly uploaded files and files vectorized from other sources (and ingested to the platform by the user).",
		t.Object({
			query: Nullish(t.String({ minLength: 1 }), {
				description:
					"An optional string to apply semantic search over the file's content.",
			}),
			provider: Nullish(t.Enum(FileHost), {
				description:
					"Filter by file's host / provider. 'nexata' value implies a file uploaded and hosted directly in the platform.",
			}),
			name: Nullish(t.String({ minLength: 1, maxLength: 96 }), {
				description:
					"Filter by file's name. Uses case-insensitive 'in' operator matching.",
			}),
			type: Nullish(t.String({ minLength: 1, maxLength: 256 }), {
				description:
					"Filter by file's MIME type. Uses case-insensitive 'in' operator matching.",
			}),
			createdAt: Nullish(t.Date(), {
				description: 'Filter by greater-than-or-equal-to ingestion date.',
			}),
			threadId: Nullish(t.String({ format: 'uuid' }), {
				description:
					'Filter by thread ID. Only files associated with the specified thread will be returned.',
			}),
			messageId: Nullish(t.String({ format: 'uuid' }), {
				description:
					'Filter by message ID. Only files associated with the specified message will be returned.',
			}),
			fileIds: Nullish(t.Array(t.String({ format: 'uuid' })), {
				description: 'Limit results to a set of specified file IDs.',
			}),
			page: Nullish(t.Integer({ min: 1, default: 1 }), {
				description:
					'Page number. Results are paginated to avoid overloading the system.',
			}),
		}),
	];

	export async function search(
		activeUser: JwtPayload,
		input: Static<typeof searchInput>,
	) {
		const { embedding } = input.query
			? await embed({
					model: EMBEDDING_MODEL,
					value: input.query,
				})
			: { embedding: undefined };

		const similarity =
			embedding &&
			sql<number>`1 - (${cosineDistance(chunk.embedding, embedding)})`;

		return db
			.select({
				id: file.id,
				ownedBy: jsonBuildObject({
					id: user.id,
					email: user.email,
					pfpUrl: user.pfpUrl,
					displayName: user.displayName,
					isAdmin: user.isAdmin,
				}).as('owned_by'),
				provider: file.provider,
				thread: caseWhenNull(
					thread.id,
					jsonBuildObject({
						id: thread.id,
						title: thread.title,
						createdAt: thread.createdAt,
					}),
				).as('thread'),
				credential: caseWhenNull(
					credential.id,
					jsonBuildObject({
						id: credential.id,
						email: credential.email,
						provider: credential.provider,
					}),
				).as('credential'),
				autoSync: file.autoSync,
				url: file.url,
				name: file.name,
				type: file.type,
				metadata: file.metadata,
				modifiedAt: file.modifiedAt,
				ingestedAt: file.createdAt,
				chunks: input.query
					? jsonAgg(
							jsonBuildObject({
								id: chunk.id,
								order: chunk.order,
								text: chunk.text,
								metadata: chunk.metadata,
								...(similarity ? { similarity } : {}),
							}),
							isNotNull(chunk.id),
						).as('chunks')
					: sql<[]>`'[]'::json`,
			})
			.from(file)
			.innerJoin(user, eq(user.id, file.userId))
			.leftJoin(message, eq(message.id, file.messageId))
			.leftJoin(thread, eq(thread.id, message.threadId))
			.leftJoin(credential, eq(credential.id, file.credentialId))
			.leftJoin(
				chunk,
				similarity ? eq(file.id, chunk.fileId) : sql<boolean>`false`,
			)
			.where(
				and(
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
															.select({ userId: credentialPermission.userId })
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
					similarity && or(gt(similarity, 0.3)),
					input.fileIds ? inArray(file.id, input.fileIds) : undefined,
					input.provider ? eq(file.provider, input.provider) : undefined,
					input.name ? ilike(file.name, `%${input.name}%`) : undefined,
					input.type ? ilike(file.type, `%${input.type}%`) : undefined,
					input.createdAt ? gte(file.createdAt, input.createdAt) : undefined,
					input.threadId ? eq(message.threadId, input.threadId) : undefined,
					input.messageId ? eq(file.messageId, input.messageId) : undefined,
				),
			)
			.groupBy(file.id, user.id, thread.id, credential.id, chunk.id)
			.orderBy(similarity ? desc(similarity) : desc(file.createdAt))
			.limit(similarity ? 10 : 25)
			.offset(((input.page ?? 1) - 1) * 10)
			.catch(console.error);
	}

	export async function ingest(
		data: Partial<Static<typeof insertFile>> & { userId: string },
		f: File,
	) {
		data.id = crypto.randomUUID();

		try {
			const result = await toStringChunks(
				await f.arrayBuffer(),
				data.type ?? f.type,
			);

			const [chunks, embeddingUsage] = await stringToChunks(
				data.id,
				result.chunks,
			);

			if (!data.provider || data.provider === FileHost.NEXATA)
				data.url = await uploadFile(data.id, f);

			await db.batch([
				db.insert(file).values({
					...data,
					name: data.name ?? f.name,
					type: data.type ?? f.type,
				}),
				db.insert(billableEvent).values({
					type: BillableEventType.EMBED,
					consumption: ((result.tokenUsage ?? 0) + embeddingUsage).toString(),
					userId: data.userId,
				}),
				db.insert(chunk).values(chunks),
			]);

			return data.id;
		} catch (error) {
			await db.insert(trace).values({
				userId: data.userId,
				type: TraceType.INGEST_FAILED,
				metadata: {
					...data,
					error: error instanceof Error ? error.message : 'UNKNOWN',
				},
			});

			throw error;
		}
	}

	export const [readDescription, readInput] = [
		[
			'Read file content chunks with optional semantic search. Returns chunks paginated by order (20 per page). Use cursor for pagination.',
			'This tool serves to read a file, but is also incredibly useful to expand context on a certain semantically found chunk:',
			'i.e. given a fileId 123 and a chunk order 50 that is interesting, use { fileId: 123 cursor: 40 }, to get chunks from 40 to 60.',
		].join('\n'),
		t.Object({
			fileId: t.String({ format: 'uuid' }),
			messageId: t.String({ format: 'uuid' }),
			query: Nullish(t.String({ minLength: 1 }), {
				description: 'Optional query for semantic search across chunks.',
			}),
			cursor: Nullish(t.Integer({ min: 1 }), {
				description:
					'Cursor value for order pagination. Returns chunks with order > cursor.',
			}),
		}),
	];

	export async function read(
		activeUser: JwtPayload,
		input: Static<typeof readInput>,
	) {
		const { embedding } = input.query
			? await embed({ model: EMBEDDING_MODEL, value: input.query })
			: { embedding: undefined };

		const similarity =
			embedding &&
			sql<number>`1 - (${cosineDistance(chunk.embedding, embedding)})`;

		return db
			.select({
				id: chunk.id,
				order: chunk.order,
				text: chunk.text,
				metadata: chunk.metadata,
				...(similarity ? { similarity } : {}),
			})
			.from(chunk)
			.innerJoin(file, eq(file.id, chunk.fileId))
			.innerJoin(user, eq(user.id, file.userId))
			.where(
				and(
					eq(file.id, input.fileId),
					activeUser.isAdmin
						? eq(user.slug, activeUser.slug)
						: or(
								eq(file.userId, activeUser.id),
								exists(
									db
										.select({ credentialId: credentialPermission.credentialId })
										.from(credentialPermission)
										.innerJoin(
											credential,
											eq(credential.id, credentialPermission.credentialId),
										)
										.where(
											and(
												eq(credential.id, file.credentialId),
												eq(credentialPermission.userId, activeUser.id),
											),
										),
								),
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
					similarity ? gt(similarity, 0.3) : undefined,
					input.cursor ? gt(chunk.order, input.cursor) : undefined,
				),
			)
			.orderBy(similarity ? desc(similarity) : asc(chunk.order))
			.limit(20);
	}
}

export const fileRouter = new Elysia({ prefix: '/file', tags: ['File'] })
	.use(authPlugin())
	.post(
		'/',
		async ({ body: { file, metadata }, activeUser: { id: userId } }) =>
			File.ingest({ userId, metadata }, file),
		{
			detail: { summary: 'Ingest file' },
			body: tObject({ file: t.File(), metadata: Nullish(t.String()) }),
		},
	)
	.delete(
		'/',
		async ({ body: { ids }, activeUser }) =>
			db.delete(file).where(
				and(
					inArray(file.id, ids),
					activeUser.isAdmin
						? exists(
								db
									.select({ id: user.id })
									.from(user)
									.where(
										and(
											eq(user.id, file.userId),
											eq(user.slug, activeUser.slug),
										),
									),
							)
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
															.select({ userId: credentialPermission.userId })
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
																	eq(credentialPermission.isAdmin, true),
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
												eq(filePermission.isAdmin, true),
											),
										),
								),
							),
				),
			),
		{
			detail: { summary: 'Delete files' },
			body: tObject({ ids: t.Array(t.String({ format: 'uuid' })) }),
		},
	)
	.get('/', async ({ activeUser, query }) => File.search(activeUser, query), {
		detail: { summary: 'Search files', description: File.searchDescription },
		query: File.searchInput,
	});
