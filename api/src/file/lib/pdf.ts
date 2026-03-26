import { imgToChunks, isRelevantImage } from '@api/file/lib/image';
import {
	type FileLike,
	splitter,
	type ToStringChunksResult,
} from '@api/file/lib/types';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { extractImages, extractText, getDocumentProxy } from 'unpdf';

Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });

const RENDER_SCALE = 2;

class CanvasFactory {
	create(width: number, height: number) {
		const canvas = createCanvas(width, height);
		return { canvas, context: canvas.getContext('2d') };
	}

	reset(
		canvasAndContext: {
			canvas: ReturnType<typeof createCanvas>;
			context: ReturnType<ReturnType<typeof createCanvas>['getContext']>;
		},
		width: number,
		height: number,
	) {
		canvasAndContext.canvas.width = width;
		canvasAndContext.canvas.height = height;
	}

	destroy(canvasAndContext: {
		canvas: ReturnType<typeof createCanvas>;
		context: ReturnType<ReturnType<typeof createCanvas>['getContext']>;
	}) {
		canvasAndContext.canvas.width = 0;
		canvasAndContext.canvas.height = 0;
	}
}

const canvasFactory = new CanvasFactory();

async function renderPageAsPng(
	pdf: Awaited<ReturnType<typeof getDocumentProxy>>,
	pageNumber: number,
): Promise<Buffer> {
	const page = await pdf.getPage(pageNumber);
	const viewport = page.getViewport({ scale: RENDER_SCALE });
	const { canvas, context } = canvasFactory.create(
		viewport.width,
		viewport.height,
	);

	await page.render({
		canvas: null,
		canvasContext: context as unknown as CanvasRenderingContext2D,
		viewport,
	}).promise;

	const png = canvas.toBuffer('image/png');

	canvas.width = 0;
	canvas.height = 0;

	return png;
}

export async function pdfToChunks(f: FileLike): Promise<ToStringChunksResult> {
	const chunks: ToStringChunksResult['chunks'] = [];
	let usage = 0;

	const pdf = await getDocumentProxy(f, {
		CanvasFactory: CanvasFactory as any,
	});
	const { text, totalPages } = await extractText(pdf);

	for (let i = 0; i < totalPages; i++) {
		const pageText = text[i];
		let hasText = false;
		let hasImages = false;

		if (pageText) {
			hasText = true;
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
			hasImages = true;
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

		if (!hasText && !hasImages) {
			const png = await renderPageAsPng(pdf, i + 1);
			const rendered = await imgToChunks(new Uint8Array(png));
			chunks.push(
				...rendered.chunks.map((chunk) => ({
					...chunk,
					metadata: { ...chunk.metadata, pageNumber: i + 1 },
				})),
			);
			usage += rendered.tokenUsage ?? 0;
		}
	}

	return { metadata: { pageCount: totalPages }, chunks, tokenUsage: usage };
}
