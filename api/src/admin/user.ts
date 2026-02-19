import { authPlugin } from '@api/auth';
import { cache, db } from '@api/env';
import { filePermission, type Language, tenant, user } from '@api/schema';
import { userCacheKey } from '@api/utils/auth';
import { sendTemplateMail, Template } from '@api/utils/mail';
import { uploadUserPfp } from '@api/utils/s3';
import { Nullish, tObject } from '@api/utils/type';
import { s3 } from 'bun';
import { and, eq, exists, isNull, or } from 'drizzle-orm';
import { createInsertSchema, createUpdateSchema } from 'drizzle-typebox';
import { Elysia, t } from 'elysia';

const [insertUser, updateUser] = [
	createInsertSchema(user, { email: t.String({ format: 'email' }) }),
	createUpdateSchema(user, { email: t.String({ format: 'email' }) }),
];

export const userRouter = new Elysia({ prefix: '/user' })
	.use(authPlugin({ admin: true }))
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
								pfpUrl:
									body.pfp &&
									(await uploadUserPfp(activeUser.slug, id, body.pfp)),
								slug: activeUser.slug,
							})
							.returning({ id: user.id }),
					),
				)
				.update(filePermission)
				.set({ userId: id })
				.where(eq(filePermission.email, body.email));

			if (body.sendMail) {
				const t = (
					await db
						.select({
							displayName: tenant.displayName,
							logoUrl: tenant.logoUrl,
						})
						.from(tenant)
						.where(eq(tenant.slug, activeUser.slug))
						.limit(1)
				).at(0);

				await sendTemplateMail({
					to: body.email,
					template: Template.USER_INVITED,
					data: {
						tenantDisplayName: t?.displayName ?? activeUser.slug,
						logoUrl: t?.logoUrl,
						redirect: body.redirect,
					},
					language: activeUser.language as Language,
				});
			}

			return id;
		},
		{
			detail: { summary: 'Create user' },
			body: t.Composite([
				t.Pick(insertUser, ['email', 'displayName'], {
					email: t.String({ format: 'email' }),
				}),
				t.Object({
					pfp: t.Optional(t.File({ format: 'image/*', maxSize: '4m' })),
					isAdmin: t.Optional(t.BooleanString({ default: false })),
					sendMail: t.BooleanString({ default: true }),
					redirect: Nullish(
						t.String({ format: 'uri', default: 'https://nexata.app' }),
					),
				}),
			]),
		},
	)
	.patch(
		'/:id',
		async ({ body, params: { id }, activeUser }) => {
			const updated = (
				await db
					.update(user)
					.set({
						...body,
						pfpUrl:
							body.pfp && (await uploadUserPfp(activeUser.slug, id, body.pfp)),
					})
					.where(and(eq(user.id, id), eq(user.slug, activeUser.slug)))
					.returning()
			).at(0);

			if (updated)
				await cache.set(
					userCacheKey(activeUser.slug, id),
					{ ...updated, apiKey: null },
					{ ex: 12 * 60 * 60 },
				);

			return { id: updated?.id };
		},
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
			await Promise.all([
				db.batch([
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
										.where(
											and(eq(user.id, id), eq(user.slug, activeUser.slug)),
										),
								),
							),
						)
						.returning({ filePermissionId: filePermission.id }),
					db
						.delete(user)
						.where(and(eq(user.id, id), eq(user.slug, activeUser.slug)))
						.returning({ userId: user.id }),
				]),
				cache.del(userCacheKey(activeUser.slug, id)),
			]);

			await s3.delete(`t/${activeUser.slug}/u/${id}`);

			return id;
		},
		{
			detail: { summary: 'Delete user by ID' },
			params: tObject({ id: t.String({ format: 'uuid' }) }),
		},
	);
