import type { Column, GetColumnData, SQL } from 'drizzle-orm';
import { eq, sql } from 'drizzle-orm';
import {
	type AnyPgColumn,
	type AnyPgSelect,
	index,
	uniqueIndex,
} from 'drizzle-orm/pg-core';

export type TSQLObject<T = unknown> = Column | SQL<T> | SQL.Aliased<T>;

export type InferSQLType<TObj extends TSQLObject | TSQLObject[]> =
	TObj extends Column
		? GetColumnData<TObj>
		: TObj extends SQL.Aliased<infer InferredAliasedT>
			? InferredAliasedT
			: TObj extends SQL<infer InferredT>
				? InferredT
				: never;

export const sqlRegex = (rgx: RegExp) => sql.raw(`'${rgx.source}'`);

export const matchRegex = (v: TSQLObject, rgx: RegExp, isNullable = false) =>
	isNullable
		? sql<boolean>`${v} IS NULL OR ${v} ~ ${sqlRegex(rgx)}`
		: sql<boolean>`${v} ~ ${sqlRegex(rgx)}`;

export const lower = (col: AnyPgColumn) => sql<string>`lower(${col})`;

export function lowerIndex(col: AnyPgColumn, unique = true) {
	const query: SQL = lower(col);
	const name = unique
		? `${col.uniqueName}_lower`
		: col.uniqueName?.replace('unique', 'lower');
	return unique ? uniqueIndex(name).on(query) : index(name).on(query);
}

export function lowerEq(col: AnyPgColumn, str: string) {
	return eq(lower(col), str.toLowerCase());
}

export const sqlArray = <T extends unknown[]>(x: T, parseTo?: string) => {
	const chunks = x.map((v) => sql`${v}`);
	const q = sql<T>`ARRAY[${sql.join(chunks, sql.raw(','))}]`;
	if (parseTo) q.append(sql`::${sql.raw(parseTo)}[]`);
	return q;
};

export function jsonBuildObject<TObj extends Record<string, TSQLObject>>(
	obj: TObj,
) {
	const chunks = Object.keys(obj).map((k) => sql`'${sql.raw(k)}', ${obj[k]}`);
	return sql<{
		[K in keyof TObj]: InferSQLType<TObj[K]>;
	}>`json_build_object(${sql.join(chunks, sql.raw(', '))})`;
}

export function jsonAgg<T>(query: SQL<T>, filterWhere?: TSQLObject) {
	const q = sql`json_agg(${query})`;
	if (filterWhere) q.append(sql` filter (where ${filterWhere})`);
	return q as SQL<T[]>;
}

export function arrayAgg<T extends TSQLObject>(query: T) {
	return sql<InferSQLType<T>[]>`array_remove(array_agg(${query}), NULL)`;
}

export function sqlCase<T>(
	elseValue: TSQLObject<T> | T,
	...whenThens: SQL<T>[]
) {
	const q = sql<
		T extends TSQLObject ? InferSQLType<T> : T
	>`case ${sql.join(whenThens, sql.raw(' '))}`;
	if (elseValue) q.append(sql` else ${elseValue} end`);
	else q.append(sql` end`);
	return q;
}

export function whenThen<T>(whenQuery: SQL, thenQuery: TSQLObject<T> | T) {
	return sql<
		T extends TSQLObject ? InferSQLType<T> : T
	>`when ${whenQuery} then ${thenQuery}`;
}

export function caseWhenNull<T>(col: Column, query: TSQLObject<T> | T) {
	return sql<
		T extends TSQLObject ? InferSQLType<T> : T | null
	>`case when ${col} is not null then ${query} else null end`;
}

export function sq<T extends AnyPgSelect>(query: T) {
	return (query.shouldOmitSQLParens ? !query.shouldOmitSQLParens() : false)
		? query.getSQL()
		: sql<T>`(${query})`;
}
