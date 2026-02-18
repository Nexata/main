import { billingRouter } from '@api/backoffice/billing';
import { credentialsRouter } from '@api/backoffice/credentials';
import { feedbackRouter } from '@api/backoffice/feedback';
import { filesRouter } from '@api/backoffice/files';
import { IS_PRODUCTION, NEXATA_SECRET } from '@api/env';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { tObject } from '@api/utils/type';
import { Elysia, t } from 'elysia';

export const backofficeRouter = new Elysia({
	prefix: '/backoffice',
	tags: ['Backoffice'],
})
	.guard({ headers: tObject({ authorization: t.String() }) })
	.derive(({ headers: { authorization } }) => {
		if (IS_PRODUCTION && authorization !== NEXATA_SECRET)
			throw httpError(HttpCode.NOT_FOUND, ErrorCode.UNAUTHORIZED_BACKOFFICE);
	})
	.use(billingRouter)
	.use(credentialsRouter)
	.use(filesRouter)
	.use(feedbackRouter);
