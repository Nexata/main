import type { App } from '@api';
import { edenTreaty } from '@elysiajs/eden';
import {
	clearTokens,
	getAccessToken,
	getRefreshToken,
	saveTokens,
} from '@/lib/auth';
import { getFingerprint } from '@/lib/fingerprint';

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

export const apiClient = edenTreaty<App>(API_BASE_URL);

let refreshPromise: Promise<string> | null = null;
let isLoggingOut = false;

export async function refreshAccessToken() {
	if (refreshPromise) return refreshPromise;

	refreshPromise = (async () => {
		try {
			const refreshToken = getRefreshToken();
			if (!refreshToken) throw new Error('No refresh token');

			const fingerprint = await getFingerprint();

			const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					fingerprint,
					'user-agent': navigator.userAgent,
				},
				body: JSON.stringify({ token: refreshToken }),
			});

			if (!response.ok) {
				throw new Error('Refresh token inválido');
			}

			const data = await response.json();
			saveTokens(data.accessToken, data.refreshToken);

			return data.accessToken as string;
		} finally {
			refreshPromise = null;
		}
	})();

	return refreshPromise;
}

type ApiError = {
	status: number;
	message?: string;
};

type AuthHeaders = {
	authorization: `Bearer ${string}`;
	fingerprint: string;
};

export async function withAuthRetry<T>(
	request: (headers: AuthHeaders) => Promise<{
		data: T | null;
		error: ApiError | null;
	}>,
): Promise<T> {
	const makeHeaders = async (): Promise<AuthHeaders> => {
		const token = getAccessToken();
		if (!token) throw new Error('No access token');

		return {
			authorization: `Bearer ${token}`,
			fingerprint: await getFingerprint(),
		};
	};

	const forceLogout = () => {
		if (isLoggingOut) return;
		isLoggingOut = true;
		clearTokens();
		localStorage.clear();
		sessionStorage.clear();
		window.location.href = '/login';
	};

	const headers = await makeHeaders();
	let result = await request(headers);

	if (!result.error && result.data) return result.data;
	if (result.error?.status !== 401) throw result.error;

	try {
		await refreshAccessToken();
	} catch (err) {
		forceLogout();
		throw err;
	}

	const refheaders = await makeHeaders();
	result = await request(refheaders);

	if (result.error?.status === 401) {
		forceLogout();
		throw result.error;
	}

	if (result.error) throw result.error;
	if (!result.data) throw new Error('No data returned');

	return result.data;
}
