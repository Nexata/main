import {
	MicrosoftCalendar,
	microsoftCalendarRouter,
} from '@api/integration/microsoft/calendar';
import { Microsoft } from '@api/integration/microsoft/lib';
import { Outlook, outlookRouter } from '@api/integration/microsoft/outlook';
import { Elysia } from 'elysia';

export const microsoftRouter = new Elysia({ prefix: '/microsoft' })
	.use(outlookRouter)
	.use(microsoftCalendarRouter);

export { Microsoft, Outlook, MicrosoftCalendar };
