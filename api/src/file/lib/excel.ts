import type { FileLike, ToStringChunksResult } from '@api/file/lib/types';
import { mdSplitter } from '@api/file/lib/types';
import { tablemark } from 'tablemark';
import { read, utils } from 'xlsx';

export async function excelToChunks(
	f: FileLike,
): Promise<ToStringChunksResult> {
	const buffer = ArrayBuffer.isView(f) ? f.buffer : f;
	const workbook = read(buffer, { type: 'buffer' });
	const chunks: ToStringChunksResult['chunks'] = [];

	for (const sheetName of workbook.SheetNames) {
		const sheet = workbook.Sheets[sheetName];
		if (!sheet) continue;

		const rows = utils
			.sheet_to_json<Record<string, unknown>>(sheet)
			.map((r, i) => ({ rowNumber: i + 1, ...r }));

		if (!rows.length) continue;

		const markdown = tablemark(rows);
		const splitChunks = await mdSplitter.splitText(markdown);

		for (const text of splitChunks) {
			chunks.push({ text, metadata: { sheetName } });
		}
	}

	return {
		metadata: {
			author: workbook.Props?.Author,
			company: workbook.Props?.Company,
			category: workbook.Props?.Category,
			comments: workbook.Props?.Comments,
			language: workbook.Props?.Language,
			sheetNames: workbook.SheetNames,
		},
		chunks,
	};
}
