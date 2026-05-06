import { createHash } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import sharp from 'sharp';
import { extractImages, extractText, getDocumentProxy } from 'unpdf';

Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });

const RENDER_SCALE = 2;
const VLM_IMAGE_MAX_DIMENSION = Number(
	process.env.VLM_IMAGE_MAX_DIMENSION ?? 1600,
);
const VLM_IMAGE_MAX_BYTES = Number(process.env.VLM_IMAGE_MAX_BYTES ?? 750_000);
const VLM_IMAGE_BATCH_MAX_BYTES = Number(
	process.env.VLM_IMAGE_BATCH_MAX_BYTES ?? VLM_IMAGE_MAX_BYTES,
);
const VLM_IMAGE_MAX_PIXELS = Number(
	process.env.VLM_IMAGE_MAX_PIXELS ?? 700_000,
);
const VLM_IMAGE_BATCH_SIZE = Math.min(
	2,
	Math.max(1, Number(process.env.VLM_IMAGE_BATCH_SIZE ?? 2)),
);
const VLM_CONCURRENCY = Math.max(1, Number(process.env.VLM_CONCURRENCY ?? 2));
const VLM_MIN_DELAY_MS = Math.max(
	0,
	Number(process.env.VLM_MIN_DELAY_MS ?? 750),
);
const VLM_IMAGE_JPEG_QUALITIES = [82, 72, 62, 52, 42] as const;
const VLM_IMAGE_RESIZE_ATTEMPTS = 4;

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

type RawImageMetadata = {
	width?: number;
	height?: number;
	channels?: 1 | 2 | 3 | 4;
};

type PreparedImage = {
	width: number;
	height: number;
	byteLength: number;
	hash?: string;
	raw?: RawImageMetadata;
};

function ms(start: number) {
	return performance.now() - start;
}

function formatMs(value: number) {
	return `${Math.round(value)}ms`;
}

