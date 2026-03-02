import { API_BASE_URL } from '@/api';
import { getMe } from './user';

const FRONTEND_CREDENTIAL_CALLBACK = `${import.meta.env.VITE_FRONT_URL}/credential-callback`;

export async function getGoogleCredentialUrl(scope: string) {
	const user = await getMe();
	return `${API_BASE_URL}/auth/google/?flow=credential&scope=${scope}&userId=${encodeURIComponent(
		user.id,
	)}&redirect=${encodeURIComponent(FRONTEND_CREDENTIAL_CALLBACK)}`;
}

export async function getDropboxCredentialUrl() {
	const user = await getMe();
	return `${API_BASE_URL}/auth/dropbox/?flow=credential&scope=dropbox&userId=${encodeURIComponent(
		user.id,
	)}&redirect=${encodeURIComponent(FRONTEND_CREDENTIAL_CALLBACK)}`;
}
