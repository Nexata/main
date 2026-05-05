import { VLM_MODEL } from '@api/env';
import {
	type FileLike,
	mdSplitter,
	type ToStringChunksResult,
} from '@api/file/lib/types';
import { withVlmRateLimit } from '@api/utils/ai-rate-limit';
import { tObject } from '@api/utils/type';
import {
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
type PreparedImage = { image: Uint8Array; raw?: RawImageMetadata };

export type ImageToChunksInput = { data: FileLike; raw?: RawImageMetadata };

const VLM_IMAGE_MAX_DIMENSION = Number(
	process.env.VLM_IMAGE_MAX_DIMENSION ?? 1600,
);
const VLM_IMAGE_MAX_BYTES = Number(process.env.VLM_IMAGE_MAX_BYTES ?? 950_000);
const VLM_IMAGE_BATCH_SIZE = Math.min(
	2,
	Math.max(1, Number(process.env.VLM_IMAGE_BATCH_SIZE ?? 2)),
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

async function prepareImageForVlm(image: FileLike): Promise<Uint8Array> {
	const bytes = fileLikeToUint8Array(image);
	if (bytes.byteLength <= VLM_IMAGE_MAX_BYTES) return bytes;

	const pipeline = sharp(bytes).rotate().resize({
		width: VLM_IMAGE_MAX_DIMENSION,
		height: VLM_IMAGE_MAX_DIMENSION,
		fit: 'inside',
		withoutEnlargement: true,
	});

	const jpeg = await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
	if (jpeg.byteLength <= bytes.byteLength) return new Uint8Array(jpeg);

	return bytes;
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

	return { image: await prepareImageForVlm(sourceImage), raw: input.raw };
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

	const normalized = images
		.map((item) => {
			if (!item || typeof item !== 'object') return null;

			const image = item as Record<string, unknown>;
			const index = typeof image.index === 'number' ? image.index : null;
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
	image: Uint8Array,
): Promise<{ output: ImageToTextOutput; usage: number }> {
	try {
		const result = await withVlmRateLimit(() =>
			generateText({
				model: VLM_MODEL,
				temperature: 0,
				maxRetries: 0,
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
							{ type: 'image', image },
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
	images: Uint8Array[],
): Promise<{ output: BatchedImageToTextOutput; usage: number }> {
	try {
		const result = await withVlmRateLimit(() =>
			generateText({
				model: VLM_MODEL,
				temperature: 0,
				maxRetries: 0,
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
								{ type: 'image' as const, image },
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
	const res = await generateImageText(prepared.image);
	const chunks = await chunksFromImageOutput(res.output);

	// Intentionally inflate token usage due to cost diff vs regular embeddings
	return { metadata: raw, chunks, tokenUsage: res.usage * 20 };
}

async function prepareImageInputs(
	inputs: ImageToChunksInput[],
): Promise<PreparedImage[]> {
	return Promise.all(inputs.map(prepareImageInput));
}

async function preparedImageToChunks(
	input: PreparedImage,
): Promise<ToStringChunksResult> {
	const res = await generateImageText(input.image);
	return {
		metadata: input.raw,
		chunks: await chunksFromImageOutput(res.output),
		tokenUsage: res.usage * 20,
	};
}

export async function imgsToChunks(
	inputs: ImageToChunksInput[],
): Promise<ToStringChunksResult[]> {
	const results: ToStringChunksResult[] = [];

	for (let i = 0; i < inputs.length; i += VLM_IMAGE_BATCH_SIZE) {
		const batch = await prepareImageInputs(
			inputs.slice(i, i + VLM_IMAGE_BATCH_SIZE),
		);

		if (batch.length === 1) {
			results.push(await preparedImageToChunks(batch[0]!));
			continue;
		}

		let res: Awaited<ReturnType<typeof generateBatchedImageText>>;
		try {
			res = await generateBatchedImageText(batch.map(({ image }) => image));
		} catch (error) {
			if (!NoObjectGeneratedError.isInstance(error)) throw error;

			for (const input of batch)
				results.push(await preparedImageToChunks(input));
			continue;
		}

		const usagePerImage = Math.ceil(res.usage / batch.length) * 20;
		const byIndex = new Map<number, ImageToTextOutput>();
		for (const item of res.output.images) byIndex.set(item.index, item);

		for (let batchIndex = 0; batchIndex < batch.length; batchIndex++) {
			const input = batch[batchIndex]!;
			const output = byIndex.get(batchIndex + 1);
			if (!output) {
				results.push(await preparedImageToChunks(input));
				continue;
			}

			results.push({
				metadata: input.raw,
				chunks: await chunksFromImageOutput(output),
				tokenUsage: usagePerImage,
			});
		}
	}

	return results;
}
