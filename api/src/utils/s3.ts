import { requireEnv } from '@api/utils/env';
import { s3 } from 'bun';

export const S3_ACCESS_URL = requireEnv('S3_ACCESS_URL');

export async function uploadUserPfp(slug: string, id: string, f: File) {
	const key = `t/${slug}/u/${id}`;
	await s3.write(key, f, { acl: 'public-read', type: f.type });
	return `${S3_ACCESS_URL}/${key}`;
}

export async function uploadTenantPfp(slug: string, f: File) {
	const key = `t/${slug}/logo`;
	await s3.write(key, f, { acl: 'public-read', type: f.type });
	return `${S3_ACCESS_URL}/${key}`;
}

export async function uploadFile(slug: string, id: string, f: File) {
	const key = `t/${slug}/f/${id}`;
	await s3.write(key, f, { acl: 'public-read', type: f.type });
	return `${S3_ACCESS_URL}/${key}`;
}

export async function deleteTenantData(slug: string) {
	const prefix = `t/${slug}/`;
	let startAfter: string | undefined;
	let hasMore = true;

	while (hasMore) {
		const result = await s3.list({ prefix, startAfter });
		if (!result.contents?.length) break;

		await Promise.allSettled(result.contents.map((obj) => s3.delete(obj.key)));

		if (result.isTruncated) {
			startAfter = result.contents[result.contents.length - 1]!.key;
		} else {
			hasMore = false;
		}
	}
}
