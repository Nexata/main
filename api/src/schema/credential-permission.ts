import { credential } from '@api/schema/credential';
import { user } from '@api/schema/user';
import { boolean, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';

export const credentialPermission = pgTable(
	'credential_permission',
	{
		credentialId: uuid()
			.notNull()
			.references(() => credential.id, { onDelete: 'cascade' }),
		userId: uuid()
			.references(() => user.id, { onDelete: 'cascade' })
			.notNull(),
		isAdmin: boolean().notNull().default(false),
	},
	(table) => [primaryKey({ columns: [table.credentialId, table.userId] })],
);
