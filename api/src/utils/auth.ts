import { IS_PRODUCTION, NEXATA_SECRET } from '@api/env';
import { user } from '@api/schema';
import { jwt } from '@elysiajs/jwt';
import { createSelectSchema } from 'drizzle-typebox';
import { Elysia, type Static, t } from 'elysia';

const jwtPayload = t.Object({
	id: t.String({ format: 'uuid' }),
	slug: t.String(),
});

export type JwtPayload = Static<typeof jwtPayload>;

const activeUserSchema = createSelectSchema(user, {
	apiKey: t.Union([t.Never(), t.Null(), t.Undefined()]),
});

export type ActiveUser = Static<typeof activeUserSchema>;

export const userCacheKey = (slug: string, userId: string) =>
	`user:${slug}:${userId}`;

export const jwtPlugin = new Elysia()
	.use(
		jwt({
			name: 'jwt',
			exp: IS_PRODUCTION ? '12h' : '1y',
			secret: NEXATA_SECRET,
			schema: jwtPayload,
		}),
	)
	.use(
		jwt({
			name: 'refreshJwt',
			exp: '30d',
			secret: `${NEXATA_SECRET}_refresh_${[...NEXATA_SECRET].reverse().join('')}`,
			schema: t.Object({ id: t.String() }),
		}),
	);
