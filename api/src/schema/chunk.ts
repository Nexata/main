import { file } from '@api/schema';
import { EMBEDDING_DIMENSIONS, EMBEDDING_SIZE } from '@api/utils/embed';
import {
	index,
	integer,
	pgTable,
	primaryKey,
	uuid,
	varchar,
	vector,
} from 'drizzle-orm/pg-core';

export const chunk = pgTable(
	'chunk',
	{
		fileId: uuid().references(() => file.id, { onDelete: 'cascade' }),
		order: integer().notNull().default(1),
		text: varchar({ length: EMBEDDING_SIZE }).notNull(),
		embedding: vector({ dimensions: EMBEDDING_DIMENSIONS }),
	},
	(table) => [
		primaryKey({ columns: [table.fileId, table.order] }),
		index('embeddingIndex').using(
			'hnsw',
			table.embedding.op('vector_cosine_ops'),
		),
	],
);
