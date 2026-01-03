import { requireEnv } from '@api/utils/env';
import { s3 } from 'bun';

export const S3_ACCESS_URL = requireEnv('S3_ACCESS_URL');

export async function uploadUserPfp(id: string, f: File) {
	await s3.write(`u/${id}`, f, { acl: 'public-read', type: f.type });
	return `${S3_ACCESS_URL}/u/${id}`;
}

export async function uploadTenantPfp(slug: string, f: File) {
	await s3.write(`t/${slug}`, f, { acl: 'public-read', type: f.type });
	return `${S3_ACCESS_URL}/t/${slug}`;
}

export async function uploadFile(id: string, f: File) {
	await s3.write(id, f, { acl: 'public-read', type: f.type });
	return `${S3_ACCESS_URL}/${id}`;
}
