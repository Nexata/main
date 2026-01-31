import { Calendar, calendarRouter } from '@api/integration/google/calendar';
import { Gmail, gmailRouter } from '@api/integration/google/gmail';
import { Google } from '@api/integration/google/lib';
import { Elysia } from 'elysia';

export const googleRouter = new Elysia({ prefix: '/google' })
	.use(gmailRouter)
	.use(calendarRouter);

export { Calendar, Gmail, Google };
