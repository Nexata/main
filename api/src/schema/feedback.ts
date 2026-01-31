import { user } from '@api/schema/user';
import { coalesce, sqlArray } from '@api/utils/sql';
import { desc } from 'drizzle-orm';
import {
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

export enum FeedbackType {
	BUG_REPORT = 'bug_report',
	FEATURE_REQUEST = 'feature_request',
	QUESTION = 'question',
	OTHER = 'other',
}

export const FeedbackTypeEnum = pgEnum(
	'feedback_type',
	Object.values(FeedbackType) as [FeedbackType],
);

export enum FeedbackStatus {
	PENDING = 'pending',
	IN_REVIEW = 'in_review',
	WONTFIX = 'wontfix',
	SOLVED = 'solved',
}

export const FeedbackStatusEnum = pgEnum(
	'feedback_status',
	Object.values(FeedbackStatus) as [FeedbackStatus],
);

export const feedback = pgTable(
	'feedback',
	{
		id: uuid().primaryKey().defaultRandom(),
		userId: uuid()
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		type: FeedbackTypeEnum().notNull(),
		status: FeedbackStatusEnum().notNull().default(FeedbackStatus.PENDING),
		comment: varchar({ length: 1000 }).notNull(),
		response: text(),
		fileUrls: text().array().default(sqlArray([], 'text')),
		createdAt: timestamp().notNull().defaultNow(),
		modifiedAt: timestamp(),
	},
	(t) => [
		index('feedback_cursor_desc').on(desc(coalesce(t.modifiedAt, t.createdAt))),
	],
);
