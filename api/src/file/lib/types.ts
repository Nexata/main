import { EMBEDDING_OVERLAP, EMBEDDING_SIZE } from '@api/env';
import {
	MarkdownTextSplitter,
	RecursiveCharacterTextSplitter,
} from '@langchain/textsplitters';

export enum SupportedMime {
	TEXT_PLAIN = 'text/plain',
	MD = 'text/markdown',
	CSV = 'text/csv',
	TSV = 'text/tab-separated-values',
	HTML = 'text/html',
	XML = 'application/xml',
	YAML = 'application/x-yaml',
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
	PPT = 'application/vnd.ms-powerpoint',
}

const EXT_TO_MIME: Record<string, string> = {
	md: SupportedMime.MD,
	txt: SupportedMime.TEXT_PLAIN,
	csv: SupportedMime.CSV,
	tsv: SupportedMime.TSV,
	html: SupportedMime.HTML,
	htm: SupportedMime.HTML,
	xml: SupportedMime.XML,
	yaml: SupportedMime.YAML,
	yml: SupportedMime.YAML,
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
	ppt: SupportedMime.PPT,
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	svg: 'image/svg+xml',
	py: SupportedMime.TEXT_PLAIN,
	rs: SupportedMime.TEXT_PLAIN,
	go: SupportedMime.TEXT_PLAIN,
	rb: SupportedMime.TEXT_PLAIN,
	java: SupportedMime.TEXT_PLAIN,
	kt: SupportedMime.TEXT_PLAIN,
	swift: SupportedMime.TEXT_PLAIN,
	c: SupportedMime.TEXT_PLAIN,
	cpp: SupportedMime.TEXT_PLAIN,
	h: SupportedMime.TEXT_PLAIN,
	hpp: SupportedMime.TEXT_PLAIN,
	cs: SupportedMime.TEXT_PLAIN,
	ts: SupportedMime.TEXT_PLAIN,
	js: SupportedMime.TEXT_PLAIN,
	tsx: SupportedMime.TEXT_PLAIN,
	jsx: SupportedMime.TEXT_PLAIN,
	vue: SupportedMime.TEXT_PLAIN,
	svelte: SupportedMime.TEXT_PLAIN,
	sql: SupportedMime.TEXT_PLAIN,
	sh: SupportedMime.TEXT_PLAIN,
	bash: SupportedMime.TEXT_PLAIN,
	zsh: SupportedMime.TEXT_PLAIN,
	ps1: SupportedMime.TEXT_PLAIN,
	toml: SupportedMime.TEXT_PLAIN,
	ini: SupportedMime.TEXT_PLAIN,
	cfg: SupportedMime.TEXT_PLAIN,
	env: SupportedMime.TEXT_PLAIN,
	log: SupportedMime.TEXT_PLAIN,
	css: SupportedMime.TEXT_PLAIN,
	scss: SupportedMime.TEXT_PLAIN,
	less: SupportedMime.TEXT_PLAIN,
	graphql: SupportedMime.TEXT_PLAIN,
};

export function getMimeTypeFromExt(filename: string): string {
	const ext = filename.split('.').pop()?.toLowerCase() ?? '';
	return EXT_TO_MIME[ext] ?? 'unsupported';
}

export function isSupportedExt(filename: string): boolean {
	const ext = filename.split('.').pop()?.toLowerCase() ?? '';
	return ext in EXT_TO_MIME;
}

export enum FileCategory {
	TEXT = 'TEXT',
	PDF = 'PDF',
	DOCUMENT = 'DOCUMENT',
	SPREADSHEET = 'SPREADSHEET',
	IMAGE = 'IMAGE',
	UNSUPPORTED = 'UNSUPPORTED',
}

const EXT_TO_CATEGORY: Record<string, FileCategory> = {
	txt: FileCategory.TEXT,
	md: FileCategory.TEXT,
	csv: FileCategory.TEXT,
	tsv: FileCategory.TEXT,
	html: FileCategory.TEXT,
	htm: FileCategory.TEXT,
	xml: FileCategory.TEXT,
	yaml: FileCategory.TEXT,
	yml: FileCategory.TEXT,
	json: FileCategory.TEXT,
	py: FileCategory.TEXT,
	rs: FileCategory.TEXT,
	go: FileCategory.TEXT,
	rb: FileCategory.TEXT,
	java: FileCategory.TEXT,
	kt: FileCategory.TEXT,
	swift: FileCategory.TEXT,
	c: FileCategory.TEXT,
	cpp: FileCategory.TEXT,
	h: FileCategory.TEXT,
	hpp: FileCategory.TEXT,
	cs: FileCategory.TEXT,
	ts: FileCategory.TEXT,
	js: FileCategory.TEXT,
	tsx: FileCategory.TEXT,
	jsx: FileCategory.TEXT,
	vue: FileCategory.TEXT,
	svelte: FileCategory.TEXT,
	sql: FileCategory.TEXT,
	sh: FileCategory.TEXT,
	bash: FileCategory.TEXT,
	zsh: FileCategory.TEXT,
	ps1: FileCategory.TEXT,
	toml: FileCategory.TEXT,
	ini: FileCategory.TEXT,
	cfg: FileCategory.TEXT,
	env: FileCategory.TEXT,
	log: FileCategory.TEXT,
	css: FileCategory.TEXT,
	scss: FileCategory.TEXT,
	less: FileCategory.TEXT,
	graphql: FileCategory.TEXT,
	pdf: FileCategory.PDF,
	docx: FileCategory.DOCUMENT,
	doc: FileCategory.DOCUMENT,
	rtf: FileCategory.DOCUMENT,
	odt: FileCategory.DOCUMENT,
	pptx: FileCategory.DOCUMENT,
	ppt: FileCategory.DOCUMENT,
	odp: FileCategory.DOCUMENT,
	xlsx: FileCategory.SPREADSHEET,
	xls: FileCategory.SPREADSHEET,
	ods: FileCategory.SPREADSHEET,
	png: FileCategory.IMAGE,
	jpg: FileCategory.IMAGE,
	jpeg: FileCategory.IMAGE,
	gif: FileCategory.IMAGE,
	webp: FileCategory.IMAGE,
	svg: FileCategory.IMAGE,
};

export function getFileCategory(filename: string): FileCategory {
	const ext = filename.split('.').pop()?.toLowerCase() ?? '';
	return EXT_TO_CATEGORY[ext] ?? FileCategory.UNSUPPORTED;
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
