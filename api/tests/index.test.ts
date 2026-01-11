import { describe, expect, it } from 'bun:test';
import { app } from '@api';
import { treaty } from '@elysiajs/eden';

export const { api } = treaty(app);

describe('Health', () => {
	it('Returns a valid response', async () => {
		const res = await api.get();
		expect(res.status).toBe(200);
	});
});
