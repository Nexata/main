import { authPlugin } from '@api/auth';
import { cache, db } from '@api/env';
import { tenant } from '@api/schema';
import { eq } from 'drizzle-orm';
import { Elysia } from 'elysia';

export const billingRouter = new Elysia({ prefix: '/billing' })
	.use(authPlugin(true))
	.get(
		'/messages',
		async ({ activeUser }) => {
			const cached = cache.get<{ limit: number; used: number }>(
				`tenant:${activeUser.slug}:messages`,
			);
			if (cached) return cached;

			const noncached = await db
				.select({ used: tenant.usedMessages, limit: tenant.messageLimit })
				.from(tenant)
				.where(eq(tenant.slug, activeUser.slug));

			await cache.set(`tenant:${activeUser.slug}:messages`, noncached);
			return noncached;
		},
		{
			detail: { summary: 'Read messages consumption' },
		},
	)
	.get('/embeds', async () => {}, {
		detail: { summary: 'Read embeddings consumption', tags: ['TODO'] },
	})
	.get('/storage', async () => {}, {
		detail: { summary: 'Read storage consumption', tags: ['TODO'] },
	})
	.get('/last-bill', async () => {}, {
		detail: { summary: 'Read last bill', tags: ['TODO'] },
	})
	.put('/refill', async () => {}, {
		detail: { summary: 'Refill with messages', tags: ['TODO'] },
	});

// payment?
