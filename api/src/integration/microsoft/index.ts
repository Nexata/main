import {
	MicrosoftCalendar,
	microsoftCalendarRouter,
} from '@api/integration/microsoft/calendar';
import { Microsoft } from '@api/integration/microsoft/lib';
import { OneDrive, oneDriveRouter } from '@api/integration/microsoft/onedrive';
import { Outlook, outlookRouter } from '@api/integration/microsoft/outlook';
import { Elysia } from 'elysia';

export const microsoftRouter = new Elysia({ prefix: '/microsoft' })
	.use(outlookRouter)
	.use(microsoftCalendarRouter)
	.use(oneDriveRouter);

export { Microsoft, Outlook, MicrosoftCalendar, OneDrive };
