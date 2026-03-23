import { EMBEDDING_MODEL } from '@api/env';
import { csvToChunks } from '@api/file/lib/csv';
import { excelToChunks } from '@api/file/lib/excel';
import { htmlToChunks } from '@api/file/lib/html';
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
import type { chunk, Language } from '@api/schema';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { embedMany } from 'ai';

const MIME_HANDLERS: Record<
	SupportedMime,
	(f: FileLike, meta?: object) => Promise<ToStringChunksResult>
> = {
	[SupportedMime.TEXT_PLAIN]: textToChunks,
	[SupportedMime.MD]: mdToChunks,
	[SupportedMime.CSV]: csvToChunks,
	[SupportedMime.TSV]: csvToChunks,
	[SupportedMime.HTML]: htmlToChunks,
	[SupportedMime.XML]: textToChunks,
	[SupportedMime.YAML]: textToChunks,
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
	[SupportedMime.PPT]: officeToChunks,
};

function isValidUtf8(f: FileLike): boolean {
	const bytes = new Uint8Array(ArrayBuffer.isView(f) ? f.buffer : f);
	const sample = bytes.slice(0, Math.min(bytes.length, 8192));
	const decoded = new TextDecoder('utf-8', { fatal: true });
	try {
		decoded.decode(sample);
		return true;
	} catch {
		return false;
	}
}

export async function toStringChunks(
	f: FileLike,
	type: string,
	meta?: object,
	language?: Language,
) {
	const fixedMimeType = Object.values(SupportedMime).find((mime) =>
		type.toLowerCase().startsWith(mime.toLowerCase()),
	);

	if (fixedMimeType) return MIME_HANDLERS[fixedMimeType](f, meta);

	if (isValidUtf8(f)) return textToChunks(f);

	throw httpError(
		HttpCode.UNPROCESSABLE_ENTITY,
		ErrorCode.UNSUPPORTED_MIME_TYPE,
		language,
	);
}

export async function stringToChunks(
	fileId: string,
	chunks: ToStringChunksResult['chunks'],
): Promise<[(typeof chunk.$inferInsert)[], number]> {
	if (!chunks.length) return [[], 0];

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
