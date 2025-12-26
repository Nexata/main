import { authPlugin } from '@api/auth';
import { db } from '@api/env';
import { filePermission, user } from '@api/schema';
import { tObject } from '@api/utils/type';
import { and, eq, exists, isNull, or } from 'drizzle-orm';
import { createInsertSchema, createUpdateSchema } from 'drizzle-typebox';
import Elysia, { t } from 'elysia';

const [insertUser, updateUser] = [
	createInsertSchema(user, { email: t.String({ format: 'email' }) }),
	createUpdateSchema(user, { email: t.String({ format: 'email' }) }),
];

export const userRouter = new Elysia({ prefix: '/user' })
	.use(authPlugin(true))
	// Post with pfp
	.post(
		'/',
		async ({ body, activeUser }) => {
			const id = crypto.randomUUID();

			await db
				.with(
					db.$with('new_user').as(
						db
							.insert(user)
							.values({ ...body, id, slug: activeUser.slug })
							.returning({ id: user.id }),
					),
				)
				.update(filePermission)
				.set({ userId: id })
				.where(eq(filePermission.email, body.email));

			return id;
		},
		{
			detail: { summary: 'Create user' },
			body: t.Omit(insertUser, ['id', 'slug', 'pfpUrl']),
		},
	)
	// TODO: Post with pfp
	.patch(
		'/:id',
		async ({ body, params: { id }, activeUser }) =>
			db
				.update(user)
				.set(body)
				.where(and(eq(user.id, id), eq(user.slug, activeUser.slug)))
				.returning({ id: user.id }),
		{
			detail: { summary: 'Update user by ID' },
			body: t.Omit(updateUser, ['id', 'slug', 'email', 'pfpUrl']),
			params: tObject({ id: t.String({ format: 'uuid' }) }),
		},
	)
	// TODO: Delete with pfp
	.delete(
		'/:id',
		async ({ params: { id }, activeUser }) =>
			Promise.all([
				db
					.delete(filePermission)
					.where(
						and(
							eq(filePermission.userId, id),
							or(
								eq(filePermission.inferred, false),
								isNull(filePermission.email),
							),
							exists(
								db
									.select({ id: user.id })
									.from(user)
									.where(and(eq(user.id, id), eq(user.slug, activeUser.slug))),
							),
						),
					)
					.returning({ filePermissionId: filePermission.id }),
				db
					.delete(user)
					.where(and(eq(user.id, id), eq(user.slug, activeUser.slug)))
					.returning({ userId: user.id }),
			]),
		{
			detail: { summary: 'Delete user by ID' },
			params: tObject({ id: t.String({ format: 'uuid' }) }),
		},
	);
