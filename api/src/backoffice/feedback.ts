import { db } from '@api/env';
import { FeedbackStatus, FeedbackType, feedback, user } from '@api/schema';
import { S3_ACCESS_URL } from '@api/utils/s3';
import { coalesce } from '@api/utils/sql';
import { Nullish, tObject } from '@api/utils/type';
import { s3 } from 'bun';
import { and, desc, eq, lt } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { HttpError } from 'elysia-logger';

export const feedbackRouter = new Elysia({ prefix: '/feedback' })
	.get(
		'/',
		async ({ query: { status, type, slug, cursor } }) => {
			const cursorExpr = coalesce(feedback.modifiedAt, feedback.createdAt);

			return db
				.select({
					id: feedback.id,
					type: feedback.type,
					status: feedback.status,
					comment: feedback.comment,
					response: feedback.response,
					fileUrls: feedback.fileUrls,
					createdAt: feedback.createdAt,
					modifiedAt: feedback.modifiedAt,
					user: {
						id: user.id,
						email: user.email,
						displayName: user.displayName,
						pfpUrl: user.pfpUrl,
						slug: user.slug,
					},
				})
				.from(feedback)
				.innerJoin(user, eq(user.id, feedback.userId))
				.where(
					and(
						status ? eq(feedback.status, status) : undefined,
						type ? eq(feedback.type, type) : undefined,
						slug ? eq(user.slug, slug) : undefined,
						cursor ? lt(cursorExpr, new Date(cursor)) : undefined,
					),
				)
				.orderBy(desc(cursorExpr))
				.limit(50);
		},
		{
			detail: { summary: 'List all feedback' },
			query: tObject({
				status: Nullish(t.Enum(FeedbackStatus)),
				type: Nullish(t.Enum(FeedbackType)),
				slug: Nullish(t.String({ maxLength: 16 })),
				cursor: Nullish(t.String({ format: 'date-time' })),
			}),
		},
	)
	.patch(
		'/:id',
		async ({ params: { id }, body }) => {
			const existing = (
				await db
					.select({ id: feedback.id })
					.from(feedback)
					.where(eq(feedback.id, id))
			).at(0);

			if (!existing) throw HttpError.NotFound('FEEDBACK_NOT_FOUND');

			return (
				await db
					.update(feedback)
					.set({
						status: body.status ?? undefined,
						response: body.response ?? undefined,
						modifiedAt: new Date(),
					})
					.where(eq(feedback.id, id))
					.returning({ id: feedback.id })
			).at(0);
		},
		{
			detail: { summary: 'Update feedback status/response' },
			params: tObject({ id: t.String({ format: 'uuid' }) }),
			body: tObject({
				status: Nullish(t.Enum(FeedbackStatus)),
				response: Nullish(t.String({ maxLength: 10000 })),
			}),
		},
	)
	.delete(
		'/:id',
		async ({ params: { id } }) => {
			const existing = (
				await db
					.select({
						id: feedback.id,
						fileUrls: feedback.fileUrls,
					})
					.from(feedback)
					.where(eq(feedback.id, id))
			).at(0);

			if (!existing) throw HttpError.NotFound('FEEDBACK_NOT_FOUND');

			return Promise.allSettled([
				db.delete(feedback).where(eq(feedback.id, id)),
				(existing?.fileUrls ?? []).map((url) => {
					const path = url.replace(`${S3_ACCESS_URL}/`, '');
					return s3.delete(path);
				}),
			]);
		},
		{
			detail: { summary: 'Delete feedback' },
			params: tObject({ id: t.String({ format: 'uuid' }) }),
		},
	);
