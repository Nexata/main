import { authPlugin } from '@api/auth';
import { db } from '@api/env';
import { filePermission, user } from '@api/schema';
import { uploadUserPfp } from '@api/utils/s3';
import { tObject } from '@api/utils/type';
import { s3 } from 'bun';
import { and, eq, exists, isNull, or } from 'drizzle-orm';
import { createInsertSchema, createUpdateSchema } from 'drizzle-typebox';
import { Elysia, t } from 'elysia';

const [insertUser, updateUser] = [
	createInsertSchema(user, { email: t.String({ format: 'email' }) }),
	createUpdateSchema(user, { email: t.String({ format: 'email' }) }),
];

export const userRouter = new Elysia({ prefix: '/user' })
	.use(authPlugin(true))
	.post(
		'/',
		async ({ body, activeUser }) => {
			const id = crypto.randomUUID();

			await db
				.with(
					db.$with('new_user').as(
						db
							.insert(user)
							.values({
								...body,
								id,
								pfpUrl: body.pfp && (await uploadUserPfp(id, body.pfp)),
								slug: activeUser.slug,
							})
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
			body: t.Composite([
				t.Omit(insertUser, ['id', 'slug', 'pfpUrl', 'isAdmin'], {
					email: t.String({ format: 'email' }),
				}),
				t.Object({
					pfp: t.Optional(t.File({ format: 'image/*', maxSize: '4m' })),
					isAdmin: t.Optional(t.BooleanString({ default: false })),
				}),
			]),
		},
	)
	.patch(
		'/:id',
		async ({ body, params: { id }, activeUser }) =>
			db
				.update(user)
				.set({
					...body,
					pfpUrl: body.pfp && (await uploadUserPfp(id, body.pfp)),
				})
				.where(and(eq(user.id, id), eq(user.slug, activeUser.slug)))
				.returning({ id: user.id }),
		{
			detail: { summary: 'Update user by ID' },
			body: t.Composite([
				t.Omit(updateUser, ['id', 'slug', 'email', 'pfpUrl']),
				t.Object({
					pfp: t.Optional(t.File({ format: 'image/*', maxSize: '4m' })),
				}),
			]),
			params: tObject({ id: t.String({ format: 'uuid' }) }),
		},
	)
	.delete(
		'/:id',
		async ({ params: { id }, activeUser }) => {
			await db.batch([
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
			]);

			await s3.delete(`u/${id}`);

			return id;
		},
		{
			detail: { summary: 'Delete user by ID' },
			params: tObject({ id: t.String({ format: 'uuid' }) }),
		},
	);
