import { authPlugin } from '@api/auth';
import Elysia from 'elysia';

export const billingRouter = new Elysia({ prefix: '/billing' })
	.use(authPlugin(true))
	.get('/messages', async ({ activeUser }) => {}, {
		detail: { summary: 'Read messages consumption', tags: ['TODO'] },
	})
	.get('/embeds', async ({ activeUser }) => {}, {
		detail: { summary: 'Read embeddings consumption', tags: ['TODO'] },
	})
	.get('/storage', async ({ activeUser }) => {}, {
		detail: { summary: 'Read storage consumption', tags: ['TODO'] },
	})
	.get('/last-bill', async ({ activeUser }) => {}, {
		detail: { summary: 'Read last bill', tags: ['TODO'] },
	});

// payment?
