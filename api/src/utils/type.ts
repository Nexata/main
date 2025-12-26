import type { SchemaOptions } from '@sinclair/typebox';
import { type TSchema, t } from 'elysia';

export const Nullish = <T extends TSchema>(
	type: T,
	options?: SchemaOptions,
	nullOptions?: SchemaOptions,
) => t.Optional(t.Union([type, t.Null(nullOptions)], options));

export const tObject = <T extends Record<string, TSchema>>(schema: T) =>
	t.Object(schema, { additionalProperties: false });
