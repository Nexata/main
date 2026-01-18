import { file } from '@api/schema';
import {
	index,
	integer,
	jsonb,
	pgTable,
	uuid,
	varchar,
	vector,
} from 'drizzle-orm/pg-core';
export const chunk = pgTable(
	'chunk',
	{
		id: uuid().primaryKey().defaultRandom(),
		fileId: uuid()
			.references(() => file.id, { onDelete: 'cascade' })
			.notNull(),
		order: integer().notNull().default(1),
		text: varchar({ length: 768 }).notNull(), // EMBEDDING_SIZE
		embedding: vector({ dimensions: 1024 }).notNull(), // EMBEDDING_DIMENSIONS
		metadata: jsonb(),
	},
	(t) => [
		index('chunk_order').on(t.fileId, t.order),
		index('chunk_embedding').using('hnsw', t.embedding.op('vector_cosine_ops')),
	],
);
