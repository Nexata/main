import { VLM_MODEL, VLM_MODEL_NAME } from '@api/env';
import {
	type FileLike,
	mdSplitter,
	type ToStringChunksResult,
} from '@api/file/lib/types';
import { withVlmRateLimit } from '@api/utils/ai-rate-limit';
import { log } from '@api/utils/env';
import { tObject } from '@api/utils/type';
import {
	APICallError,
	generateText,
	jsonSchema,
	NoObjectGeneratedError,
	Output,
	parsePartialJson,
} from 'ai';
import { type Static, t } from 'elysia';
import sharp from 'sharp';

type ImageToTextOutput = Static<typeof imageToTextOutput>;
type BatchedImageToTextOutput = Static<typeof batchedImageToTextOutput>;
type RawImageMetadata = {
	width?: number;
	height?: number;
	channels?: 1 | 2 | 3 | 4;
};
type PreparedImage = {
	image: Uint8Array;
	raw?: RawImageMetadata;
	width: number;
	height: number;
	byteLength: number;
	mediaType: 'image/jpeg';
};
type ImageProcessingMode = 'strict' | 'best-effort';

export type ImageToChunksInput = { data: FileLike; raw?: RawImageMetadata };

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
const VLM_IMAGE_JPEG_QUALITIES = [82, 72, 62, 52, 42] as const;
const VLM_IMAGE_RESIZE_ATTEMPTS = 4;
const VLM_IMAGE_DETAIL = process.env.VLM_IMAGE_DETAIL ?? 'low';
const VLM_OUTPUT_TOKEN_MULTIPLIER = 20;
const VLM_REQUEST_TIMEOUT_MS = Number(
	process.env.VLM_REQUEST_TIMEOUT_MS ?? 60_000,
);

export class InvalidRawImageError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'InvalidRawImageError';
	}
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : '';
}

function getApiCallStatus(error: unknown): number | undefined {
	if (!APICallError.isInstance(error)) return undefined;

	return (
		(error as { statusCode?: number; status?: number }).statusCode ??
		(error as { status?: number }).status
	);
}

function getProviderErrorBody(error: unknown): unknown {
	if (!error || typeof error !== 'object') return undefined;
	return (error as { responseBody?: unknown }).responseBody;
}

function truncate(value: string, max = 500): string {
	return value.length > max ? `${value.slice(0, max)}...` : value;
}

function getProviderErrorSummary(error: unknown): string {
	const body = getProviderErrorBody(error);
	const bodyText =
		typeof body === 'string'
			? body
			: body
				? JSON.stringify(body)
				: getErrorMessage(error);

	return truncate(bodyText);
}

function isImageBadRequest(error: unknown): boolean {
	const status = getApiCallStatus(error);
	if (status && status !== 400) return false;

	const message = `${getErrorMessage(error)} ${getProviderErrorSummary(error)}`;
	return (
		status === 400 ||
		message.includes('Bad Request') ||
		message.includes('INVALID_REQUEST_BODY') ||
		message.includes('IMAGE_FILE_EXCEEDS_MAX_SIZE') ||
		message.includes('INVALID_IMAGE_FORMAT') ||
		message.includes('IMAGE_EXCEEDS_MAX_RESOLUTION') ||
		message.includes('INVALID_IMAGE_SIZE') ||
		message.includes('unsupported image format')
	);
}

function isVlmTimeoutError(error: unknown): boolean {
	if (
		error instanceof Error &&
		(error.name === 'TimeoutError' || error.name === 'AbortError')
	)
		return true;

	const message = getErrorMessage(error);
	return (
		message.includes('aborted') ||
		message.includes('timed out') ||
		message.includes('operation timed out')
	);
}

export function isIgnorableImageProcessingError(error: unknown): boolean {
	if (NoObjectGeneratedError.isInstance(error)) return true;

	const message = getErrorMessage(error);

	return (
		message.includes('No output generated') ||
		message.includes('No object generated') ||
		message.includes('Service unavailable') ||
		message.includes('UNSUPPORTED_MIME_TYPE') ||
		message.includes('UNSUPPORTED_FILE_TYPE')
	);
}

export function isIgnorableEmbeddedImageProcessingError(
	error: unknown,
): boolean {
	return (
		isIgnorableImageProcessingError(error) ||
		isImageBadRequest(error) ||
		isVlmTimeoutError(error)
	);
}

export function isRelevantImage(width: number, height: number) {
	if (!width || !height) return false;

	const isTooSmall = width < 300 && height < 300;

	const ratio = width / height;
	const isExtremeRatio = ratio > 3 || ratio < 0.33;

	return !isTooSmall && !isExtremeRatio;
}

