import { db } from '@api/env';
import { providerIngestors } from '@api/integration/lib';
import { credential, externalDir, FileHost, file, user } from '@api/schema';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { Elysia } from 'elysia';

export const filesRouter = new Elysia({ prefix: '/files' }).put(
	'/sync',
	async () => {
		const [dirsToSync, filesToSync] = await Promise.all([
			db
				.select({
					id: externalDir.id,
					externalId: externalDir.externalId,
					credentialId: externalDir.credentialId,
					provider: externalDir.provider,
					userId: credential.userId,
				})
				.from(externalDir)
				.innerJoin(credential, eq(credential.id, externalDir.credentialId))
				.where(eq(externalDir.autoSync, true)),
			db
				.select({
					id: file.id,
					externalId: file.externalId,
					credentialId: file.credentialId,
					provider: file.provider,
					userId: file.userId,
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

		const results = await Promise.allSettled([
			...dirsToSync.map((dir) =>
				providerIngestors[dir.provider]!(dir.userId, dir.credentialId, [
					{ isDir: true, id: dir.externalId },
				]),
			),
			...filesToSync.map((f) =>
				providerIngestors[f.provider]!(f.userId, f.credentialId!, [
					{ isDir: false, id: f.externalId! },
				]),
			),
		]);

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
		detail: {
			summary: 'Sync external files',
			description:
				'Sync for external files. Expected to run cronologically once an hour.',
		},
	},
);
