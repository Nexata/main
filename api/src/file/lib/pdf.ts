import { imgToChunks, isRelevantImage } from '@api/file/lib/image';
import {
	type FileLike,
	splitter,
	type ToStringChunksResult,
} from '@api/file/lib/types';
import { extractImages, extractText, getDocumentProxy } from 'unpdf';

export async function pdfToChunks(f: FileLike) {
	let usage = 0;
	const chunks: string[] = [];

	const pdf = await getDocumentProxy(f);
	const { text, totalPages } = await extractText(pdf);

	for (let i = 0; i < totalPages; i++) {
		const pageText = text[i];
		if (pageText) chunks.push(...(await splitter.splitText(pageText)));

		const imgChunksPromises: Promise<ToStringChunksResult>[] = [];
		for (const img of await extractImages(pdf, i + 1)) {
			if (!isRelevantImage(img.width, img.height)) continue;
			imgChunksPromises.push(
				imgToChunks(img.data, {
					width: img.width,
					height: img.height,
					channels: img.channels,
				}),
			);
		}

		const imgChunks = await Promise.all(imgChunksPromises);
		chunks.push(...imgChunks.flatMap((res) => res[0]));
		usage += imgChunks.reduce((a, [, v]) => a + v, 0);
	}

	return [chunks, usage];
}
