import { thread } from '@api/schema/thread';
import { asc } from 'drizzle-orm';
import {
	boolean,
	index,
	jsonb,
	pgEnum,
	pgTable,
	timestamp,
	uuid,
} from 'drizzle-orm/pg-core';

export enum MessageRole {
	SYSTEM = 'system',
	USER = 'user',
	ASSISTANT = 'assistant',
	TOOL = 'tool',
}

export const MessageRoleEnum = pgEnum(
	'message_role',
	Object.values(MessageRole) as [MessageRole],
);

export const message = pgTable(
	'message',
	{
		id: uuid().primaryKey().defaultRandom(),
		role: MessageRoleEnum().notNull().default(MessageRole.USER),
		content: jsonb().notNull(),
		extraReason: boolean().notNull().default(false),
		threadId: uuid()
			.notNull()
			.references(() => thread.id, { onDelete: 'cascade' }),
		createdAt: timestamp().notNull().defaultNow(),
	},
	(t) => [index('message_created_at_asc').on(asc(t.createdAt))],
);
