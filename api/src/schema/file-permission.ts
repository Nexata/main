import { file, user } from '@api/schema';
import { isNotNull, or } from 'drizzle-orm';
import { boolean, check, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

export const filePermission = pgTable(
	'file_permission',
	{
		id: uuid().primaryKey().defaultRandom(),
		fileId: uuid()
			.notNull()
			.references(() => file.id, { onDelete: 'cascade' }),
		userId: uuid().references(() => user.id),
		email: varchar({ length: 320 }),
		inferred: boolean().notNull().default(false),
		isAdmin: boolean().notNull().default(false),
	},
	(table) => [
		check(
			'file_permission_user_or_email_exists',
			// biome-ignore lint/style/noNonNullAssertion: Drizzle miss-type
			or(isNotNull(table.userId), isNotNull(table.email))!.getSQL(),
		),
	],
);
