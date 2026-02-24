import { Microsoft } from '@api/integration/microsoft/lib';
import { Outlook, outlookRouter } from '@api/integration/microsoft/outlook';
import {
	OutlookCalendar,
	outlookCalendarRouter,
} from '@api/integration/microsoft/outlook-calendar';
import { Elysia } from 'elysia';

export const microsoftRouter = new Elysia({ prefix: '/microsoft' })
	.use(outlookRouter)
	.use(outlookCalendarRouter);

export { Microsoft, Outlook, OutlookCalendar };
