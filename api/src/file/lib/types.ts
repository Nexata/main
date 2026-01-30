import { EMBEDDING_OVERLAP, EMBEDDING_SIZE } from '@api/env';
import {
	MarkdownTextSplitter,
	RecursiveCharacterTextSplitter,
} from '@langchain/textsplitters';

export enum SupportedMime {
	MD = 'text/markdown',
	TEXT = 'text/',
	IMG = 'image/',
	PDF = 'application/pdf',
	JSON = 'application/json',
	XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	XLS = 'application/vnd.ms-excel',
	DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	DOC = 'application/msword',
	RTF = 'application/rtf',
	ODT = 'application/vnd.oasis.opendocument.text',
	ODS = 'application/vnd.oasis.opendocument.spreadsheet',
	ODP = 'application/vnd.oasis.opendocument.presentation',
	PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

const EXT_TO_MIME: Record<string, string> = {
	md: SupportedMime.MD,
	txt: 'text/plain',
	json: SupportedMime.JSON,
	pdf: SupportedMime.PDF,
	xlsx: SupportedMime.XLSX,
	xls: SupportedMime.XLS,
	docx: SupportedMime.DOCX,
	doc: SupportedMime.DOC,
	rtf: SupportedMime.RTF,
	odt: SupportedMime.ODT,
	ods: SupportedMime.ODS,
	odp: SupportedMime.ODP,
	pptx: SupportedMime.PPTX,
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	svg: 'image/svg+xml',
};

export function getMimeTypeFromExt(filename: string): string {
	const ext = filename.split('.').pop()?.toLowerCase() ?? '';
	return EXT_TO_MIME[ext] ?? 'unsupported';
}

export type FileLike =
	| ArrayBuffer
	| Int8Array
	| Uint8Array
	| Uint8ClampedArray
	| Int16Array
	| Uint16Array
	| Int32Array
	| Uint32Array
	| Float32Array
	| Float64Array;

export type ToStringChunksResult = {
	metadata?: object;
	chunks: { text: string; metadata?: object }[];
	tokenUsage?: number;
};

export const splitter = new RecursiveCharacterTextSplitter({
	chunkSize: EMBEDDING_SIZE,
	chunkOverlap: EMBEDDING_OVERLAP,
});

export const mdSplitter = new MarkdownTextSplitter({
	chunkSize: EMBEDDING_SIZE,
	chunkOverlap: EMBEDDING_OVERLAP,
});
