import { createHmac } from 'node:crypto';
import { cache, db } from '@api/env';
import {
	BillableEventType,
	BillSource,
	bill,
	billableEvent,
	Language,
	tenant,
	user,
} from '@api/schema';
import { REFILL_KEY, UNPAID_KEY } from '@api/utils/billing';
import { requireEnv } from '@api/utils/env';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { sendTemplateMail, Template } from '@api/utils/mail';
import { getUsdArsQuote } from '@api/utils/quote';
import { Nullish, tObject } from '@api/utils/type';
import { captureException } from '@sentry/bun';
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

			const unit_price = Number(b.amount) * (await getUsdArsQuote());

			const description =
				b.source === BillSource.REFILL
					? `Nexata refill (x${(b.details as { messages: number }).messages})`
					: `Nexata ${formatPlan(b.plan)}${b.months > 1 ? ` (${b.months} months)` : ''}`;

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
							description,
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
					.returning({
						slug: bill.slug,
						createdAt: bill.createdAt,
						source: bill.source,
						months: bill.months,
						details: bill.details,
					})
			).at(0);

			if (!updated)
				throw httpError(HttpCode.NOT_FOUND, ErrorCode.BILL_NOT_FOUND);

			if (updated.source === BillSource.REFILL) {
				const details = updated.details as { messages: number };
				await Promise.all([
					db.insert(billableEvent).values({
						type: BillableEventType.REFILL,
						slug: updated.slug,
						consumption: details.messages.toString(),
					}),
					cache.del(REFILL_KEY(updated.slug)),
				]);
			} else {
				const billDate = dayjs(updated.createdAt);
				const isLatePayment = dayjs().diff(billDate, 'day') > 4;
				const newBillingAt = (isLatePayment ? dayjs() : billDate).add(
					updated.months,
					'month',
				);

				await Promise.all([
					db
						.update(tenant)
						.set({ billingAt: newBillingAt.toDate() })
						.where(eq(tenant.slug, updated.slug)),
					cache.del(UNPAID_KEY(updated.slug)),
				]);
			}

			const [tenantInfo, admins] = await Promise.all([
				db
					.select({ displayName: tenant.displayName, logoUrl: tenant.logoUrl })
					.from(tenant)
					.where(eq(tenant.slug, updated.slug))
					.then((r) => r.at(0)),
				db
					.select({
						email: user.email,
						displayName: user.displayName,
						language: user.language,
					})
					.from(user)
					.where(and(eq(user.slug, updated.slug), eq(user.isAdmin, true))),
			]);

			if (tenantInfo && admins.length) {
				const isRefill = updated.source === BillSource.REFILL;
				Promise.allSettled(
					admins.map((admin) =>
						sendTemplateMail({
							to: admin.email,
							template: Template.BILL_PAID,
							data: {
								displayName: admin.displayName ?? admin.email,
								tenantDisplayName: tenantInfo.displayName ?? updated.slug,
								logoUrl: tenantInfo.logoUrl,
								isRefill,
								messages: isRefill
									? (updated.details as { messages: number }).messages
									: undefined,
							},
							language: admin.language as Language,
						}),
					),
				).catch((error) => captureException(error));
			}
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
