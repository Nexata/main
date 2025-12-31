import { authPlugin } from '@api/auth';
import { db } from '@api/env';
import { credential } from '@api/schema';
import { tObject } from '@api/utils/type';
import { eq } from 'drizzle-orm';
import Elysia, { t } from 'elysia';

// TODO: file | file-permission | chunk
// Si tiene acceso a la credential, automaticamente tiene acceso a los files vectorizados

export const fileRouter = new Elysia({ prefix: '/file', tags: ['File'] })
	.use(authPlugin())
	.post(
		'/external',
		async ({ body }) => {
			const cred = await db
				.select()
				.from(credential)
				.where(eq(credential.id, body.credentialId));

			return cred;
		},
		{
			detail: { summary: 'Ingest external file' },
			body: tObject({
				credentialId: t.String({ format: 'uuid' }),
				externalId: t.String(),
			}),
		},
	)
	.get('/:id', async () => {}, { detail: { summary: '' } })
	.delete('/', async () => {}, { detail: { summary: '' } })
	.get('/', async () => {}, { detail: { summary: '' } });