function fileLikeToUint8Array(f: FileLike): Uint8Array {
	if (f instanceof Uint8Array) return f;
	if (ArrayBuffer.isView(f))
		return new Uint8Array(f.buffer, f.byteOffset, f.byteLength);
	return new Uint8Array(f);
}

function validateRawImage(
	f: FileLike,
	raw: { width?: number; height?: number; channels?: 1 | 2 | 3 | 4 },
): Uint8Array {
	if (!raw.width || !raw.height || !raw.channels)
		throw new InvalidRawImageError('Missing raw image metadata');

	const bytes = fileLikeToUint8Array(f);
	const expectedLength = raw.width * raw.height * raw.channels;

	if (bytes.byteLength !== expectedLength)
		throw new InvalidRawImageError(
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

async function prepareImageForVlm(image: FileLike): Promise<PreparedImage> {
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
			image: bytes,
			width,
			height,
			byteLength: bytes.byteLength,
			mediaType: 'image/jpeg',
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
					image: new Uint8Array(jpeg),
					width: prepared.width,
					height: prepared.height,
					byteLength: jpeg.byteLength,
					mediaType: 'image/jpeg',
				};
		}

		const nextMaxDimension = Math.max(
			minDimension,
			Math.floor(maxDimension * 0.75),
		);
		if (nextMaxDimension === maxDimension) break;

		maxDimension = nextMaxDimension;
	}

	if (!best) throw new InvalidRawImageError('Unable to prepare image for VLM');

	return {
		image: new Uint8Array(best.buffer),
		width: best.width,
		height: best.height,
		byteLength: best.buffer.byteLength,
		mediaType: 'image/jpeg',
	};
}

async function prepareImageInput(
	input: ImageToChunksInput,
): Promise<PreparedImage> {
	const sourceImage = input.raw
		? await sharp(validateRawImage(input.data, input.raw), {
				raw: {
					width: input.raw.width!,
					height: input.raw.height!,
					channels: input.raw.channels!,
				},
			})
				.png()
				.toBuffer()
		: fileLikeToUint8Array(input.data);

	return { ...(await prepareImageForVlm(sourceImage)), raw: input.raw };
}

function imagePart(image: PreparedImage) {
	return {
		type: 'image' as const,
		image: image.image,
		mediaType: image.mediaType,
		providerOptions: { openai: { imageDetail: VLM_IMAGE_DETAIL } },
	};
}

const imageToTextFields = {
	hasValue: t.Boolean({
		description:
			"Whether the image has a semantic or logical value on it's own. This will decide whether the image should be included in the final RAG pipeline. i.e. logos, icons, separators, etc. do not have semantic value. Charts, graphs, tables, diagrams and even general pictures often have semantic value. If unsure, assume it has semantic value.",
	}),
	description: t.Union([
		t.String({
			description:
				'A large description of the image, emphasizing its key semantic features. This will be vectorized and used for semantic search.',
		}),
		t.Null(),
	]),
	ocr: t.Union([
		t.String({
			minLength: 1,
			description:
				'The text directly extracted from the image, if any. Short text such as logos, acronyms, labels, and stamps is valid. Use markdown syntax only when it represents text style in the image.',
		}),
		t.Null(),
	]),
};

const imageToTextOutput = tObject(imageToTextFields);
const batchedImageToTextOutput = tObject({
	images: t.Array(
		tObject({
			index: t.Integer({
				minimum: 1,
				maximum: 2,
				description: 'The 1-based position of the image in the request.',
			}),
			...imageToTextFields,
		}),
		{ minItems: 1, maxItems: 2 },
	),
});

function normalizeTextOutput(value: unknown): ImageToTextOutput | null {
	if (!value || typeof value !== 'object') return null;

	const output = value as Record<string, unknown>;
	if (typeof output.hasValue !== 'boolean') return null;

	const description =
		typeof output.description === 'string' || output.description === null
			? output.description
			: null;
	const ocr =
		typeof output.ocr === 'string' || output.ocr === null ? output.ocr : null;

	return { hasValue: output.hasValue, description, ocr };
}

function normalizeBatchedTextOutput(
	value: unknown,
	count: number,
): BatchedImageToTextOutput | null {
	if (!value || typeof value !== 'object') return null;

	const images = (value as Record<string, unknown>).images;
	if (!Array.isArray(images)) return null;
	const rawIndexes = images
		.map((item) =>
			item && typeof item === 'object'
				? (item as Record<string, unknown>).index
				: null,
		)
		.filter((index): index is number =>
			Number.isInteger(typeof index === 'number' ? index : NaN),
		);
	const usesZeroBasedIndexes = rawIndexes.includes(0);

	const normalized = images
		.map((item) => {
			if (!item || typeof item !== 'object') return null;

			const image = item as Record<string, unknown>;
			const rawIndex = typeof image.index === 'number' ? image.index : null;
			const index =
				rawIndex !== null && usesZeroBasedIndexes ? rawIndex + 1 : rawIndex;
			if (!index || index < 1 || index > count) return null;

			const output = normalizeTextOutput(image);
			return output ? { index, ...output } : null;
		})
		.filter((item) => item !== null);

	return normalized.length ? { images: normalized } : null;
}

