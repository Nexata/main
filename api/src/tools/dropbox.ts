import type { CachedCredential } from '@api/utils/credential';
import { Nullish, tObject } from '@api/utils/type';
import type { Static } from '@sinclair/typebox';
import { jsonSchema, tool } from 'ai';
import { Dropbox } from 'dropbox';
import { t } from 'elysia';

export enum FileCategory {
	IMAGE = 'image',
	DOCUMENT = 'document',
	PDF = 'pdf',
	SPREADSHEET = 'spreadsheet',
	PRESENTATION = 'presentation',
	AUDIO = 'audio',
	VIDEO = 'video',
	FOLDER = 'folder',
	PAPER = 'paper',
	OTHERS = 'others',
	OTHER = 'other',
}

const DropboxFilesSearchInput = tObject({
	query: t.String({
		minLength: 1,
		description:
			'The string to search for. May match across multiple fields based on the request arguments.',
	}),
	path: Nullish(t.String(), {
		description:
			"Scopes the search to a path in the user's Dropbox. Searches the entire Dropbox if not specified.",
	}),
	fileExtensions: Nullish(t.Array(t.String()), {
		description: 'Restricts search to only the extensions specified.',
	}),
	fileCategories: Nullish(t.Array(t.Enum(FileCategory)), {
		description: 'Restricts search to only the categories specified.',
	}),
});

export const dropboxFilesSearchTool = (credentials: CachedCredential[]) =>
	tool({
		description: 'Dropbox tool to search for files using filesSearchV2.',
		inputSchema: jsonSchema<Static<typeof DropboxFilesSearchInput>>(
			DropboxFilesSearchInput,
		),
		execute: async (input) => {
			const promises = [];

			for (const credential of credentials)
				promises.push(
					new Dropbox({ accessToken: credential.accessToken }).filesSearchV2({
						query: input.query,
						match_field_options: { include_highlights: true },
						options: {
							max_results: 200,
							path: input.path ?? undefined,
							file_categories:
								input.fileCategories?.map((c) => ({ '.tag': c })) ?? undefined,
						},
					}),
				);

			return (await Promise.all(promises)).map((r, i) => ({
				credentialOwnedBy: credentials.at(i)?.ownedBy,
				results: r.result,
			}));
		},
	});
