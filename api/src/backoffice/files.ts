import { cache, db } from '@api/env';
import { providerIngestors } from '@api/integration/lib';
import {
	credential,
	externalDir,
	FileHost,
	file,
	type Language,
	PROVIDER_LABELS,
	user,
} from '@api/schema';
import { sendTemplateMail, Template } from '@api/utils/mail';
import { Nullish } from '@api/utils/type';
import { and, eq, inArray, isNull, ne } from 'drizzle-orm';
import { Elysia, t } from 'elysia';

const SYNC_FAIL_CACHE_KEY = (userId: string) => `sync-fail-notified:${userId}`;

const SYNC_FAIL_COOLDOWN = 24 * 60 * 60;

export const filesRouter = new Elysia({ prefix: '/files' }).put(
	'/sync',
	async ({ body }) => {
		const [dirsToSync, filesToSync] = await Promise.all([
			db
				.select({
					id: externalDir.id,
					externalId: externalDir.externalId,
					credentialId: externalDir.credentialId,
					provider: externalDir.provider,
					name: externalDir.name,
					userId: credential.userId,
					slug: user.slug,
				})
				.from(externalDir)
				.innerJoin(credential, eq(credential.id, externalDir.credentialId))
				.innerJoin(user, eq(user.id, credential.userId))
				.where(eq(externalDir.autoSync, true)),
			db
				.select({
					id: file.id,
					externalId: file.externalId,
					credentialId: file.credentialId,
					provider: file.provider,
					name: file.name,
					userId: file.userId,
					slug: user.slug,
				})
				.from(file)
				.innerJoin(user, eq(user.id, file.userId))
				.where(
					and(
						eq(file.autoSync, true),
						isNull(file.externalDirId),
						ne(file.provider, FileHost.NEXATA),
					),
				),
		]);

		const allItems = [
			...dirsToSync.map((dir) => ({ ...dir, isDir: true })),
			...filesToSync.map((f) => ({ ...f, isDir: false as const })),
		];

		const results = await Promise.allSettled(
			allItems.map((item) =>
				providerIngestors[item.provider]!(
					item.userId,
					item.slug,
					item.isDir ? item.credentialId : item.credentialId!,
					[
						{
							isDir: item.isDir,
							id: item.isDir ? item.externalId : item.externalId!,
						},
					],
				),
			),
		);

		const failedByUser = new Map<
			string,
			{ name: string; provider: string }[]
		>();

		for (let i = 0; i < results.length; i++) {
			const result = results[i]!;
			const item = allItems[i]!;
			const isFailed =
				result.status === 'rejected' ||
				(result.status === 'fulfilled' && result.value === 'FAILED') ||
				(result.status === 'fulfilled' && result.value === 'PARTIAL');

			if (!isFailed) continue;

			const existing = failedByUser.get(item.userId) ?? [];
			existing.push({
				name: item.name,
				provider: PROVIDER_LABELS[item.provider] ?? item.provider,
			});
			failedByUser.set(item.userId, existing);
		}

		if (failedByUser.size) {
			const userIds = [...failedByUser.keys()];
			const notifiedFlags = await cache.mget(
				...userIds.map(SYNC_FAIL_CACHE_KEY),
			);
			const usersToNotify = userIds.filter((_, i) => !notifiedFlags[i]);

			if (usersToNotify.length) {
				const usersData = await db
					.select({
						id: user.id,
						email: user.email,
						displayName: user.displayName,
						language: user.language,
					})
					.from(user)
					.where(inArray(user.id, usersToNotify));

				await Promise.allSettled(
					usersData.map(async (u) => {
						const files = failedByUser.get(u.id);
						if (!files?.length) return;

						await sendTemplateMail({
							to: u.email,
							template: Template.SYNC_FAILED,
							data: {
								displayName: u.displayName ?? u.email,
								files,
								fileCount: files.length,
								redirect: body?.redirect,
							},
							language: u.language as Language,
						});

						await cache.set(SYNC_FAIL_CACHE_KEY(u.id), true, {
							ex: SYNC_FAIL_COOLDOWN,
						});
					}),
				);
			}
		}

		return {
			total: results.length,
			synced: results.filter(
				(r) => r.status === 'fulfilled' && r.value === 'OK',
			).length,
			partial: results.filter(
				(r) => r.status === 'fulfilled' && r.value === 'PARTIAL',
			).length,
			failed: results.filter(
				(r) =>
					r.status === 'rejected' ||
					(r.status === 'fulfilled' && r.value === 'FAILED'),
			).length,
		};
	},
	{
		body: t.Optional(
			t.Object({
				redirect: Nullish(
					t.String({ format: 'uri', default: 'https://nexata.app' }),
				),
			}),
		),
		detail: {
			summary: 'Sync external files',
			description:
				'Sync for external files. Expected to run cronologically once an hour.',
		},
	},
);
