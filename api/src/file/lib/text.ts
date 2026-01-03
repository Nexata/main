import { type FileLike, mdSplitter, splitter } from '@api/file/lib/types';

function bufferToString(f: FileLike): string {
	const arrayBuffer = ArrayBuffer.isView(f)
		? (f as ArrayBufferView).buffer
		: (f as ArrayBuffer);
	return new TextDecoder('utf-8').decode(arrayBuffer);
}

export async function textToChunks(f: FileLike) {
	const str = bufferToString(f);
	return [await splitter.splitText(str), 0];
}

export async function mdToChunks(f: FileLike) {
	const str = bufferToString(f);
	return [await mdSplitter.splitText(str), 0];
}
