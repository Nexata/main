import { cache, db } from '@api/env';
import { Language, tenant, user } from '@api/schema';
import { requireEnv } from '@api/utils/env';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { sendTemplateMail, Template } from '@api/utils/mail';
import { isSlugAvailable, resolveSlug } from '@api/utils/tenant';
import { Nullish, tObject } from '@api/utils/type';
import { Elysia, redirect, type Static, t } from 'elysia';

const CREATION_CACHE_KEY = (requestId: string) =>
	`tenant-creation:${requestId}`;

const tenantCreationRequest = tObject({
	displayName: t.String({ minLength: 1, maxLength: 64 }),
	slug: Nullish(
		t.String({
			minLength: 2,
			pattern: '^[a-z0-9]{2,16}$',
		}),
	),
	redirect: Nullish(t.String({ format: 'uri' })),
	email: t.String({ format: 'email' }),
});

type TenantCreationRequest = Static<typeof tenantCreationRequest>;

export const tenantRouter = new Elysia({ prefix: '/tenant' })
	.get('/slug-available', ({ query }) => isSlugAvailable(query.slug), {
		detail: { summary: 'Check slug availability' },
		query: tObject({
			slug: t.String({ minLength: 2, pattern: '^[a-z0-9]{2,16}$' }),
		}),
	})
	.post(
		'/',
		async ({ body, headers }) => {
			const language = (headers.language ?? Language.EN) as Language;

			const request: TenantCreationRequest = {
				displayName: body.displayName,
				slug: await resolveSlug(body.slug, body.displayName, language),
				redirect: body.redirect ?? null,
				email: body.email,
			};

			const requestId = crypto.randomUUID().replaceAll('-', '').toUpperCase();

			await Promise.all([
				cache.set(CREATION_CACHE_KEY(requestId), request, { ex: 60 * 60 }),
				sendTemplateMail({
					to: body.email,
					template: Template.TENANT_CREATION,
					data: {
						confirmUrl: `${requireEnv('DEPLOYMENT_URL')}/public/tenant/${requestId}`,
					},
					language,
				}),
			]);

			return requestId;
		},
		{
			detail: { summary: 'Request tenant creation' },
			body: tenantCreationRequest,
		},
	)
	.post(
		'/:requestId',
		async ({ params, headers }) => {
			const language = (headers.language ?? Language.EN) as Language;

			const req = await cache.getdel<TenantCreationRequest>(
				CREATION_CACHE_KEY(params.requestId),
			);
			if (!req)
				throw httpError(
					HttpCode.NOT_FOUND,
					ErrorCode.TENANT_CREATION_EXPIRED,
					language,
				);

			const slug = await resolveSlug(req.slug, req.displayName, language);

			await db.batch([
				db.insert(tenant).values({ slug, displayName: req.displayName }),
				db.insert(user).values({ email: req.email, slug, isAdmin: true }),
			]);

			return req.redirect ? redirect(req.redirect) : true;
		},
		{
			detail: { summary: 'Confirm tenant creation' },
			params: tObject({ requestId: t.String({ format: 'uuid' }) }),
		},
	);
