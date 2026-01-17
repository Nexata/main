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

export type ToStringChunksResult = [string[], number]; // [chunks, token usage (if any)]

export const splitter = new RecursiveCharacterTextSplitter({
	chunkSize: EMBEDDING_SIZE,
	chunkOverlap: EMBEDDING_OVERLAP,
});

export const mdSplitter = new MarkdownTextSplitter({
	chunkSize: EMBEDDING_SIZE,
	chunkOverlap: EMBEDDING_OVERLAP,
});
