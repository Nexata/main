import { adminRouter } from '@api/admin';
import { authRouter } from '@api/auth';
import { backofficeRouter } from '@api/backoffice';
import { chatRouter } from '@api/chat';
import { credentialRouter } from '@api/credential';
import { cache, db, IS_PRODUCTION } from '@api/env';
import { userRouter } from '@api/user';
import cors from '@elysiajs/cors';
import openapi, { fromTypes } from '@elysiajs/openapi';
import serverTiming from '@elysiajs/server-timing';
import { Elysia } from 'elysia';
import { helmet } from 'elysia-helmet';
import { logger } from 'elysia-logger';
import { sentry } from 'elysiajs-sentry';

const app = new Elysia({ prefix: '/api' })
	.use(
		IS_PRODUCTION &&
			sentry({
				environment: 'production',
				enableLogs: true,
			}),
	)
	.use(
		!IS_PRODUCTION &&
			openapi({
				path: '/docs',
				references: fromTypes(),
				scalar: {
					defaultOpenAllTags: true,
					expandAllModelSections: true,
					theme: 'elysiajs',
					expandAllResponses: true,
					hideClientButton: true,
					hideDarkModeToggle: true,
					persistAuth: true,
				},
				documentation: {
					info: {
						title: 'Nexata',
						version: '1.0.0',
						description: "Nexata's main API",
						contact: {
							name: 'Nexata',
							url: 'https://nexata.app',
							email: 'support@nexata.app',
						},
						license: {
							name: 'Attribution-NonCommercial-NoDerivatives 4.0 International',
							url: 'https://creativecommons.org/licenses/by-nc-nd/4.0',
						},
					},
				},
			}),
	)
	.use(helmet())
	.use(serverTiming())
	.use(cors())
	.use(logger({ level: IS_PRODUCTION ? 'warn' : 'debug', logDetails: true }))
	.use(backofficeRouter)
	.use(authRouter)
	.use(adminRouter)
	.use(userRouter)
	.use(credentialRouter)
	.use(chatRouter)
	.get(
		'/',
		async () => ({
			timestamp: new Date().toISOString(),
			dbResponse: JSON.stringify(await db.execute('SELECT true')),
			cacheResponse: (await cache.exec(['PING'])) as 'PONG',
		}),
		{ detail: { summary: 'Health check' } },
	)
	.listen(process.env.PORT ?? 3000);

export type App = typeof app;
