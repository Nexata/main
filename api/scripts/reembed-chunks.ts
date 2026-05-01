import { createOpenAI } from '@ai-sdk/openai';
import { chunk } from '@api/schema/chunk';
import { neon } from '@neondatabase/serverless';
import {
	defaultEmbeddingSettingsMiddleware,
	embedMany,
	wrapEmbeddingModel,
} from 'ai';
import { asc, isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';

const EMBEDDING_DIMENSIONS = 2048;
const SELECT_BATCH_SIZE = Number(process.env.REEMBED_SELECT_BATCH_SIZE ?? 200);
const EMBED_BATCH_SIZE = Number(process.env.REEMBED_EMBED_BATCH_SIZE ?? 25);
const EMBED_CONCURRENCY = Number(process.env.REEMBED_EMBED_CONCURRENCY ?? 1);
const UPDATE_CONCURRENCY = Number(process.env.REEMBED_UPDATE_CONCURRENCY ?? 10);
const EMBED_REQUEST_DELAY_MS = Number(
	process.env.REEMBED_REQUEST_DELAY_MS ?? 1500,
);
const SWAP_COLUMNS = process.env.REEMBED_SWAP === 'true';

let nextEmbedRequestAt = 0;

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is required`);
	return value;
}

function isTransientError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;

	return [429, 500, 502, 503, 504].some((code) =>
		error.message.includes(`${code}`),
	);
}

function isPayloadTooLargeError(error: unknown): boolean {
	return error instanceof Error && error.message.includes('Payload Too Large');
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
	let lastError: unknown;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			if (attempt >= maxRetries || !isTransientError(error)) throw error;

			await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
		}
	}

	throw lastError;
}

async function waitForEmbedRequestSlot() {
	const now = Date.now();
	const waitMs = Math.max(0, nextEmbedRequestAt - now);
	nextEmbedRequestAt =
		Math.max(now, nextEmbedRequestAt) + EMBED_REQUEST_DELAY_MS;

	if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
}

async function ensureNextEmbeddingColumn(db: ReturnType<typeof drizzle>) {
	await db.execute(
		sql.raw(
			`ALTER TABLE "chunk" ADD COLUMN IF NOT EXISTS "embedding_next" vector(${EMBEDDING_DIMENSIONS})`,
		),
	);
}

async function updateChunkEmbeddings(
	db: ReturnType<typeof drizzle>,
	rows: { id: string; text: string }[],
	embeddings: number[][],
) {
	for (let i = 0; i < rows.length; i += UPDATE_CONCURRENCY) {
		await Promise.all(
			rows.slice(i, i + UPDATE_CONCURRENCY).map((row, offset) => {
				const embedding = embeddings[i + offset];
				if (!embedding)
					throw new Error(`Missing embedding for chunk ${row.id}`);

				if (embedding.length !== EMBEDDING_DIMENSIONS)
					throw new Error(
						`Chunk ${row.id} embedding has ${embedding.length} dimensions; expected ${EMBEDDING_DIMENSIONS}`,
					);

				return db.execute(
					sql`UPDATE "chunk" SET "embedding_next" = ${JSON.stringify(embedding)}::vector WHERE "id" = ${row.id}`,
				);
			}),
		);
	}
}

async function embedRows(
	embeddingModel: Parameters<typeof embedMany>[0]['model'],
	rows: { id: string; text: string }[],
): Promise<number[][]> {
	try {
		await waitForEmbedRequestSlot();
		const result = await withRetry(() =>
			embedMany({
				model: embeddingModel,
				values: rows.map((row) => row.text),
			}),
		);
		return result.embeddings;
	} catch (error) {
		if (!isPayloadTooLargeError(error) || rows.length === 1) throw error;

		const midpoint = Math.ceil(rows.length / 2);
		return [
			...(await embedRows(embeddingModel, rows.slice(0, midpoint))),
			...(await embedRows(embeddingModel, rows.slice(midpoint))),
		];
	}
}

async function reembedChunks(
	db: ReturnType<typeof drizzle>,
	embeddingModel: Parameters<typeof embedMany>[0]['model'],
) {
	let total = 0;

	for (;;) {
		const rows = await db
			.select({ id: chunk.id, text: chunk.text })
			.from(chunk)
			.where(isNull(sql`"embedding_next"`))
			.orderBy(asc(chunk.id))
			.limit(SELECT_BATCH_SIZE);

		if (!rows.length) break;

		const batches: (typeof rows)[] = [];
		for (let i = 0; i < rows.length; i += EMBED_BATCH_SIZE)
			batches.push(rows.slice(i, i + EMBED_BATCH_SIZE));

		for (let i = 0; i < batches.length; i += EMBED_CONCURRENCY) {
			const processed = await Promise.all(
				batches.slice(i, i + EMBED_CONCURRENCY).map(async (batch) => {
					const embeddings = await embedRows(embeddingModel, batch);
					await updateChunkEmbeddings(db, batch, embeddings);
					return batch.length;
				}),
			);

			total += processed.reduce((acc, count) => acc + count, 0);
			console.log(`Re-embedded ${total} chunks this run`);
		}
	}

	console.log(`Finished re-embedding ${total} chunks this run`);
}

async function countPendingChunks(
	db: ReturnType<typeof drizzle>,
): Promise<number> {
	const result = await db.execute(
		sql<{
			count: string;
		}>`SELECT count(*) FROM "chunk" WHERE "embedding_next" IS NULL`,
	);
	return Number(result.rows.at(0)?.count ?? 0);
}

async function swapEmbeddingColumns(db: ReturnType<typeof drizzle>) {
	const pending = await countPendingChunks(db);
	if (pending > 0)
		throw new Error(
			`Cannot swap columns; ${pending} chunks are not re-embedded`,
		);

	await db.execute(sql.raw('DROP INDEX IF EXISTS "chunk_embedding"'));
	await db.execute(sql.raw('ALTER TABLE "chunk" DROP COLUMN "embedding"'));
	await db.execute(
		sql.raw(
			'ALTER TABLE "chunk" RENAME COLUMN "embedding_next" TO "embedding"',
		),
	);
	await db.execute(
		sql.raw('ALTER TABLE "chunk" ALTER COLUMN "embedding" SET NOT NULL'),
	);
	await db.execute(
		sql.raw(
			`CREATE INDEX "chunk_embedding" ON "chunk" USING hnsw (("embedding"::halfvec(${EMBEDDING_DIMENSIONS})) halfvec_cosine_ops)`,
		),
	);
}

async function main() {
	const db = drizzle({
		client: neon(requireEnv('DATABASE_URL')),
		casing: 'snake_case',
	});
	const novita = createOpenAI({
		baseURL: 'https://api.novita.ai/openai',
		apiKey: requireEnv('NOVITA_API_KEY'),
	});
	const embeddingModel = wrapEmbeddingModel({
		model: novita.embeddingModel('qwen/qwen3-embedding-8b'),
		middleware: defaultEmbeddingSettingsMiddleware({
			settings: {
				providerOptions: {
					openai: { dimensions: EMBEDDING_DIMENSIONS },
				},
			},
		}),
	});

	await ensureNextEmbeddingColumn(db);
	await reembedChunks(db, embeddingModel);

	const pending = await countPendingChunks(db);
	if (pending > 0) throw new Error(`${pending} chunks remain unembedded`);

	if (!SWAP_COLUMNS) {
		console.log('Prepared embedding_next for all chunks.');
		console.log(
			'Run with REEMBED_SWAP=true during deployment window to swap columns.',
		);
		return;
	}

	await swapEmbeddingColumns(db);
	console.log('Swapped embedding columns and rebuilt chunk_embedding index.');
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
