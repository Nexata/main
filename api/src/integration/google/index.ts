import { Calendar, calendarRouter } from '@api/integration/google/calendar';
import { Drive, driveRouter } from '@api/integration/google/drive';
import { Gmail, gmailRouter } from '@api/integration/google/gmail';
import { Google } from '@api/integration/google/lib';
import { Elysia } from 'elysia';

export const googleRouter = new Elysia({ prefix: '/google' })
	.use(gmailRouter)
	.use(calendarRouter)
	.use(driveRouter);

export { Calendar, Drive, Gmail, Google };
