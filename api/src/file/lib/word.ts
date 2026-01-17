import { imgToChunks, isRelevantImage } from '@api/file/lib/image';
import {
	type FileLike,
	mdSplitter,
	type ToStringChunksResult,
} from '@api/file/lib/types';
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

	const promises: Promise<unknown>[] = [];
	for (const [id, data] of images)
		promises.push(
			(async () => {
				const [meta, imgTag] = [
					await sharp(data).metadata(),
					`<img src="${id}">`,
				];

				if (!isRelevantImage(meta.width ?? 0, meta.height ?? 0))
					return (html = html.replace(imgTag, ''));

				const [chunks, imgUsage] = await imgToChunks(new Uint8Array(data), {
					width: meta.width,
					height: meta.height,
					channels: meta.channels ?? 3,
				});

				usage += imgUsage;

				if (!chunks.length) return (html = html.replace(imgTag, ''));

				const [description, ...ocrTexts] = chunks;
				const parts = [
					'**An image is here**',
					`[Image] Description: ${description}`,
					ocrTexts.length && `Image OCR: ${ocrTexts.join(' | ')}`,
				].filter((x) => typeof x === 'string');

				html = html.replace(imgTag, `<p>${parts.join('\n')}</p>`);
			})(),
		);

	await Promise.all(promises);

	const markdown = new TurndownService().turndown(html);
	return [await mdSplitter.splitText(markdown), usage];
}
