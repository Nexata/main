import type { App } from "@api";
import { edenTreaty } from "@elysiajs/eden";
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "@/lib/auth";

export const apiClient = edenTreaty<App>("http://localhost:3000");

export async function refreshAccessToken() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new Error("No refresh token");

    const response = await fetch("http://localhost:3000/api/auth/refresh-token", {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: refreshToken }),
    });

    if (!response.ok) {
        clearTokens();
        throw new Error("Refresh token inválido");
    }

    const data = await response.json();
    saveTokens(data.accessToken, data.refreshToken);

    return data.accessToken;
}

type AuthHeaders = {
  authorization: `Bearer ${string}`;
};

export async function withAuthRetry<T>(
  request: (headers: AuthHeaders) => Promise<{ data?: T; error?: any }>
): Promise<T> {
    const makeHeaders = (): AuthHeaders => {
        const token = getAccessToken();
        if (!token) throw new Error("No access token");

        return { authorization: `Bearer ${token}` };
    };

    let result = await request(makeHeaders());

    if (!result?.error) return result.data as T;

    if (result.error.status !== 401) throw result.error;

    await refreshAccessToken();
    result = await request(makeHeaders());

    if (result?.error) throw result.error;

    return result.data as T;
}