function parseJsonObjectPrefix(text: string): unknown {
	const start = text.indexOf('{');
	if (start === -1) return null;

	for (let end = text.length; end > start; end--) {
		const candidate = text.slice(start, end);
		try {
			return JSON.parse(candidate);
		} catch {}
	}

	return null;
}

async function repairImageToTextOutput(
	error: unknown,
): Promise<{ output: ImageToTextOutput; usage: number } | null> {
	if (!NoObjectGeneratedError.isInstance(error) || !error.text) return null;

	const parsed = parseJsonObjectPrefix(error.text);
	const { value, state } = parsed
		? { value: parsed, state: 'successful-parse' as const }
		: await parsePartialJson(error.text);

	if (state === 'failed-parse' || state === 'undefined-input') return null;

	const output = normalizeTextOutput(value);
	if (!output) return null;

	return { output, usage: error.usage?.totalTokens ?? 0 };
}

async function repairBatchedImageToTextOutput(
	error: unknown,
	count: number,
): Promise<{ output: BatchedImageToTextOutput; usage: number } | null> {
	if (!NoObjectGeneratedError.isInstance(error) || !error.text) return null;

	const parsed = parseJsonObjectPrefix(error.text);
	const { value, state } = parsed
		? { value: parsed, state: 'successful-parse' as const }
		: await parsePartialJson(error.text);

	if (state === 'failed-parse' || state === 'undefined-input') return null;

	const output = normalizeBatchedTextOutput(value, count);
	if (!output) return null;

	return { output, usage: error.usage?.totalTokens ?? 0 };
}

async function chunksFromImageOutput(
	output: ImageToTextOutput,
	metadata?: object,
): Promise<ToStringChunksResult['chunks']> {
	const chunks: ToStringChunksResult['chunks'] = [];

	if (!output.hasValue) return chunks;

	if (output.description)
		chunks.push({
			text: output.description,
			metadata: { ...metadata, type: 'description' },
		});

	if (output.ocr) {
		const ocrChunks = await mdSplitter.splitText(output.ocr);
		chunks.push(
			...ocrChunks.map((text) => ({
				text,
				metadata: { ...metadata, type: 'ocr' },
			})),
		);
	}

	return chunks;
}

async function generateImageText(
	image: PreparedImage,
): Promise<{ output: ImageToTextOutput; usage: number }> {
	try {
		const result = await withVlmRateLimit(() =>
			generateText({
				model: VLM_MODEL,
				temperature: 0,
				maxRetries: 0,
				abortSignal: AbortSignal.timeout(VLM_REQUEST_TIMEOUT_MS),
				output: Output.object({
					schema:
						jsonSchema<Static<typeof imageToTextOutput>>(imageToTextOutput),
				}),
				system: [
					'You are an AI assistant for image processing inside a RAG system.',
					'Return only the requested JSON object. Do not wrap it in markdown or add text outside JSON.',
					'OCR text may be short. Do not pad, decorate, or invent text to meet a length.',
					`Expected response type: ${JSON.stringify(jsonSchema(imageToTextOutput).jsonSchema.properties)}`,
				].join('\n'),
				prompt: [
					{
						role: 'user',
						content: [
							{ type: 'text', text: 'Assess for the following image.' },
							imagePart(image),
						],
					},
				],
			}),
		);

		return {
			output: result.output,
			usage: result.totalUsage.totalTokens ?? result.usage.totalTokens ?? 0,
		};
	} catch (error) {
		const repaired = await repairImageToTextOutput(error);
		if (repaired) return repaired;

		throw error;
	}
}

