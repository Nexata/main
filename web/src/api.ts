import type { App } from '@api';
import { edenTreaty } from '@elysiajs/eden';

export const { api } = edenTreaty<App>('http://localhost:3000');

api.admin.user.get({ $headers: { authorization: `Bearer mi-token` } });
