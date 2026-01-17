import { EMBEDDING_OVERLAP, EMBEDDING_SIZE } from '@api/env';
import type { FileLike, ToStringChunksResult } from '@api/file/lib/types';
import { tablemark } from 'tablemark';
import { read, utils } from 'xlsx';

export async function excelToChunks(
	f: FileLike,
): Promise<ToStringChunksResult> {
	const buffer = ArrayBuffer.isView(f) ? f.buffer : f;
	const workbook = read(buffer, { type: 'buffer' });
	const chunks: string[] = [];

	for (const sheetName of workbook.SheetNames) {
		const sheet = workbook.Sheets[sheetName];
		if (!sheet) continue;

		const rows = utils
			.sheet_to_json<Record<string, unknown>>(sheet)
			.map((r, i) => ({ rowNumber: i + 1, ...r }));

		let i = 0;
		while (i < rows.length) {
			let batchSize = 0;
			const batchStart = i;

			while (i < rows.length && batchSize < EMBEDDING_SIZE) {
				batchSize += JSON.stringify(rows[i]).length * 1.25;
				i++;
			}

			if (i === batchStart) break;

			chunks.push(
				[
					`## Sheet: '${sheetName}'`,
					`**Total row count: ${rows.length}**`,
					tablemark(rows.slice(batchStart, i)),
				].join('\n\n'),
			);

			let overlapSize = 0;
			while (i > batchStart && overlapSize < EMBEDDING_OVERLAP) {
				i--;
				overlapSize += JSON.stringify(rows[i]).length * 1.25;
			}
		}
	}

	return [chunks, 0];
}