async function generateBatchedImageText(
	images: PreparedImage[],
): Promise<{ output: BatchedImageToTextOutput; usage: number }> {
	try {
		const result = await withVlmRateLimit(() =>
			generateText({
				model: VLM_MODEL,
				temperature: 0,
				maxRetries: 0,
				abortSignal: AbortSignal.timeout(VLM_REQUEST_TIMEOUT_MS),
				output: Output.object({
					schema: jsonSchema<Static<typeof batchedImageToTextOutput>>(
						batchedImageToTextOutput,
					),
				}),
				system: [
					'You are an AI assistant for image processing inside a RAG system.',
					'Return only the requested JSON object. Do not wrap it in markdown or add text outside JSON.',
					'OCR text may be short. Do not pad, decorate, or invent text to meet a length.',
					'Assess each image independently. Preserve the exact 1-based image index in each output item.',
					`Expected response type: ${JSON.stringify(jsonSchema(batchedImageToTextOutput).jsonSchema.properties)}`,
				].join('\n'),
				prompt: [
					{
						role: 'user',
						content: [
							{
								type: 'text',
								text: `Assess these ${images.length} images independently. Return one images[] item for each image index.`,
							},
							...images.flatMap((image, i) => [
								{ type: 'text' as const, text: `Image ${i + 1}:` },
								imagePart(image),
							]),
						],
					},
				],
			}),
		);

		return {
			output: result.output,
			usage: result.totalUsage.totalTokens ?? result.usage.totalTokens ?? 0,
		};
	} catch (error) {
		const repaired = await repairBatchedImageToTextOutput(error, images.length);
		if (repaired) return repaired;

		throw error;
	}
}

export async function imgToChunks(
	f: FileLike,
	raw?: { width?: number; height?: number; channels?: 1 | 2 | 3 | 4 },
): Promise<ToStringChunksResult> {
	const prepared = (await prepareImageInputs([{ data: f, raw }]))[0]!;
	const res = await generateImageText(prepared);
	const chunks = await chunksFromImageOutput(res.output);

	// Intentionally inflate token usage due to cost diff vs regular embeddings
	return {
		metadata: raw,
		chunks,
		tokenUsage: res.usage * VLM_OUTPUT_TOKEN_MULTIPLIER,
	};
}

async function prepareImageInputs(
	inputs: ImageToChunksInput[],
): Promise<PreparedImage[]> {
	return Promise.all(inputs.map(prepareImageInput));
}

async function preparedImageToChunks(
	input: PreparedImage,
): Promise<ToStringChunksResult> {
	const res = await generateImageText(input);
	return {
		metadata: input.raw,
		chunks: await chunksFromImageOutput(res.output),
		tokenUsage: res.usage * VLM_OUTPUT_TOKEN_MULTIPLIER,
	};
}

async function safePreparedImageToChunks(
	input: PreparedImage,
	mode: ImageProcessingMode,
): Promise<ToStringChunksResult> {
	try {
		return await preparedImageToChunks(input);
	} catch (error) {
		if (
			mode === 'best-effort' &&
			isIgnorableEmbeddedImageProcessingError(error)
		)
			return { metadata: input.raw, chunks: [], tokenUsage: 0 };

		throw error;
	}
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

function logImageBatchFallback(error: unknown, batch: PreparedImage[]) {
	log('warn', {
		event: 'vlm_image_batch_fallback',
		model: VLM_MODEL_NAME,
		status: getApiCallStatus(error),
		imageDetail: VLM_IMAGE_DETAIL,
		imageCount: batch.length,
		totalBytes: batch.reduce((acc, image) => acc + image.byteLength, 0),
		images: batch.map((image) => ({
			bytes: image.byteLength,
			width: image.width,
			height: image.height,
			mediaType: image.mediaType,
		})),
		message: getProviderErrorSummary(error),
	});
}

export async function imgsToChunks(
	inputs: ImageToChunksInput[],
	mode: ImageProcessingMode = 'strict',
): Promise<ToStringChunksResult[]> {
	const prepared = await prepareImageInputs(inputs);
	const batches = createImageBatches(prepared);
	const batchResults = await Promise.all(
		batches.map(async (batch) => {
			if (batch.length === 1)
				return [await safePreparedImageToChunks(batch[0]!, mode)];

			let res: Awaited<ReturnType<typeof generateBatchedImageText>>;
			try {
				res = await generateBatchedImageText(batch);
			} catch (error) {
				if (!isImageBadRequest(error)) throw error;

				logImageBatchFallback(error, batch);
				return Promise.all(
					batch.map((input) => safePreparedImageToChunks(input, mode)),
				);
			}

			const usagePerImage =
				Math.ceil(res.usage / batch.length) * VLM_OUTPUT_TOKEN_MULTIPLIER;
			const byIndex = new Map<number, ImageToTextOutput>();
			for (const item of res.output.images) byIndex.set(item.index, item);

			return Promise.all(
				batch.map(async (input, batchIndex) => {
					const output = byIndex.get(batchIndex + 1);
					if (!output) return safePreparedImageToChunks(input, mode);

					return {
						metadata: input.raw,
						chunks: await chunksFromImageOutput(output),
						tokenUsage: usagePerImage,
					};
				}),
			);
		}),
	);

	return batchResults.flat();
}
