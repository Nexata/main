import type { FileLike, ToStringChunksResult } from '@api/file/lib/types';
import { mdSplitter } from '@api/file/lib/types';
import { tablemark } from 'tablemark';
import { read, utils } from 'xlsx';

export async function csvToChunks(f: FileLike): Promise<ToStringChunksResult> {
	const buffer = ArrayBuffer.isView(f) ? f.buffer : f;
	const text = new TextDecoder('utf-8').decode(buffer);
	const workbook = read(text, { type: 'string' });
	const sheet = workbook.Sheets[workbook.SheetNames[0]!];
	if (!sheet) return { chunks: [] };

	const rows = utils
		.sheet_to_json<Record<string, unknown>>(sheet)
		.map((r, i) => ({ rowNumber: i + 1, ...r }));

	if (!rows.length) return { chunks: [] };

	const markdown = tablemark(rows);
	const splitChunks = await mdSplitter.splitText(markdown);

	return { chunks: splitChunks.map((text) => ({ text })) };
}
