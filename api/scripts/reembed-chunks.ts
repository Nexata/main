import { createOpenAI } from '@ai-sdk/openai';
import { chunk } from '@api/schema/chunk';
import { neon } from '@neondatabase/serverless';
import { embedMany } from 'ai';
import { asc, eq, gt } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';

const EMBEDDING_DIMENSIONS = 1024;
const SELECT_BATCH_SIZE = Number(process.env.REEMBED_SELECT_BATCH_SIZE ?? 200);
const EMBED_BATCH_SIZE = Number(process.env.REEMBED_EMBED_BATCH_SIZE ?? 25);
const EMBED_CONCURRENCY = Number(process.env.REEMBED_EMBED_CONCURRENCY ?? 4);
const UPDATE_CONCURRENCY = Number(process.env.REEMBED_UPDATE_CONCURRENCY ?? 10);
const START_OFFSET = Number(process.env.REEMBED_START_OFFSET ?? 0);

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

				return db.update(chunk).set({ embedding }).where(eq(chunk.id, row.id));
			}),
		);
	}
}

async function embedRows(
	embeddingModel: Parameters<typeof embedMany>[0]['model'],
	rows: { id: string; text: string }[],
): Promise<number[][]> {
	try {
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

async function main() {
	const db = drizzle({
		client: neon(requireEnv('DATABASE_URL')),
		casing: 'snake_case',
	});
	const novita = createOpenAI({
		baseURL: 'https://api.novita.ai/openai',
		apiKey: requireEnv('NOVITA_API_KEY'),
	});
	const embeddingModel = novita.embeddingModel('baai/bge-m3');

	let lastId: string | undefined;
	let total = START_OFFSET;

	if (START_OFFSET > 0) {
		const start = await db
			.select({ id: chunk.id })
			.from(chunk)
			.orderBy(asc(chunk.id))
			.limit(1)
			.offset(START_OFFSET - 1);

		lastId = start.at(0)?.id;
		if (!lastId) {
			console.log(`No chunk found at offset ${START_OFFSET}; nothing to do`);
			return;
		}

		console.log(`Resuming after offset ${START_OFFSET}`);
	}

	for (;;) {
		const rows = await db
			.select({ id: chunk.id, text: chunk.text })
			.from(chunk)
			.where(lastId ? gt(chunk.id, lastId) : undefined)
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
			console.log(`Re-embedded ${total} chunks`);
		}

		lastId = rows.at(-1)!.id;
	}

	console.log(`Finished re-embedding ${total} chunks`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
