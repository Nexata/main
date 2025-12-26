import { billingRouter } from '@api/backoffice/billing';
import { credentialsRouter } from '@api/backoffice/credentials';
import { filesRouter } from '@api/backoffice/files';
import { tenantRouter } from '@api/backoffice/tenant';
import { IS_PRODUCTION, NEXATA_SECRET } from '@api/env';
import { tObject } from '@api/utils/type';
import Elysia, { t } from 'elysia';
import { HttpError } from 'elysia-logger';

export const backofficeRouter = new Elysia({
	prefix: '/backoffice',
	tags: ['Backoffice'],
})
	.guard({ headers: tObject({ authorization: t.String() }) })
	.derive(({ headers: { authorization } }) => {
		if (IS_PRODUCTION && authorization !== NEXATA_SECRET)
			throw HttpError.NotFound();
	})
	.use(tenantRouter)
	.use(billingRouter)
	.use(credentialsRouter)
	.use(filesRouter);
