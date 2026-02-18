import { tenantRouter } from '@api/public/tenant';
import { Language } from '@api/schema';
import { getUsdArsQuote } from '@api/utils/quote';
import { Nullish } from '@api/utils/type';
import { Elysia, t } from 'elysia';

export const publicRouter = new Elysia({ prefix: '/public', tags: ['Public'] })
	.guard({
		headers: t.Object({
			language: Nullish(t.Enum(Language), {
				default: Language.EN,
				description: 'Preferred language for responses',
			}),
		}),
	})
	.use(tenantRouter)
	.get(
		'/usd-ars-quote',
		({ headers }) =>
			getUsdArsQuote((headers.language ?? Language.EN) as Language),
		{ detail: { summary: 'Get current USD-ARS quote' } },
	);