function formatBytes(value: number) {
	if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MiB`;
	if (value >= 1024) return `${(value / 1024).toFixed(1)} KiB`;
	return `${value} B`;
}

function hashBytes(bytes: Uint8Array) {
	return createHash('sha256').update(bytes).digest('hex').slice(0, 16);
}

function imageCacheKey(
	data: Uint8Array | Uint8ClampedArray,
	raw: Required<Pick<RawImageMetadata, 'width' | 'height' | 'channels'>>,
) {
	return [
		raw.width,
		raw.height,
		raw.channels,
		hashBytes(fileLikeToUint8Array(data)),
	].join(':');
}

function isRelevantImage(width: number, height: number) {
	if (!width || !height) return false;
	const isTooSmall = width < 300 && height < 300;
	const ratio = width / height;
	const isExtremeRatio = ratio > 3 || ratio < 0.33;
	return !isTooSmall && !isExtremeRatio;
}

function fileLikeToUint8Array(
	f: ArrayBuffer | Uint8Array | Uint8ClampedArray | Buffer,
): Uint8Array {
	if (f instanceof Uint8Array) return f;
	if (ArrayBuffer.isView(f))
		return new Uint8Array(f.buffer, f.byteOffset, f.byteLength);
	return new Uint8Array(f);
}

function validateRawImage(
	f: ArrayBuffer | Uint8Array | Uint8ClampedArray | Buffer,
	raw: RawImageMetadata,
): Uint8Array {
	if (!raw.width || !raw.height || !raw.channels)
		throw new Error('Missing raw image metadata');

	const bytes = fileLikeToUint8Array(f);
	const expectedLength = raw.width * raw.height * raw.channels;
	if (bytes.byteLength !== expectedLength)
		throw new Error(
			`Raw image byte length mismatch: expected ${expectedLength}, got ${bytes.byteLength}`,
		);

	return bytes;
}

function targetDimensions(width: number, height: number, maxDimension: number) {
	if (!width || !height) return { width: maxDimension, height: maxDimension };

	const scale = Math.min(
		1,
		maxDimension / width,
		maxDimension / height,
		Math.sqrt(VLM_IMAGE_MAX_PIXELS / (width * height)),
	);

	return {
		width: Math.max(1, Math.floor(width * scale)),
		height: Math.max(1, Math.floor(height * scale)),
	};
}

async function prepareImageForVlm(image: Uint8Array): Promise<PreparedImage> {
	const bytes = fileLikeToUint8Array(image);
	const metadata = await sharp(bytes).metadata();
	const width = metadata.width ?? 0;
	const height = metadata.height ?? 0;

	if (
		metadata.format === 'jpeg' &&
		width <= VLM_IMAGE_MAX_DIMENSION &&
		height <= VLM_IMAGE_MAX_DIMENSION &&
		width * height <= VLM_IMAGE_MAX_PIXELS &&
		bytes.byteLength <= VLM_IMAGE_MAX_BYTES
	)
		return {
			width,
			height,
			byteLength: bytes.byteLength,
			hash: hashBytes(bytes),
		};

	let best: { buffer: Buffer; width: number; height: number } | undefined;
	let maxDimension = VLM_IMAGE_MAX_DIMENSION;
	const minDimension = Math.min(VLM_IMAGE_MAX_DIMENSION, 600);

	for (let attempt = 0; attempt < VLM_IMAGE_RESIZE_ATTEMPTS; attempt++) {
		for (const quality of VLM_IMAGE_JPEG_QUALITIES) {
			const size = targetDimensions(width, height, maxDimension);
			const jpeg = await sharp(bytes)
				.rotate()
				.resize({
					width: size.width,
					height: size.height,
					fit: 'inside',
					withoutEnlargement: true,
				})
				.flatten({ background: '#fff' })
				.jpeg({ quality, mozjpeg: true })
				.toBuffer();

			const jpegMetadata = await sharp(jpeg).metadata();
			const prepared = {
				buffer: jpeg,
				width: jpegMetadata.width ?? size.width,
				height: jpegMetadata.height ?? size.height,
			};
			if (!best || jpeg.byteLength < best.buffer.byteLength) best = prepared;
			if (jpeg.byteLength <= VLM_IMAGE_MAX_BYTES)
				return {
					width: prepared.width,
					height: prepared.height,
					byteLength: jpeg.byteLength,
					hash: hashBytes(jpeg),
				};
		}

		const nextMaxDimension = Math.max(
			minDimension,
			Math.floor(maxDimension * 0.75),
		);
		if (nextMaxDimension === maxDimension) break;
		maxDimension = nextMaxDimension;
	}

	if (!best) throw new Error('Unable to prepare image for VLM');
	return {
		width: best.width,
		height: best.height,
		byteLength: best.buffer.byteLength,
		hash: hashBytes(best.buffer),
	};
}

async function prepareRawImage(
	data: Uint8Array | Uint8ClampedArray,
	raw: RawImageMetadata,
): Promise<{
	sourceBytes: number;
	sourceHash: string;
	prepared: PreparedImage;
}> {
	const source = await sharp(validateRawImage(data, raw), {
		raw: {
			width: raw.width!,
			height: raw.height!,
			channels: raw.channels!,
		},
	})
		.png()
		.toBuffer();

	return {
		sourceBytes: source.byteLength,
		sourceHash: hashBytes(source),
		prepared: { ...(await prepareImageForVlm(new Uint8Array(source))), raw },
	};
}

function createImageBatches(inputs: PreparedImage[]): PreparedImage[][] {
	const batches: PreparedImage[][] = [];
	let batch: PreparedImage[] = [];
	let batchBytes = 0;

	for (const input of inputs) {
		const wouldExceedCount = batch.length >= VLM_IMAGE_BATCH_SIZE;
		const wouldExceedBytes =
			batch.length > 0 &&
			batchBytes + input.byteLength > VLM_IMAGE_BATCH_MAX_BYTES;

		if (wouldExceedCount || wouldExceedBytes) {
			batches.push(batch);
			batch = [];
			batchBytes = 0;
		}

		batch.push(input);
		batchBytes += input.byteLength;
	}

	if (batch.length) batches.push(batch);
	return batches;
}

async function _renderPageAsPng(
	pdf: Awaited<ReturnType<typeof getDocumentProxy>>,
	pageNumber: number,
): Promise<Buffer> {
	const canvasFactory = new CanvasFactory();
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

const path = process.argv[2];
if (!path) throw new Error('Usage: bun scripts/profile-pdf-ingest.ts <pdf>');

const started = performance.now();
const fileStats = await stat(path);
const pdf = await getDocumentProxy(
	new Uint8Array(await Bun.file(path).arrayBuffer()),
	{
		// biome-ignore lint/suspicious/noExplicitAny: unpdf expects class constructor as Object
		CanvasFactory: CanvasFactory as any,
	},
);
const loadMs = ms(started);

const textStart = performance.now();
const { text, totalPages } = await extractText(pdf);
const textMs = ms(textStart);

let rawImages = 0;
let relevantImages = 0;
let skippedImages = 0;
let rawBytes = 0;
let sourcePngBytes = 0;
let preparedBytes = 0;
let extractImagesMs = 0;
let prepareImagesMs = 0;
let minimumFallbackPages = 0;
let pagesWithoutText = 0;
let pagesWithRelevantImages = 0;
const imageCache = new Set<string>();
const perPage: {
	page: number;
	textChars: number;
	rawImages: number;
	relevantImages: number;
	preparedBytes: number;
	batches: number;
	cachedBatches: number;
	extractMs: number;
	prepareMs: number;
}[] = [];
const imageStats: {
	page: number;
	width: number;
	height: number;
	channels: number;
	rawBytes: number;
	sourceBytes?: number;
	preparedBytes?: number;
	preparedWidth?: number;
	preparedHeight?: number;
	sourceHash?: string;
	preparedHash?: string;
	relevant: boolean;
}[] = [];

for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
	const textChars =
		typeof text[pageNumber - 1] === 'string'
			? text[pageNumber - 1]!.trim().length
			: 0;
	if (!textChars) pagesWithoutText++;

	const extractStart = performance.now();
	const images = await extractImages(pdf, pageNumber);
	const pageExtractMs = ms(extractStart);
	extractImagesMs += pageExtractMs;

	const prepared: PreparedImage[] = [];
	const cachedPrepared: PreparedImage[] = [];
	let pageRelevant = 0;
	let pagePreparedBytes = 0;
	let pagePrepareMs = 0;
	rawImages += images.length;

	for (const image of images) {
		rawBytes += image.data.byteLength;
		const imageStat: (typeof imageStats)[number] = {
			page: pageNumber,
			width: image.width,
			height: image.height,
			channels: image.channels,
			rawBytes: image.data.byteLength,
			relevant: isRelevantImage(image.width, image.height),
		};
		imageStats.push(imageStat);
		if (!imageStat.relevant) {
			skippedImages++;
			continue;
		}

		pageRelevant++;
		relevantImages++;
		const prepareStart = performance.now();
		const result = await prepareRawImage(image.data, {
			width: image.width,
			height: image.height,
			channels: image.channels,
		});
		const cacheKey = imageCacheKey(image.data, {
			width: image.width,
			height: image.height,
			channels: image.channels,
		});
		const elapsed = ms(prepareStart);
		pagePrepareMs += elapsed;
		prepareImagesMs += elapsed;
		sourcePngBytes += result.sourceBytes;
		preparedBytes += result.prepared.byteLength;
		pagePreparedBytes += result.prepared.byteLength;
		imageStat.sourceBytes = result.sourceBytes;
		imageStat.preparedBytes = result.prepared.byteLength;
		imageStat.preparedWidth = result.prepared.width;
		imageStat.preparedHeight = result.prepared.height;
		imageStat.sourceHash = result.sourceHash;
		imageStat.preparedHash = result.prepared.hash;
		prepared.push(result.prepared);
		if (!imageCache.has(cacheKey)) {
			imageCache.add(cacheKey);
			cachedPrepared.push(result.prepared);
		}
	}

	const batches = createImageBatches(prepared).length;
	const cachedBatches = createImageBatches(cachedPrepared).length;
	if (!textChars && !pageRelevant) minimumFallbackPages++;
	if (pageRelevant) pagesWithRelevantImages++;
	perPage.push({
		page: pageNumber,
		textChars,
		rawImages: images.length,
		relevantImages: pageRelevant,
		preparedBytes: pagePreparedBytes,
		batches,
		cachedBatches,
		extractMs: pageExtractMs,
		prepareMs: pagePrepareMs,
	});
}

const extractedImageRequests = perPage.reduce(
	(acc, page) => acc + page.batches,
	0,
);
const cachedExtractedImageRequests = perPage.reduce(
	(acc, page) => acc + page.cachedBatches,
	0,
);
const minVlmRequests = extractedImageRequests + minimumFallbackPages;
const cachedMinVlmRequests =
	cachedExtractedImageRequests + minimumFallbackPages;
const throttleFloorMs = Math.max(0, minVlmRequests - 1) * VLM_MIN_DELAY_MS;
const cachedThrottleFloorMs =
	Math.max(0, cachedMinVlmRequests - 1) * VLM_MIN_DELAY_MS;
const totalMs = ms(started);

console.log(
	JSON.stringify(
		{
			file: path,
			fileBytes: fileStats.size,
			fileSize: formatBytes(fileStats.size),
			totalPages,
			loadMs: formatMs(loadMs),
			textMs: formatMs(textMs),
			extractImagesMs: formatMs(extractImagesMs),
			prepareImagesMs: formatMs(prepareImagesMs),
			totalLocalMs: formatMs(totalMs),
			rawImages,
			relevantImages,
			skippedImages,
			pagesWithoutText,
			pagesWithRelevantImages,
			minimumFallbackPages,
			rawImageBytes: formatBytes(rawBytes),
			sourcePngBytes: formatBytes(sourcePngBytes),
			preparedJpegBytes: formatBytes(preparedBytes),
			extractedImageRequests,
			cachedExtractedImageRequests,
			minVlmRequests,
			cachedMinVlmRequests,
			vlmConcurrency: VLM_CONCURRENCY,
			vlmMinDelayMs: VLM_MIN_DELAY_MS,
			vlmThrottleFloor: formatMs(throttleFloorMs),
			cachedVlmThrottleFloor: formatMs(cachedThrottleFloorMs),
			settings: {
				VLM_IMAGE_BATCH_SIZE,
				VLM_IMAGE_MAX_BYTES,
				VLM_IMAGE_BATCH_MAX_BYTES,
				VLM_IMAGE_MAX_PIXELS,
				VLM_IMAGE_MAX_DIMENSION,
			},
			relevantImageSizeBuckets: {
				fullOrNearPage: imageStats.filter(
					(image) =>
						image.relevant && image.width >= 1000 && image.height >= 1000,
				).length,
				medium: imageStats.filter(
					(image) =>
						image.relevant &&
						image.width * image.height >= 300_000 &&
						(image.width < 1000 || image.height < 1000),
				).length,
				small: imageStats.filter(
					(image) => image.relevant && image.width * image.height < 300_000,
				).length,
			},
			largestImages: [...imageStats]
				.filter((image) => image.relevant)
				.sort((a, b) => b.width * b.height - a.width * a.height)
				.slice(0, 15)
				.map((image) => ({
					...image,
					rawBytes: formatBytes(image.rawBytes),
					sourceBytes: image.sourceBytes
						? formatBytes(image.sourceBytes)
						: undefined,
					preparedBytes: image.preparedBytes
						? formatBytes(image.preparedBytes)
						: undefined,
				})),
			largestPreparedImages: [...imageStats]
				.filter((image) => image.relevant)
				.sort((a, b) => (b.preparedBytes ?? 0) - (a.preparedBytes ?? 0))
				.slice(0, 15)
				.map((image) => ({
					...image,
					rawBytes: formatBytes(image.rawBytes),
					sourceBytes: image.sourceBytes
						? formatBytes(image.sourceBytes)
						: undefined,
					preparedBytes: image.preparedBytes
						? formatBytes(image.preparedBytes)
						: undefined,
				})),
			imageDimensionCounts: Object.entries(
				imageStats.reduce<Record<string, number>>((acc, image) => {
					const key = `${image.width}x${image.height}x${image.channels}:${image.relevant ? 'relevant' : 'skipped'}`;
					acc[key] = (acc[key] ?? 0) + 1;
					return acc;
				}, {}),
			)
				.sort(([, a], [, b]) => b - a)
				.slice(0, 20)
				.map(([key, count]) => ({ key, count })),
			duplicatePreparedImageHashes: Object.entries(
				imageStats
					.filter((image) => image.relevant && image.preparedHash)
					.reduce<
						Record<
							string,
							{ count: number; pages: number[]; dimensions: string }
						>
					>((acc, image) => {
						const key = image.preparedHash!;
						acc[key] ??= {
							count: 0,
							pages: [],
							dimensions: `${image.preparedWidth}x${image.preparedHeight}`,
						};
						acc[key].count++;
						acc[key].pages.push(image.page);
						return acc;
					}, {}),
			)
				.map(([hash, value]) => ({ hash, ...value }))
				.filter((item) => item.count > 1)
				.sort((a, b) => b.count - a.count)
				.slice(0, 20),
			uniquePreparedImages: new Set(
				imageStats
					.filter((image) => image.relevant && image.preparedHash)
					.map((image) => image.preparedHash),
			).size,
			slowestPages: [...perPage]
				.sort((a, b) => b.extractMs + b.prepareMs - (a.extractMs + a.prepareMs))
				.slice(0, 10)
				.map((page) => ({
					...page,
					preparedBytes: formatBytes(page.preparedBytes),
					extractMs: formatMs(page.extractMs),
					prepareMs: formatMs(page.prepareMs),
				})),
			pagesWithMostBatches: [...perPage]
				.sort(
					(a, b) =>
						b.batches - a.batches || b.relevantImages - a.relevantImages,
				)
				.slice(0, 10)
				.map((page) => ({
					...page,
					preparedBytes: formatBytes(page.preparedBytes),
					extractMs: formatMs(page.extractMs),
					prepareMs: formatMs(page.prepareMs),
				})),
		},
		null,
		2,
	),
);
