import { authPlugin } from '@api/auth';
import { db } from '@api/env';
import { FeedbackStatus, FeedbackType, feedback, user } from '@api/schema';
import type { ActiveUser } from '@api/utils/auth';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { S3_ACCESS_URL } from '@api/utils/s3';
import { coalesce } from '@api/utils/sql';
import { Nullish, tObject } from '@api/utils/type';
import { s3 } from 'bun';
import { and, desc, eq, lt } from 'drizzle-orm';
import { Elysia, type Static, t } from 'elysia';

export namespace NexataFeedback {
	export const [listDescription, listInput] = [
		"List user's feedback submissions. Tenant admins can see all feedback from their tenant, regular users see only their own. Use cursor pagination with the modifiedAt/createdAt of the last item.",
		t.Object({
			status: Nullish(t.Enum(FeedbackStatus), {
				description: 'Filter by feedback status',
			}),
			type: Nullish(t.Enum(FeedbackType), {
				description: 'Filter by feedback type',
			}),
			cursor: Nullish(t.String({ format: 'date-time' }), {
				description:
					'Cursor for pagination. Use the modifiedAt (or createdAt if null) of the last item from previous page.',
			}),
		}),
	];

	export async function list(
		activeUser: ActiveUser,
		input: Static<typeof listInput>,
	) {
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
				},
			})
			.from(feedback)
			.innerJoin(user, eq(user.id, feedback.userId))
			.where(
				and(
					activeUser.isAdmin
						? eq(user.slug, activeUser.slug)
						: eq(feedback.userId, activeUser.id),
					input.status ? eq(feedback.status, input.status) : undefined,
					input.type ? eq(feedback.type, input.type) : undefined,
					input.cursor ? lt(cursorExpr, new Date(input.cursor)) : undefined,
				),
			)
			.orderBy(desc(cursorExpr))
			.limit(25);
	}

	export const [createDescription, createInput] = [
		'Submit new feedback (bug report, feature request, question, or other). Users can attach files to provide additional context.',
		t.Object({
			type: t.Enum(FeedbackType, {
				description: 'Type of feedback being submitted',
			}),
			comment: t.String({
				minLength: 1,
				maxLength: 1000,
				description: 'The feedback message (max 1000 characters)',
			}),
		}),
	];

	export async function create(
		activeUser: ActiveUser,
		input: Static<typeof createInput>,
		files?: File[],
	) {
		const id = crypto.randomUUID();

		const fileUrls = files?.length
			? await Promise.all(
					files.map(async (f) => {
						const path = `t/${activeUser.slug}/feedback/${id}/${f.name}`;
						await s3.write(path, f, { acl: 'public-read', type: f.type });
						return `${S3_ACCESS_URL}/${path}`;
					}),
				)
			: [];

		await db.insert(feedback).values({
			id,
			userId: activeUser.id,
			type: input.type,
			comment: input.comment,
			fileUrls,
		});

		return { id, fileUrls };
	}
}

export const feedbackRouter = new Elysia({
	prefix: '/feedback',
	tags: ['Feedback'],
})
	.use(authPlugin())
	.post(
		'/',
		async ({ body: { type, comment, files }, activeUser }) =>
			NexataFeedback.create(activeUser, { type, comment }, files ?? undefined),
		{
			detail: { summary: 'Create feedback' },
			body: tObject({
				type: t.Enum(FeedbackType),
				comment: t.String({ minLength: 1, maxLength: 1000 }),
				files: Nullish(t.Files()),
			}),
		},
	)
	.get(
		'/',
		async ({ activeUser, query }) => NexataFeedback.list(activeUser, query),
		{
			detail: {
				summary: 'List feedback',
				description: NexataFeedback.listDescription,
			},
			query: NexataFeedback.listInput,
		},
	)
	.patch(
		'/:id',
		async ({ params: { id }, body, activeUser }) => {
			const existing = (
				await db
					.select({
						id: feedback.id,
						fileUrls: feedback.fileUrls,
					})
					.from(feedback)
					.where(and(eq(feedback.id, id), eq(feedback.userId, activeUser.id)))
			).at(0);

			if (!existing)
				throw httpError(
					HttpCode.NOT_FOUND,
					ErrorCode.FEEDBACK_NOT_FOUND,
					activeUser.language,
				);

			let updatedFileUrls = existing.fileUrls ?? [];

			if (body.removeFileUrls?.length) {
				const urlsToRemove = body.removeFileUrls;
				await Promise.allSettled(
					urlsToRemove.map((url) => {
						const path = url.replace(`${S3_ACCESS_URL}/`, '');
						return s3.delete(path);
					}),
				);

				updatedFileUrls = updatedFileUrls.filter(
					(url) => !urlsToRemove.includes(url),
				);
			}

			if (body.files?.length) {
				const newFileUrls = await Promise.all(
					body.files.map(async (f) => {
						const path = `t/${activeUser.slug}/feedback/${id}/${f.name}`;
						await s3.write(path, f, { acl: 'public-read', type: f.type });
						return `${S3_ACCESS_URL}/${path}`;
					}),
				);
				updatedFileUrls = [...updatedFileUrls, ...newFileUrls];
			}

			return (
				await db
					.update(feedback)
					.set({
						type: body.type ?? undefined,
						comment: body.comment ?? undefined,
						fileUrls: updatedFileUrls,
						modifiedAt: new Date(),
					})
					.where(eq(feedback.id, id))
					.returning({ id: feedback.id, fileUrls: feedback.fileUrls })
			).at(0);
		},
		{
			detail: { summary: 'Update feedback' },
			params: tObject({ id: t.String({ format: 'uuid' }) }),
			body: tObject({
				type: Nullish(t.Enum(FeedbackType)),
				comment: Nullish(t.String({ minLength: 1, maxLength: 1000 })),
				files: Nullish(t.Files()),
				removeFileUrls: Nullish(t.Array(t.String())),
			}),
		},
	)
	.delete(
		'/:id',
		async ({ params: { id }, activeUser }) => {
			const existing = (
				await db
					.select({
						id: feedback.id,
						fileUrls: feedback.fileUrls,
					})
					.from(feedback)
					.innerJoin(user, eq(user.id, feedback.userId))
					.where(
						and(
							eq(feedback.id, id),
							activeUser.isAdmin
								? eq(user.slug, activeUser.slug)
								: eq(feedback.userId, activeUser.id),
						),
					)
			).at(0);

			if (!existing)
				throw httpError(
					HttpCode.NOT_FOUND,
					ErrorCode.FEEDBACK_NOT_FOUND,
					activeUser.language,
				);

			await Promise.all([
				db.delete(feedback).where(eq(feedback.id, id)),
				...(existing?.fileUrls ?? []).map((url) =>
					s3.delete(url.replace(`${S3_ACCESS_URL}/`, '')),
				),
			]);

			return { id };
		},
		{
			detail: { summary: 'Delete feedback' },
			params: tObject({ id: t.String({ format: 'uuid' }) }),
		},
	);
