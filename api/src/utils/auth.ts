import { IS_PRODUCTION, NEXATA_SECRET } from '@api/env';
import { user } from '@api/schema';
import { tObject } from '@api/utils/type';
import { jwt } from '@elysiajs/jwt';
import { createSelectSchema } from 'drizzle-typebox';
import { Elysia, type Static, t } from 'elysia';

export const jwtPayload = createSelectSchema(user, {
	apiKey: t.Union([t.Never(), t.Null(), t.Undefined()]),
});

export type JwtPayload = Static<typeof jwtPayload>;

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
			schema: tObject({ id: t.String() }),
		}),
	);
