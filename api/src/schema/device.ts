import { user } from '@api/schema';
import {
	boolean,
	index,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

export const device = pgTable(
	'device',
	{
		id: uuid().primaryKey().defaultRandom(),
		fingerprint: varchar({ length: 256 }).notNull(),
		userId: uuid()
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		isAccessToken: boolean().notNull().default(true),
		createdAt: timestamp().notNull().defaultNow(),
	},
	(t) => [
		uniqueIndex('device_fingerprint_user_token_type').on(
			t.fingerprint,
			t.userId,
			t.isAccessToken,
		),
		index('device_user_id').on(t.userId),
	],
);
