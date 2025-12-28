import { user } from '@api/schema';
import { desc } from 'drizzle-orm';
import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const thread = pgTable(
	'thread',
	{
		id: uuid().primaryKey().defaultRandom(),
		userId: uuid()
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		title: varchar({ length: 64 }),
		createdAt: timestamp().notNull().defaultNow(),
	},
	(t) => [index('thread_created_at_desc').on(desc(t.createdAt))],
);
