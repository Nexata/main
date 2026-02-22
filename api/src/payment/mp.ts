import { createHmac } from 'node:crypto';
import { cache, db } from '@api/env';
import { bill, Language } from '@api/schema';
import { UNPAID_KEY } from '@api/utils/billing';
import { log, requireEnv } from '@api/utils/env';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { getUsdArsQuote } from '@api/utils/quote';
import { Nullish, tObject } from '@api/utils/type';
import dayjs from 'dayjs';
import { and, eq } from 'drizzle-orm';
import Elysia, { t } from 'elysia';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';

const MP_CLIENT = (idempotencyKey: string) =>
	new MercadoPagoConfig({
		accessToken: requireEnv('MP_ACCESS_TOKEN'),
		options: { idempotencyKey },
	});

const formatPlan = (plan: string) =>
	plan.charAt(0).toUpperCase() + plan.slice(1).replaceAll('_', ' ');

export const mpRouter = new Elysia({ prefix: '/mp' })
	.guard({
		headers: t.Object({
			language: Nullish(t.Enum(Language), {
				default: Language.EN,
				description: 'Preferred language for responses',
			}),
		}),
	})
	.get(
		'/:billId',
		async ({ params: { billId }, query, headers }) => {
			const language = (headers.language ?? Language.EN) as Language;
			const b = (await db.select().from(bill).where(eq(bill.id, billId))).at(0);

			if (!b)
				throw httpError(HttpCode.NOT_FOUND, ErrorCode.BILL_NOT_FOUND, language);

			const unit_price = 100; // FIXME: Intentional value for testing now.
			// Actual value = Number(b.amount) * (await getUsdArsQuote());

			const preferenceService = new Preference(MP_CLIENT(billId));
			const preference = await preferenceService.create({
				body: {
					statement_descriptor: 'Nexata',
					back_urls: {
						success: query.redirect ?? requireEnv('DEFAULT_REDIRECT_URL'),
						failure: query.redirect ?? requireEnv('DEFAULT_REDIRECT_URL'),
					},
					binary_mode: true,
					expires: false,
					additional_info: dayjs().format('YYYY-MM-DD'),
					external_reference: billId,
					metadata: { billId },
					notification_url: `${requireEnv('DEPLOYMENT_URL')}/payment/mp/callback`,
					items: [
						{
							id: billId,
							title: 'Nexata',
							description: `Nexata ${formatPlan(b.plan)}`,
							picture_url: 'https://files.nexata.app/logo.png',
							quantity: 1,
							unit_price,
							currency_id: 'ARS',
						},
						{
							id: `${billId}-fee`,
							title: 'Transaction fee',
							description: 'Mercado Pago transaction fee (5%)',
							quantity: 1,
							unit_price: unit_price * 0.05,
							currency_id: 'ARS',
						},
					],
				},
			});

			return preference;
		},
		{
			detail: { summary: 'Get mercado pago payment' },
			params: tObject({ billId: t.String({ format: 'uuid' }) }),
			query: tObject({ redirect: Nullish(t.String({ format: 'uri' })) }),
		},
	)
	.post(
		'/callback',
		async ({ query, body, headers }) => {
			const dataId = query['data.id'];
			const type = query.type ?? body.type;

			if (type !== 'payment' && type !== 'order') return;

			const xSignature = headers['x-signature'];
			const xRequestId = headers['x-request-id'];
			if (xSignature && xRequestId) {
				const parts = Object.fromEntries(
					xSignature.split(',').map((p) => p.split('=', 2) as [string, string]),
				);
				const manifest = `id:${dataId};request-id:${xRequestId};ts:${parts.ts};`;
				const hmac = createHmac('sha256', requireEnv('MP_WEBHOOK_KEY'))
					.update(manifest)
					.digest('hex');

				if (hmac !== parts.v1)
					throw httpError(HttpCode.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS);
			}

			const paymentId = body.data?.id ?? dataId;
			const paymentService = new Payment(MP_CLIENT(paymentId));
			const payment = await paymentService.get({ id: paymentId });

			if (payment.status !== 'approved' || !payment.external_reference)
				throw httpError(HttpCode.CONFLICT, ErrorCode.EXTERNAL_ERROR);

			const updated = (
				await db
					.update(bill)
					.set({ paid: true })
					.where(
						and(eq(bill.id, payment.external_reference), eq(bill.paid, false)),
					)
					.returning({ slug: bill.slug })
			).at(0);

			if (!updated)
				throw httpError(HttpCode.NOT_FOUND, ErrorCode.BILL_NOT_FOUND);

			await cache.del(UNPAID_KEY(updated.slug));
		},
		{
			detail: { summary: 'Mercado pago callback', hide: true },
			query: tObject({ 'data.id': t.String(), type: Nullish(t.String()) }),
			headers: tObject({
				'x-signature': Nullish(t.String()),
				'x-request-id': Nullish(t.String()),
			}),
			body: t.Object({
				action: t.String(),
				api_version: t.String(),
				data: t.Object({ id: t.String() }),
				date_created: t.String(),
				id: t.Union([t.String(), t.Number()]),
				live_mode: t.Boolean(),
				type: t.String(),
				user_id: t.Union([t.String(), t.Number()]),
			}),
		},
	);
