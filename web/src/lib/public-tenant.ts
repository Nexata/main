import { apiClient } from '@/api';
import type { Language } from '@/lib/user';

export async function checkSlugAvailable(slug: string): Promise<boolean> {
	const result = await apiClient.public.tenant['slug-available'].get({
		$query: { slug },
	});

	if (result.error) throw result.error;
	return result.data ?? false;
}

export type CreateTenantInput = {
	displayName: string;
	email: string;
	slug?: string | null;
	language?: Language;
};

export async function requestTenantCreation(
	input: CreateTenantInput,
): Promise<boolean> {
	const result = await apiClient.public.tenant.post({
		displayName: input.displayName,
		email: input.email,
		slug: input.slug ?? null,
		redirect: null,
		$headers: {
			language: input.language ?? 'es',
		},
	});

	if (result.error) throw result.error;
	return result.data === true;
}
