import { cache, db } from '@api/env';
import { type IngestResult, providerIngestors } from '@api/integration/lib';
import {
	credential,
	externalDir,
	FileHost,
	file,
	type Language,
	PROVIDER_LABELS,
	user,
} from '@api/schema';
import { requireEnv } from '@api/utils/env';
import { sendTemplateMail, Template } from '@api/utils/mail';
import { Nullish } from '@api/utils/type';
import { and, eq, inArray, isNull, ne } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import pLimit from 'p-limit';

const SYNC_FAIL_CACHE_KEY = (userId: string) => `sync-fail-notified:${userId}`;

const SYNC_FAIL_COOLDOWN = 23 * 60 * 60;
const SYNC_CONCURRENCY = 10;

type SyncItem = {
	externalId: string;
	credentialId: string;
	provider: FileHost;
	name: string;
	userId: string;
	slug: string;
	isDir: boolean;
};

function dedupeSyncItems(items: SyncItem[]) {
	const unique = new Map<string, SyncItem>();

	for (const item of items)
		unique.set(`${item.provider}:${item.isDir}:${item.externalId}`, item);

	return [...unique.values()];
}

type SyncGroup = {
	provider: FileHost;
	userId: string;
	slug: string;
	credentialId: string;
	items: SyncItem[];
};

function groupByCredential(items: SyncItem[]): SyncGroup[] {
	const groups = new Map<string, SyncGroup>();

	for (const item of items) {
		const key = `${item.provider}:${item.userId}:${item.credentialId}`;
		let group = groups.get(key);
		if (!group) {
			group = {
				provider: item.provider,
				userId: item.userId,
				slug: item.slug,
				credentialId: item.credentialId,
				items: [],
			};
			groups.set(key, group);
		}
		group.items.push(item);
	}

	return [...groups.values()];
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
						ne(file.provider, FileHost.LEGAJOX),
					),
				),
		]);

		const allItems = [
			...dirsToSync.map((dir) => ({ ...dir, isDir: true })),
			...filesToSync.map((f) => ({ ...f, isDir: false as const })),
		];

		const dedupedItems = dedupeSyncItems(
			allItems
				.filter(
					(item) =>
						typeof item.externalId === 'string' &&
						typeof item.credentialId === 'string',
				)
				.map((item) => ({
					externalId: item.externalId as string,
					credentialId: item.credentialId as string,
					provider: item.provider,
					name: item.name,
					userId: item.userId,
					slug: item.slug,
					isDir: item.isDir,
				})),
		);

		const groups = groupByCredential(dedupedItems);

		const syncLimit = pLimit(SYNC_CONCURRENCY);
		const groupResults = await Promise.allSettled(
			groups.map((group) =>
				syncLimit(() => {
					const ingestor = providerIngestors[group.provider];
					if (!ingestor)
						return Promise.resolve<IngestResult>({
							ok: 0,
							unmodified: 0,
							failed: group.items.length,
						});

					return ingestor(
						group.userId,
						group.slug,
						group.credentialId,
						group.items.map((item) => ({
							isDir: item.isDir,
							id: item.externalId,
						})),
					);
				}),
			),
		);

		const totals = { ok: 0, unmodified: 0, failed: 0, partial: 0 };
		const failedByUser = new Map<
			string,
			{ name: string; provider: string }[]
		>();

		for (let i = 0; i < groupResults.length; i++) {
			const result = groupResults[i]!;
			const group = groups[i]!;

			if (result.status === 'rejected') {
				totals.failed += group.items.length;
				const existing = failedByUser.get(group.userId) ?? [];
				for (const item of group.items)
					existing.push({
						name: item.name,
						provider: PROVIDER_LABELS[item.provider] ?? item.provider,
					});
				failedByUser.set(group.userId, existing);
				continue;
			}

			const r = result.value;
			totals.ok += r.ok;
			totals.unmodified += r.unmodified;
			totals.failed += r.failed;

			if (r.failed) {
				const existing = failedByUser.get(group.userId) ?? [];
				// When failures < total items, we can't know which specific items failed
				// at the provider level, so we report the group's provider generically
				const providerLabel = PROVIDER_LABELS[group.provider] ?? group.provider;
				if (r.failed >= group.items.length) {
					// All items failed — report each by name
					for (const item of group.items)
						existing.push({ name: item.name, provider: providerLabel });
				} else {
					// Partial failure — report count generically
					for (let j = 0; j < r.failed; j++)
						existing.push({
							name: `${providerLabel} file`,
							provider: providerLabel,
						});
				}
				failedByUser.set(group.userId, existing);
			}
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
			total: totals.ok + totals.unmodified + totals.failed,
			synced: totals.ok,
			unmodified: totals.unmodified,
			partial: totals.partial,
			failed: totals.failed,
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
				'Sync for external files. Expected to run cronologically every 4 hours.',
		},
	},
);
