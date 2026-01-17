import { EMBEDDING_SIZE, VLM_MODEL } from '@api/env';
import {
	type FileLike,
	mdSplitter,
	type ToStringChunksResult,
} from '@api/file/lib/types';
import { Nullish, tObject } from '@api/utils/type';
import { generateText, jsonSchema, Output } from 'ai';
import { type Static, t } from 'elysia';
import sharp from 'sharp';

export function isRelevantImage(width: number, height: number) {
	if (!width || !height) return false;

	const isTooSmall = width < 300 && height < 300;

	const ratio = width / height;
	const isExtremeRatio = ratio > 3 || ratio < 0.33;

	return !isTooSmall && !isExtremeRatio;
}

const imageToTextOutput = tObject({
	hasValue: t.Boolean({
		description:
			"Whether the image has a semantic or logical value on it's own. This will decide whether the image should be included in the final RAG pipeline. i.e. logos, icons, separators, etc. do not have semantic value. Charts, graphs, tables, diagrams and even general pictures often have semantic value. If unsure, assume it has semantic value.",
	}),
	description: Nullish(
		t.String({
			maxLength: EMBEDDING_SIZE,
			description:
				'A large description of the image, emphasizing its key semantic features. This will be vectorized and used for semantic search.',
		}),
	),
	ocr: Nullish(t.String({ minLength: 10 }), {
		description:
			'The text directly extracted from the image, if any. Use markdown syntax to format to represent text style in the image.',
	}),
});

export async function imgToChunks(
	f: FileLike,
	raw?: { width: number; height: number; channels: 1 | 2 | 3 | 4 },
): Promise<ToStringChunksResult> {
	const image = raw
		? await sharp(f, { raw }).png().toBuffer()
		: new Uint8Array(f);

	const res = await generateText({
		model: VLM_MODEL,
		output: Output.object({
			schema: jsonSchema<Static<typeof imageToTextOutput>>(imageToTextOutput),
		}),
		system:
			'You are an AI assistant for image processing inside a RAG system. Expected response type: ' +
			// FIX PARA DEEPINFRA FALLBACK
			JSON.stringify(jsonSchema(imageToTextOutput).jsonSchema.properties),
		prompt: [
			{
				role: 'user',
				content: [
					{ type: 'text', text: 'Assess for the following image.' },
					{ type: 'image', image },
				],
			},
		],
	});

	const chunks: string[] = [];
	const usage = res.totalUsage.totalTokens ?? res.usage.totalTokens ?? 0;

	if (res.output.hasValue) {
		if (res.output.description) chunks.push(res.output.description);
		if (res.output.ocr)
			chunks.push(...(await mdSplitter.splitText(res.output.ocr)));
	}

	return [chunks, usage];
}
