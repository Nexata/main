import { apiClient, withAuthRetry } from '@/api';

export async function listCredentials() {
	return await withAuthRetry((headers) =>
		apiClient.credential.get({
			$headers: headers,
		}),
	);
}

export type Credential = Awaited<ReturnType<typeof listCredentials>>;

export async function updateCredentialPermission(data: {
	credentialId: string;
	userId: string;
	isAdmin: boolean;
}): Promise<void> {
	await withAuthRetry((headers) =>
		apiClient.credential.permission.put({
			$headers: {
				...headers,
			},
			credentialId: data.credentialId,
			userId: data.userId,
			isAdmin: data.isAdmin,
		}),
	);
}

export async function deleteCredentialPermission(data: {
	credentialId: string;
	userId: string;
}): Promise<void> {
	await withAuthRetry((headers) =>
		apiClient.credential.permission.delete({
			$headers: {
				...headers,
			},
			credentialId: data.credentialId,
			userId: data.userId,
		}),
	);
}

export async function deleteCredentialById(
	credentialId: string,
): Promise<void> {
	await withAuthRetry((headers) =>
		apiClient.credential[credentialId]!.delete({
			$headers: headers,
		}),
	);
}
