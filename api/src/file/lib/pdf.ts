import { imgToChunks, isRelevantImage } from '@api/file/lib/image';
import {
	type FileLike,
	splitter,
	type ToStringChunksResult,
} from '@api/file/lib/types';
import { extractImages, extractText, getDocumentProxy } from 'unpdf';

export async function pdfToChunks(f: FileLike): Promise<ToStringChunksResult> {
	const chunks: ToStringChunksResult['chunks'] = [];
	let usage = 0;

	const pdf = await getDocumentProxy(f);
	const { text, totalPages } = await extractText(pdf);

	for (let i = 0; i < totalPages; i++) {
		const pageText = text[i];
		if (pageText) {
			const pageChunks = await splitter.splitText(pageText);
			chunks.push(
				...pageChunks.map((text) => ({
					text,
					metadata: { pageNumber: i + 1 },
				})),
			);
		}

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
		for (const imgResult of imgChunks) {
			chunks.push(
				...imgResult.chunks.map((chunk) => ({
					...chunk,
					metadata: { ...chunk.metadata, pageNumber: i + 1 },
				})),
			);
			usage += imgResult.tokenUsage ?? 0;
		}
	}

	return { metadata: { pageCount: totalPages }, chunks, tokenUsage: usage };
}
