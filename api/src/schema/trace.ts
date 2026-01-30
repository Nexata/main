import { user } from '@api/schema/user';
import { desc } from 'drizzle-orm';
import {
	index,
	json,
	pgEnum,
	pgTable,
	timestamp,
	uuid,
} from 'drizzle-orm/pg-core';

export enum TraceType {
	MESSAGE_SENT = 'message_sent',
	FILE_INGESTED = 'file_ingested',
	FILE_DELETED = 'file_deleted',
	CREDENTIAL_ADDED = 'credential_added',
	CREDENTIAL_REMOVED = 'credential_removed',
	INGEST_FAILED = 'ingest_failed',
}

export const TraceTypeEnum = pgEnum(
	'trace_type',
	Object.values(TraceType) as [TraceType],
);

export const trace = pgTable(
	'trace',
	{
		id: uuid().primaryKey().defaultRandom(),
		userId: uuid().references(() => user.id, { onDelete: 'set null' }),
		type: TraceTypeEnum().notNull(),
		metadata: json().notNull(),
		createdAt: timestamp().notNull().defaultNow(),
	},
	(t) => [index('trace_created_at_desc').on(desc(t.createdAt))],
);
