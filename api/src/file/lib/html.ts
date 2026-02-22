import {
	type FileLike,
	mdSplitter,
	type ToStringChunksResult,
} from '@api/file/lib/types';
import TurndownService from 'turndown';

export async function htmlToChunks(f: FileLike): Promise<ToStringChunksResult> {
	const buffer = ArrayBuffer.isView(f) ? f.buffer : f;
	const html = new TextDecoder('utf-8').decode(buffer);
	const markdown = new TurndownService().turndown(html);
	const chunks = await mdSplitter.splitText(markdown);
	return { chunks: chunks.map((text) => ({ text })) };
}
