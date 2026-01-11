import { authPlugin } from '@api/auth';
import { getMessageCount } from '@api/utils/chat';
import { Elysia } from 'elysia';

export const billingRouter = new Elysia({ prefix: '/billing' })
	.use(authPlugin(true))
	.get(
		'/messages',
		async ({ activeUser }) => getMessageCount(activeUser.slug),
		{ detail: { summary: 'Read messages consumption' } },
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
