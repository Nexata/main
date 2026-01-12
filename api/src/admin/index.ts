import { billingRouter } from '@api/admin/billing';
import { tenantRouter } from '@api/admin/tenant';
import { traceRouter } from '@api/admin/trace';
import { userRouter } from '@api/admin/user';
import { authPlugin } from '@api/auth';
import { Elysia } from 'elysia';

export const adminRouter = new Elysia({ prefix: '/admin', tags: ['Admin'] })
	.use(authPlugin(true))
	.use(billingRouter)
	.use(userRouter)
	.use(tenantRouter)
	.use(traceRouter);
