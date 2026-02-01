import type { App } from '@api';
import { edenTreaty } from '@elysiajs/eden';
import {
	clearTokens,
	getAccessToken,
	getRefreshToken,
	saveTokens,
} from '@/lib/auth';
import { getFingerprint } from '@/lib/fingerprint';

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";

export const apiClient = edenTreaty<App>(API_BASE_URL);

export async function refreshAccessToken() {
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

	return data.accessToken;
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

	const headers = await makeHeaders();
	let result = await request(headers);

	if (!result.error && result.data) return result.data;

	if (result.error?.status !== 401) throw result.error;

	await refreshAccessToken();
	try {
		await refreshAccessToken();
	} catch (err) {
		clearTokens();
		throw err;
	}
	const refheaders = await makeHeaders();
	result = await request(refheaders);

	if (result.error) throw result.error;

	if (!result.data) throw new Error('No data returned');

	return result.data;
}
