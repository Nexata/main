import { pathToFileURL } from 'node:url';
import {
	InvalidRawImageError,
	imgToChunks,
	isRelevantImage,
} from '@api/file/lib/image';
import {
	type FileLike,
	splitter,
	type ToStringChunksResult,
} from '@api/file/lib/types';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import {
	definePDFJSModule,
	extractImages,
	extractText,
	getDocumentProxy,
	getResolvedPDFJS,
} from 'unpdf';

Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });

const RENDER_SCALE = 2;
const PDFJS_DIST_ROOT = '/app/node_modules/pdfjs-dist';
const PDFJS_WORKER_PATH = `${PDFJS_DIST_ROOT}/build/pdf.worker.mjs`;
const PDFJS_WASM_PATH = `${PDFJS_DIST_ROOT}/wasm/`;

let pdfJsConfigured: Promise<void> | undefined;

async function ensurePdfJsConfigured(): Promise<void> {
	if (!pdfJsConfigured)
		pdfJsConfigured = definePDFJSModule(() => import('pdfjs-dist')).catch(
			(error) => {
				pdfJsConfigured = undefined;
				throw error;
			},
		);

	await pdfJsConfigured;

	const pdfjs = await getResolvedPDFJS();
	pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(PDFJS_WORKER_PATH).href;
}

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
	const rendered = await imgToChunks(new Uint8Array(png));
	addPageChunks(chunks, pageNumber, rendered);
	return rendered.tokenUsage ?? 0;
}

export async function pdfToChunks(f: FileLike): Promise<ToStringChunksResult> {
	const chunks: ToStringChunksResult['chunks'] = [];
	let usage = 0;

	await ensurePdfJsConfigured();

	const pdf = await getDocumentProxy(f, {
		// biome-ignore lint/suspicious/noExplicitAny: unpdf expects class constructor as Object
		CanvasFactory: CanvasFactory as any,
		useWorkerFetch: false,
		wasmUrl: pathToFileURL(PDFJS_WASM_PATH).href,
	});
	const { text, totalPages } = await extractText(pdf);

	for (let i = 0; i < totalPages; i++) {
		const pageNumber = i + 1;
		const pageText = text[i];
		let hasText = false;
		let hasImages = false;
		let shouldRenderPageFallback = false;

		if (pageText) {
			hasText = true;
			const pageChunks = await splitter.splitText(pageText);
			chunks.push(
				...pageChunks.map((text) => ({
					text,
					metadata: { pageNumber },
				})),
			);
		}

		try {
			for (const img of await extractImages(pdf, pageNumber)) {
				if (!isRelevantImage(img.width, img.height)) continue;

				try {
					const imgResult = await imgToChunks(img.data, {
						width: img.width,
						height: img.height,
						channels: img.channels,
					});

					hasImages = hasImages || imgResult.chunks.length > 0;
					addPageChunks(chunks, pageNumber, imgResult);
					usage += imgResult.tokenUsage ?? 0;
				} catch (error) {
					if (error instanceof InvalidRawImageError) {
						shouldRenderPageFallback = true;
						continue;
					}

					const message = error instanceof Error ? error.message : '';
					if (
						message.includes('OpenJPEG failed to initialize') ||
						message.includes('Unable to decode image') ||
						message.includes('JpxError')
					) {
						shouldRenderPageFallback = true;
						continue;
					}

					throw error;
				}
			}
		} catch (error) {
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

		if (shouldRenderPageFallback || (!hasText && !hasImages))
			usage += await renderPageFallback(pdf, pageNumber, chunks);
	}

	return { metadata: { pageCount: totalPages }, chunks, tokenUsage: usage };
}
