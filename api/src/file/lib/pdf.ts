import {
	type ImageToChunksInput,
	InvalidRawImageError,
	imgsToChunks,
	imgToChunks,
	isIgnorableEmbeddedImageProcessingError,
	isRelevantImage,
} from '@api/file/lib/image';
import {
	type FileLike,
	splitter,
	type ToStringChunksResult,
} from '@api/file/lib/types';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import pLimit from 'p-limit';
import { extractImages, extractText, getDocumentProxy } from 'unpdf';

Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });

const RENDER_SCALE = 2;
const PAGE_CONCURRENCY = Math.max(
	1,
	Number(process.env.PDF_PAGE_CONCURRENCY ?? 2),
);

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

function addPageChunks(
	chunks: ToStringChunksResult['chunks'],
	pageNumber: number,
	result: ToStringChunksResult,
) {
	chunks.push(
		...result.chunks.map((chunk) => ({
			...chunk,
			metadata: { ...chunk.metadata, pageNumber },
		})),
	);
}

async function renderPageFallback(
	pdf: Awaited<ReturnType<typeof getDocumentProxy>>,
	pageNumber: number,
	chunks: ToStringChunksResult['chunks'],
): Promise<number> {
	const png = await renderPageAsPng(pdf, pageNumber);
	let rendered: ToStringChunksResult;
	try {
		rendered = await imgToChunks(new Uint8Array(png));
	} catch (error) {
		if (isIgnorableEmbeddedImageProcessingError(error)) return 0;

		throw error;
	}

	addPageChunks(chunks, pageNumber, rendered);
	return rendered.tokenUsage ?? 0;
}

function isPdfImageDecodeError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : '';
	return (
		message.includes('OpenJPEG failed to initialize') ||
		message.includes('Unable to decode image') ||
		message.includes('JpxError')
	);
}

export async function pdfToChunks(f: FileLike): Promise<ToStringChunksResult> {
	const pdf = await getDocumentProxy(f, {
		// biome-ignore lint/suspicious/noExplicitAny: unpdf expects class constructor as Object
		CanvasFactory: CanvasFactory as any,
	});
	const { text, totalPages } = await extractText(pdf);

	const limit = pLimit(PAGE_CONCURRENCY);

	const pageResults = await Promise.all(
		Array.from({ length: totalPages }, (_, i) =>
			limit(async () => {
				const pageNumber = i + 1;
				const pageText = text[i];
				const pageChunks: ToStringChunksResult['chunks'] = [];
				let pageUsage = 0;
				let hasText = false;
				let hasImages = false;
				let shouldRenderPageFallback = false;

				if (pageText && typeof pageText === 'string') {
					hasText = true;
					const textChunks = await splitter.splitText(pageText);
					pageChunks.push(
						...textChunks.map((text) => ({
							text,
							metadata: { pageNumber },
						})),
					);
				}

				try {
					const imageInputs: ImageToChunksInput[] = [];
					for (const img of await extractImages(pdf, pageNumber)) {
						if (!isRelevantImage(img.width, img.height)) continue;

						imageInputs.push({
							data: img.data,
							raw: {
								width: img.width,
								height: img.height,
								channels: img.channels,
							},
						});
					}

					try {
						const imgResults = await imgsToChunks(imageInputs, 'best-effort');

						for (const imgResult of imgResults) {
							hasImages = hasImages || imgResult.chunks.length > 0;
							addPageChunks(pageChunks, pageNumber, imgResult);
							pageUsage += imgResult.tokenUsage ?? 0;
						}
					} catch (error) {
						if (
							error instanceof InvalidRawImageError ||
							isPdfImageDecodeError(error)
						) {
							shouldRenderPageFallback = true;
						} else if (!isIgnorableEmbeddedImageProcessingError(error)) {
							throw error;
						}
					}
				} catch (error) {
					if (!isIgnorableEmbeddedImageProcessingError(error)) {
						const message = error instanceof Error ? error.message : '';
						if (
							message.includes('OpenJPEG failed to initialize') ||
							message.includes('Unable to decode image') ||
							message.includes('JpxError') ||
							message.includes("Requesting object that isn't resolved yet")
						) {
							shouldRenderPageFallback = true;
						} else {
							throw error;
						}
					}
				}

				if (shouldRenderPageFallback || (!hasText && !hasImages))
					pageUsage += await renderPageFallback(pdf, pageNumber, pageChunks);

				return { chunks: pageChunks, usage: pageUsage };
			}),
		),
	);

	const chunks: ToStringChunksResult['chunks'] = [];
	let usage = 0;
	for (const page of pageResults) {
		chunks.push(...page.chunks);
		usage += page.usage;
	}

	return { metadata: { pageCount: totalPages }, chunks, tokenUsage: usage };
}
