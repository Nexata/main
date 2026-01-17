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
	thread,
	user,
} from '@api/schema';
import type { JwtPayload } from '@api/utils/auth';
import { uploadFile } from '@api/utils/s3';
import { caseWhenNull, jsonAgg, jsonBuildObject } from '@api/utils/sql';
import { Nullish, tObject } from '@api/utils/type';
import { embed } from 'ai';
import {
	and,
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
							}),
							isNotNull(chunk.id),
						).as('chunks')
					: sql<[]>`'[]'::json`,
			})
			.from(file)
			.innerJoin(user, eq(user.id, file.userId))
			.leftJoin(thread, eq(thread.id, file.threadId))
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
					similarity && or(gt(similarity, 0.5)),
					input.provider ? eq(file.provider, input.provider) : undefined,
					input.name ? ilike(file.name, `%${input.name}%`) : undefined,
					input.type ? ilike(file.type, `%${input.type}%`) : undefined,
					input.createdAt ? gte(file.createdAt, input.createdAt) : undefined,
				),
			)
			.groupBy(file.id, user.id, thread.id, credential.id, chunk.id)
			.orderBy(similarity ? desc(similarity) : desc(file.createdAt))
			.limit(similarity ? 10 : 100)
			.offset(((input.page ?? 1) - 1) * 10)
			.catch(console.error);
	}

	export async function ingest(
		data: Partial<Static<typeof insertFile>> & { userId: string },
		f: File,
	) {
		data.id = crypto.randomUUID();

		const [stringChunks, stringUsage] = await toStringChunks(
			await f.arrayBuffer(),
			data.type ?? f.type,
		);

		const [chunks, embeddingUsage] = await stringToChunks(
			data.id,
			stringChunks,
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
				consumption: (stringUsage + embeddingUsage).toString(),
				userId: data.userId,
			}),
			db.insert(chunk).values(chunks),
		]);

		return data.id;
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
