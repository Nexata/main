import { type FileLike, mdSplitter, splitter } from '@api/file/lib/types';

function bufferToString(f: FileLike): string {
	const arrayBuffer = ArrayBuffer.isView(f)
		? (f as ArrayBufferView).buffer
		: (f as ArrayBuffer);
	return new TextDecoder('utf-8').decode(arrayBuffer);
}

export async function textToChunks(f: FileLike) {
	const str = bufferToString(f);
	const chunks = await splitter.splitText(str);
	return { chunks: chunks.map((text) => ({ text })) };
}

export async function mdToChunks(f: FileLike) {
	const str = bufferToString(f);
	const chunks = await mdSplitter.splitText(str);
	return { chunks: chunks.map((text) => ({ text })) };
}
