import { cache, db } from '@api/env';
import { bill, Language } from '@api/schema';
import { UNPAID_KEY } from '@api/utils/billing';
import { requireEnv } from '@api/utils/env';
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
							unit_price: Number(b.amount) * (await getUsdArsQuote()),
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
		async ({ query }) => {
			if (query.topic !== 'payment') return false;

			const paymentService = new Payment(MP_CLIENT(query.id));
			const payment = await paymentService.get({ id: query.id });

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

			return true;
		},
		{
			detail: { summary: 'Mercado pago callback', hide: true },
			query: tObject({ topic: t.String(), id: t.String() }),
		},
	);
