import { user } from '@api/schema';
import {
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
		fingerprint: varchar({ length: 20 }).notNull(),
		userAgent: varchar(),
		userId: uuid()
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: varchar({ length: 4096 }).notNull(),
		refreshToken: varchar({ length: 4096 }).notNull(),
		createdAt: timestamp().notNull().defaultNow(),
	},
	(t) => [uniqueIndex('device_user_fingerprint').on(t.userId, t.fingerprint)],
);
