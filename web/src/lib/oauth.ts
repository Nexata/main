import { API_BASE_URL } from '@/api';
import { getFingerprint } from './fingerprint';
import { getMe } from './user';

const TENANT = 'acme';
const FLOW = 'login';
const FRONTEND_CALLBACK = `${import.meta.env.VITE_FRONT_URL}/callback`;
const FRONTEND_CREDENTIAL_CALLBACK = `${import.meta.env.VITE_FRONT_URL}/credential-callback`;

export async function getGoogleLoginUrl() {
	const fingerprint = await getFingerprint();

	return `${API_BASE_URL}/auth/google/login?flow=${FLOW}&tenant=${TENANT}&fingerprint=${fingerprint}&redirect=${encodeURIComponent(
		FRONTEND_CALLBACK,
	)}`;
}

export async function getDropboxLoginUrl() {
	const fingerprint = await getFingerprint();

	return `${API_BASE_URL}/auth/dropbox/login?flow=${FLOW}&tenant=${TENANT}&fingerprint=${fingerprint}&redirect=${encodeURIComponent(
		FRONTEND_CALLBACK,
	)}`;
}

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
