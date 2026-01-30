import { getFingerprint } from './fingerprint';
import { getMe } from './user';

const API_URL = 'http://localhost:3000';
const TENANT = 'acme';
const FLOW = 'login';
const FRONTEND_CALLBACK = 'http://localhost:5173/callback';
const FRONTEND_CREDENTIAL_CALLBACK =
	'http://localhost:5173/credential-callback';

export async function getGoogleLoginUrl() {
	const fingerprint = await getFingerprint();

	return `${API_URL}/api/auth/google/login?flow=${FLOW}&tenant=${TENANT}&fingerprint=${fingerprint}&redirect=${encodeURIComponent(
		FRONTEND_CALLBACK,
	)}`;
}

export async function getDropboxLoginUrl() {
	const fingerprint = await getFingerprint();

	return `${API_URL}/api/auth/dropbox/login?flow=${FLOW}&tenant=${TENANT}&fingerprint=${fingerprint}&redirect=${encodeURIComponent(
		FRONTEND_CALLBACK,
	)}`;
}

export async function getGoogleCredentialUrl(scope: string) {
	const user = await getMe();
	return `${API_URL}/api/auth/google/?flow=credential&scope=${scope}&userId=${encodeURIComponent(
		user.id,
	)}&redirect=${encodeURIComponent(FRONTEND_CREDENTIAL_CALLBACK)}`;
}

export async function getDropboxCredentialUrl() {
	const user = await getMe();
	return `${API_URL}/api/auth/dropbox/?flow=credential&scope=dropbox&userId=${encodeURIComponent(
		user.id,
	)}&redirect=${encodeURIComponent(FRONTEND_CREDENTIAL_CALLBACK)}`;
}
