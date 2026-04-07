import { cache, db } from '@api/env';
import { providerIngestors } from '@api/integration/lib';
import {
	credential,
	externalDir,
	FileHost,
	file,
	type Language,
	PROVIDER_LABELS,
	TraceType,
	trace,
	user,
} from '@api/schema';
import { ensureFreshTokens } from '@api/utils/credential';
import { requireEnv } from '@api/utils/env';
import { sendTemplateMail, Template } from '@api/utils/mail';
import { Nullish } from '@api/utils/type';
import { captureException } from '@sentry/bun';
import { and, eq, inArray, isNull, ne } from 'drizzle-orm';
import { Elysia, t } from 'elysia';

const SYNC_FAIL_CACHE_KEY = (userId: string) => `sync-fail-notified:${userId}`;

const SYNC_FAIL_COOLDOWN = 23 * 60 * 60;

function dedupeSyncItems<
	T extends { provider: FileHost; isDir: boolean; externalId: string },
>(items: T[]) {
	const unique = new Map<string, T>();

	for (const item of items)
		unique.set(`${item.provider}:${item.isDir}:${item.externalId}`, item);

	return [...unique.values()];
}

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

		const uniqueCredentialIds = [
			...new Set(allItems.map((item) => item.credentialId).filter(Boolean)),
		] as string[];

		const failedCredentialIds = new Set<string>();

		if (uniqueCredentialIds.length) {
			const credentialRows = await db
				.select({
					id: credential.id,
					provider: credential.provider,
					accessToken: credential.accessToken,
					refreshToken: credential.refreshToken,
					accessTokenExpiresAt: credential.accessTokenExpiresAt,
					slug: user.slug,
				})
				.from(credential)
				.innerJoin(user, eq(user.id, credential.userId))
				.where(inArray(credential.id, uniqueCredentialIds));

			await Promise.allSettled(
				credentialRows.map(async (cred) => {
					try {
						await ensureFreshTokens(
							cred.id,
							cred.provider,
							cred.accessToken,
							cred.refreshToken,
							cred.accessTokenExpiresAt,
							cred.slug,
						);
					} catch (error) {
						captureException(error, {
							tags: { source: 'sync.ensureFreshTokens' },
							extra: { credentialId: cred.id },
						});
						failedCredentialIds.add(cred.id);
					}
				}),
			);
		}

		const itemsToSync: typeof allItems = [];
		const failedItems: typeof allItems = [];

		for (const item of allItems) {
			if (item.credentialId && failedCredentialIds.has(item.credentialId))
				failedItems.push(item);
			else itemsToSync.push(item);
		}

		if (failedItems.length)
			await db.insert(trace).values(
				failedItems.map((item) => ({
					userId: item.userId,
					type: TraceType.INGEST_FAILED,
					metadata: {
						provider: item.provider,
						externalId: item.isDir ? item.externalId : item.externalId!,
						name: item.name,
						error: 'TOKEN_REFRESH_FAILED',
					},
				})),
			);

		const dedupedItemsToSync = dedupeSyncItems(
			itemsToSync.filter(
				(item): item is (typeof itemsToSync)[number] & { externalId: string } =>
					typeof item.externalId === 'string',
			),
		);

		const results = await Promise.allSettled(
			dedupedItemsToSync.map((item) =>
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

		for (const item of failedItems) {
			const existing = failedByUser.get(item.userId) ?? [];
			existing.push({
				name: item.name,
				provider: PROVIDER_LABELS[item.provider] ?? item.provider,
			});
			failedByUser.set(item.userId, existing);
		}

		for (let i = 0; i < results.length; i++) {
			const result = results[i]!;
			const item = dedupedItemsToSync[i]!;
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

						const MAX_FILES = 3;
						const extraCount =
							files.length > MAX_FILES ? files.length - MAX_FILES : 0;

						await sendTemplateMail({
							to: u.email,
							template: Template.SYNC_FAILED,
							data: {
								displayName: u.displayName ?? u.email,
								files: files.slice(0, MAX_FILES),
								fileCount: files.length,
								extraCount,
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
			total: results.length + failedItems.length,
			synced: results.filter(
				(r) => r.status === 'fulfilled' && r.value === 'OK',
			).length,
			unmodified: results.filter(
				(r) => r.status === 'fulfilled' && r.value === 'UNMODIFIED',
			).length,
			partial: results.filter(
				(r) => r.status === 'fulfilled' && r.value === 'PARTIAL',
			).length,
			failed:
				results.filter(
					(r) =>
						r.status === 'rejected' ||
						(r.status === 'fulfilled' && r.value === 'FAILED'),
				).length + failedItems.length,
		};
	},
	{
		body: t.Optional(
			t.Object({
				redirect: Nullish(
					t.String({
						format: 'uri',
						default: requireEnv('DEFAULT_REDIRECT_URL'),
					}),
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
