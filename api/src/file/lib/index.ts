import { EMBEDDING_MODEL } from '@api/env';
import { excelToChunks } from '@api/file/lib/excel';
import { imgToChunks } from '@api/file/lib/image';
import { officeToChunks } from '@api/file/lib/office';
import { pdfToChunks } from '@api/file/lib/pdf';
import { mdToChunks, textToChunks } from '@api/file/lib/text';
import {
	type FileLike,
	SupportedMime,
	type ToStringChunksResult,
} from '@api/file/lib/types';
import { docToChunks } from '@api/file/lib/word';
import type { chunk } from '@api/schema';
import { embedMany } from 'ai';
import { HttpError } from 'elysia-logger';

export async function toStringChunks(f: FileLike, type: string, meta?: object) {
	const fixedMimeType = Object.values(SupportedMime).find((mime) =>
		type.startsWith(mime),
	);

	if (!fixedMimeType)
		throw HttpError.UnprocessableEntity(`UNSUPPORTED_MIME_TYPE: ${type}`);

	return (
		{
			[SupportedMime.MD]: mdToChunks,
			[SupportedMime.TEXT]: textToChunks,
			[SupportedMime.IMG]: imgToChunks,
			[SupportedMime.PDF]: pdfToChunks,
			[SupportedMime.JSON]: textToChunks,
			[SupportedMime.XLSX]: excelToChunks,
			[SupportedMime.XLS]: excelToChunks,
			[SupportedMime.DOCX]: docToChunks,
			[SupportedMime.DOC]: docToChunks,
			[SupportedMime.RTF]: officeToChunks,
			[SupportedMime.ODT]: officeToChunks,
			[SupportedMime.ODS]: officeToChunks,
			[SupportedMime.ODP]: officeToChunks,
			[SupportedMime.PPTX]: officeToChunks,
		} as Record<
			SupportedMime,
			(f: FileLike, meta?: object) => Promise<ToStringChunksResult>
		>
	)[fixedMimeType](f, meta);
}

export async function stringToChunks(
	fileId: string,
	chunks: { text: string; metadata: object }[],
): Promise<[(typeof chunk.$inferInsert)[], number]> {
	const res = await embedMany({
		model: EMBEDDING_MODEL,
		values: chunks.map((c) => c.text),
	});
	return [
		chunks.map(({ text, metadata }, i) => ({
			fileId,
			text,
			metadata,
			order: i + 1,
			embedding: res.embeddings[i]!,
		})),
		res.usage.tokens,
	];
}
