import { imgToChunks, isRelevantImage } from '@api/file/lib/image';
import {
	type FileLike,
	mdSplitter,
	type ToStringChunksResult,
} from '@api/file/lib/types';
import { encode } from '@toon-format/toon';
import { markdownTable } from 'markdown-table';
import {
	type CellMetadata,
	type HeadingMetadata,
	type ImageMetadata,
	type OfficeAttachment,
	type OfficeContentNode,
	parseOffice,
} from 'officeparser';
import sharp from 'sharp';

async function tableNodeToMarkdown(
	rows: OfficeContentNode[],
	attachments?: OfficeAttachment[],
): Promise<[string, number]> {
	const mdTable: string[][] = Array(rows.length).fill([]);
	let tokenUsage = 0;

	for (const row of rows) {
		const mdCells = await Promise.all(
			row.children!.map((r) => nodeToMarkdown(r, attachments)),
		);

		for (let i = 0; i < mdCells.length; i++) {
			const [mdCellText, cellTokenUsage] = mdCells[i]!;
			tokenUsage += cellTokenUsage;

			const cellMetadata = row.children![i]!.metadata as CellMetadata;
			mdTable[cellMetadata.row]![cellMetadata.col] = mdCellText;
		}
	}

	return [markdownTable(mdTable), tokenUsage];
}

async function nodeToMarkdown(
	node: OfficeContentNode,
	attachments?: OfficeAttachment[],
): Promise<[string, number]> {
	switch (node.type) {
		case 'heading':
			return [
				`${'#'.repeat((node.metadata as HeadingMetadata).level ?? 2)} ${node.text}`,
				0,
			];

		case 'table':
			return tableNodeToMarkdown(node.children!);

		case 'list': {
			const parsed = await Promise.all(
				node.children!.map((r) => nodeToMarkdown(r, attachments)),
			);

			return [
				`- ${parsed.map(([md]) => md).join('\n- ')}`,
				parsed.reduce((acc, [_, usage]) => acc + usage, 0),
			];
		}

		case 'image': {
			const metadata = node.metadata as ImageMetadata;
			const image = attachments?.find(
				(a) => a.name === metadata.attachmentName,
			);

			if (!image) return [node.text ?? '---', 0];

			const imgBuffer = Buffer.from(image.data, 'base64');
			const meta = await sharp(imgBuffer).metadata();
			if (!isRelevantImage(meta.width ?? 0, meta.height ?? 0)) return ['', 0];

			const imgResult = await imgToChunks(imgBuffer, {
				width: meta.width,
				height: meta.height,
				channels: meta.channels ?? 3,
			});

			if (!imgResult.chunks.length) return ['', 0];

			const [description, ...ocrTexts] = imgResult.chunks;
			const imgMetadata = {
				source: 'image',
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

			return [parts.join('\n\n'), imgResult.tokenUsage ?? 0];
		}

		// ? 'chart' | 'drawing

		case 'note':
			return [`> Note: ${node.text ?? '_empty comment_'}`, 0];

		default:
			return [node.text ?? '---', 0];
	}
}

async function spreadsheetToChunks(
	content: OfficeContentNode[],
	contextualMetadata?: object,
	attachments?: OfficeAttachment[],
): Promise<ToStringChunksResult> {
	const [md, tokenUsage] = await tableNodeToMarkdown(content, attachments);
	const textChunks = await mdSplitter.splitText(md);

	return {
		chunks: textChunks.map((chunk) => ({
			text: chunk,
			metadata: contextualMetadata,
		})),
		tokenUsage,
	};
}

async function plainOfficeToChunks(
	content: OfficeContentNode[],
	metadata?: object,
	attachments?: OfficeAttachment[],
): Promise<ToStringChunksResult> {
	const mdNodes: string[] = [];
	let tokenUsage = 0;

	const results = await Promise.all(
		content.map((node) => nodeToMarkdown(node, attachments)),
	);

	for (const [md, usage] of results) {
		mdNodes.push(md);
		tokenUsage += usage;
	}

	const textChunks = await mdSplitter.splitText(mdNodes.join('\n\n'));
	return {
		chunks: textChunks.map((chunk) => ({ text: chunk, metadata })),
		tokenUsage,
	};
}

export async function officeToChunks(
	f: FileLike,
): Promise<ToStringChunksResult> {
	let tokenUsage = 0;
	const chunks: ToStringChunksResult['chunks'] = [];
	const accumulateResults = (results: ToStringChunksResult[]) =>
		results.forEach((r) => {
			tokenUsage += r.tokenUsage ?? 0;
			chunks.push(...r.chunks);
		});

	const ast = await parseOffice(
		Buffer.from(ArrayBuffer.isView(f) ? f.buffer : f),
		{ outputErrorToConsole: true, extractAttachments: true },
	);

	switch (ast.content[0]!.type) {
		case 'sheet': {
			accumulateResults(
				await Promise.all(
					ast.content.map((node, i) =>
						spreadsheetToChunks(
							node.children!,
							{
								sheetNumber: i + 1,
								...node.metadata,
							},
							ast.attachments,
						),
					),
				),
			);
			break;
		}

		case 'page':
		case 'slide': {
			accumulateResults(
				await Promise.all(
					ast.content.map((node, i) =>
						plainOfficeToChunks(
							node.children!,
							{
								sheetNumber: i + 1,
								...node.metadata,
							},
							ast.attachments,
						),
					),
				),
			);
			break;
		}

		default: {
			accumulateResults([
				await plainOfficeToChunks(ast.content, undefined, ast.attachments),
			]);
			break;
		}
	}

	return {
		metadata: {
			title: ast.metadata.title,
			author: ast.metadata.author,
			description: ast.metadata.description,
			subject: ast.metadata.subject,
			pages: ast.metadata.pages,
		},
		chunks,
		tokenUsage,
	};
}
