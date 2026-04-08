import { imgToChunks, isRelevantImage } from '@api/file/lib/image';
import {
	type FileLike,
	mdSplitter,
	type ToStringChunksResult,
} from '@api/file/lib/types';
import { encode } from '@toon-format/toon';
import mammoth from 'mammoth';
import sharp from 'sharp';
import TurndownService from 'turndown';

export async function docToChunks(f: FileLike): Promise<ToStringChunksResult> {
	const images = new Map<string, Buffer>();

	let { value: html } = await mammoth.convertToHtml(
		{ buffer: Buffer.from(ArrayBuffer.isView(f) ? f.buffer : f) },
		{
			convertImage: mammoth.images.imgElement(async (image) => {
				const id = `%%IMG_${images.size}%%`;
				images.set(id, Buffer.from(await image.read('base64'), 'base64'));
				return { src: id };
			}),
		},
	);

	let usage = 0;
	const textChunks: ToStringChunksResult['chunks'] = [];

	const promises: Promise<unknown>[] = [];
	for (const [id, data] of images)
		promises.push(
			(async () => {
				const imgTag = `<img src="${id}">`;
				let meta: Awaited<ReturnType<typeof sharp.prototype.metadata>>;
				let imgResult: ToStringChunksResult;

				try {
					meta = await sharp(data).metadata();
				} catch {
					return (html = html.replace(imgTag, ''));
				}

				if (!isRelevantImage(meta.width ?? 0, meta.height ?? 0))
					return (html = html.replace(imgTag, ''));

				try {
					imgResult = await imgToChunks(new Uint8Array(data));
				} catch {
					return (html = html.replace(imgTag, ''));
				}

				usage += imgResult.tokenUsage ?? 0;

				if (!imgResult.chunks.length) return (html = html.replace(imgTag, ''));

				const [description, ...ocrTexts] = imgResult.chunks;
				const imgMetadata = {
					source: 'image',
					imageIndex: images.size,
					width: meta.width,
					height: meta.height,
					format: meta.format,
					comments: meta.comments,
				};

				const parts = [
					'**An image is here**',
					description && `[Image] Description: ${description.text}`,
					ocrTexts?.length &&
						`Image OCR: ${ocrTexts.map((c) => c.text).join(' | ')}`,
					`##### Metadata:\n${encode(imgMetadata)}`,
				].filter((x) => typeof x === 'string');

				html = html.replace(imgTag, `<p>${parts.join('\n\n')}</p>`);
			})(),
		);

	await Promise.all(promises);

	const markdown = new TurndownService().turndown(html);
	const markdownChunks = await mdSplitter.splitText(markdown);
	textChunks.push(
		...markdownChunks.map((text) => ({ text, metadata: { source: 'text' } })),
	);

	return {
		metadata: { imageCount: images.size },
		chunks: [...textChunks],
		tokenUsage: usage,
	};
}
