import {
	type FileLike,
	mdSplitter,
	type ToStringChunksResult,
} from '@api/file/lib/types';
import {
	type HeadingMetadata,
	type OfficeContentNode,
	parseOffice,
} from 'officeparser';

async function tableNodeToMarkdown(
	_node: OfficeContentNode,
): Promise<[string, number]> {
	// TODO: children rows | cells
	return ['', 0];
}

async function nodeToMarkdown(
	node: OfficeContentNode,
): Promise<[string, number]> {
	switch (node.type) {
		case 'heading':
			return [
				`${'#'.repeat((node.metadata as HeadingMetadata).level ?? 2)} ${node.text}`,
				0,
			];

		case 'table':
			return tableNodeToMarkdown(node);

		case 'list': {
			const parsed = await Promise.all(node.children!.map(nodeToMarkdown));
			return [
				`- ${parsed.map(([md]) => md).join('\n- ')}`,
				parsed.reduce((acc, [_, usage]) => acc + usage, 0),
			];
		}

		// TODO: 'image' | 'chart' | 'drawing' | 'note'

		default:
			return [node.text ?? '---', 0];
	}
}

async function plainOfficeToChunks(
	content: OfficeContentNode[],
	contextualMetadata?: object,
): Promise<ToStringChunksResult> {
	const mdNodes: string[] = [];
	let tokenUsage = 0;

	for (const node of content) {
		const [markdown, usage] = await nodeToMarkdown(node);
		mdNodes.push(markdown);
		tokenUsage += usage;
	}

	const textChunks = await mdSplitter.splitText(mdNodes.join('\n\n'));

	return {
		chunks: textChunks.map((chunk) => ({
			text: chunk,
			metadata: contextualMetadata,
		})),
		tokenUsage,
	};
}

export async function officeToChunks(
	f: FileLike,
): Promise<ToStringChunksResult> {
	const ast = await parseOffice(
		Buffer.from(ArrayBuffer.isView(f) ? f.buffer : f),
		{ outputErrorToConsole: true, extractAttachments: true },
	);

	let tokenUsage = 0;
	const chunks: ToStringChunksResult['chunks'] = [];

	switch (ast.content[0]!.type) {
		case 'sheet':
		case 'page':
		case 'slide': {
			const results = await Promise.all(
				ast.content.map((node, i) =>
					plainOfficeToChunks(node.children!, {
						pageNumber: i + 1,
						...node.metadata,
					}),
				),
			);

			for (const result of results) {
				tokenUsage += result.tokenUsage ?? 0;
				chunks.push(...result.chunks);
			}

			break;
		}

		default: {
			const result = await plainOfficeToChunks(ast.content);
			tokenUsage += result.tokenUsage ?? 0;
			chunks.push(...result.chunks);
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
