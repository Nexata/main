import { authPlugin } from '@api/auth';
import { Microsoft } from '@api/integration/microsoft/lib';
import type { Language } from '@api/schema';
import type { ActiveUser } from '@api/utils/auth';
import { getTokensForUser, userHasCredential } from '@api/utils/credential';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { Nullish, tObject } from '@api/utils/type';
import type { Client } from '@microsoft/microsoft-graph-client';
import type {
	Attachment,
	Message,
	Recipient,
} from '@microsoft/microsoft-graph-types';
import { Elysia, type Static, t } from 'elysia';

export namespace Outlook {
	export const fromRequest = async (
		activeUser: ActiveUser,
		credentialId: string,
		adminExpected?: true,
	) => {
		const { at, rt } = await getTokensForUser(
			activeUser,
			credentialId,
			adminExpected,
		);

		return fromTokens(at, rt);
	};

	export const fromTokens = (accessToken: string, refreshToken: string) =>
		Microsoft.fromTokens(accessToken, refreshToken);

	function parseRecipient(
		r: Recipient | null | undefined,
	): { name?: string; email: string } | null {
		if (!r?.emailAddress?.address) return null;
		return {
			name: r.emailAddress.name ?? undefined,
			email: r.emailAddress.address,
		};
	}

	function parseRecipients(
		recipients: Recipient[] | null | undefined,
	): { name?: string; email: string }[] {
		if (!recipients) return [];
		return recipients
			.map(parseRecipient)
			.filter((r): r is { name?: string; email: string } => r !== null);
	}

	function buildSearch(
		input: Exclude<Static<typeof searchInput>, { nextLink: string }>,
	): string {
		const parts: string[] = [];

		if (input.query) parts.push(input.query);
		if (input.from) parts.push(`from:${input.from}`);
		if (input.to) parts.push(`to:${input.to}`);
		if (input.subject) parts.push(`subject:${input.subject}`);
		if (input.after) parts.push(`received>=${input.after}`);
		if (input.before) parts.push(`received<=${input.before}`);
		if (input.hasAttachment) parts.push('hasattachment:true');
		if (input.isUnread === true) parts.push('is:unread');
		if (input.isUnread === false) parts.push('is:read');
		if (input.importance) parts.push(`importance:${input.importance}`);

		return parts.join(' ');
	}

	const MESSAGE_SELECT = [
		'id',
		'subject',
		'from',
		'toRecipients',
		'receivedDateTime',
		'bodyPreview',
		'isRead',
		'hasAttachments',
		'importance',
		'flag',
		'conversationId',
		'parentFolderId',
	].join(',');

	export const [searchDescription, searchInput] = [
		'Outlook tool to search for emails using Microsoft Graph. Supports KQL (Keyword Query Language) search syntax for filtering by sender, recipient, subject, date, attachments, read status, and importance.',
		t.Union([
			t.Object({
				nextLink: t.String({
					description:
						'Continuation URL for pagination. If provided, other params are ignored.',
				}),
			}),
			t.Object({
				query: Nullish(t.String(), {
					description:
						'KQL search query (e.g., "budget report", "from:someone@example.com"). Combines with other filters.',
				}),
				from: Nullish(t.String(), {
					description: 'Filter by sender email or name',
				}),
				to: Nullish(t.String(), {
					description: 'Filter by recipient email or name',
				}),
				subject: Nullish(t.String(), {
					description: 'Filter by subject content',
				}),
				after: Nullish(t.String({ format: 'date' }), {
					description: 'Messages received after date (YYYY-MM-DD)',
				}),
				before: Nullish(t.String({ format: 'date' }), {
					description: 'Messages received before date (YYYY-MM-DD)',
				}),
				hasAttachment: Nullish(t.Boolean(), {
					description: 'Filter for messages with attachments',
				}),
				isUnread: Nullish(t.Boolean(), {
					description: 'Filter by read/unread status',
				}),
				importance: Nullish(
					t.Union([t.Literal('low'), t.Literal('normal'), t.Literal('high')]),
					{ description: 'Filter by importance level' },
				),
				folder: Nullish(t.String(), {
					description:
						'Well-known folder name (e.g., "Inbox", "SentItems", "Drafts", "DeletedItems", "Archive", "JunkEmail")',
				}),
				maxResults: Nullish(t.Number({ minimum: 1, maximum: 1000 }), {
					default: 50,
					description: 'Maximum number of results (max 1000)',
				}),
			}),
		]),
	];

	export async function search(
		client: Client,
		input: Static<typeof searchInput>,
	) {
		let response: { value?: Message[]; '@odata.nextLink'?: string };

		if ('nextLink' in input) {
			response = await client.api(input.nextLink).get();
		} else {
			const searchQuery = buildSearch(input);
			const top = input.maxResults ?? 50;
			const basePath = input.folder
				? `/me/mailFolders/${input.folder}/messages`
				: '/me/messages';

			let request = client.api(basePath).select(MESSAGE_SELECT).top(top);

			request = searchQuery
				? request.search(`"${searchQuery}"`)
				: request.orderby('receivedDateTime DESC');

			response = await request.get();
		}

		const messages = (response.value ?? []).map((msg) => ({
			id: msg.id!,
			conversationId: msg.conversationId ?? null,
			subject: msg.subject ?? '',
			from: parseRecipient(msg.from),
			to: parseRecipients(msg.toRecipients),
			date: msg.receivedDateTime ?? null,
			snippet: msg.bodyPreview ?? '',
			isUnread: !(msg.isRead ?? true),
			hasAttachments: msg.hasAttachments ?? false,
			importance: msg.importance ?? 'normal',
			flag: msg.flag?.flagStatus ?? 'notFlagged',
			parentFolderId: msg.parentFolderId ?? null,
		}));

		return {
			nextLink: response['@odata.nextLink'] ?? null,
			messages,
		};
	}

	const READ_SELECT = [
		'id',
		'conversationId',
		'subject',
		'from',
		'toRecipients',
		'ccRecipients',
		'bccRecipients',
		'body',
		'bodyPreview',
		'receivedDateTime',
		'sentDateTime',
		'isRead',
		'hasAttachments',
		'importance',
		'flag',
		'parentFolderId',
		'attachments',
	].join(',');

	export const [readDescription, readInput] = [
		'Reads an Outlook email message by ID, returning full details including headers, body, and attachments.',
		t.Object({
			messageId: t.String({
				description: 'The Outlook message ID to retrieve',
			}),
		}),
	];

	export async function read(client: Client, input: Static<typeof readInput>) {
		const msg: Message = await client
			.api(`/me/messages/${input.messageId}`)
			.select(READ_SELECT)
			.header('Prefer', 'outlook.body-content-type="text"')
			.get();

		const attachments = (msg.attachments ?? []).map((a: Attachment) => ({
			id: a.id!,
			name: a.name ?? 'unknown',
			contentType: a.contentType ?? 'application/octet-stream',
			size: a.size ?? 0,
			isInline: a.isInline ?? false,
		}));

		return {
			id: msg.id!,
			conversationId: msg.conversationId ?? null,
			subject: msg.subject ?? '',
			from: parseRecipient(msg.from),
			to: parseRecipients(msg.toRecipients),
			cc: parseRecipients(msg.ccRecipients),
			bcc: parseRecipients(msg.bccRecipients),
			date: msg.receivedDateTime ?? null,
			sentDate: msg.sentDateTime ?? null,
			snippet: msg.bodyPreview ?? '',
			body: msg.body?.content ?? null,
			hasAttachments: msg.hasAttachments ?? false,
			attachments,
			isUnread: !(msg.isRead ?? true),
			importance: msg.importance ?? 'normal',
			flag: msg.flag?.flagStatus ?? 'notFlagged',
			parentFolderId: msg.parentFolderId ?? null,
		};
	}
}

export const outlookRouter = new Elysia({ prefix: '/outlook' })
	.use(authPlugin())
	.get(
		'/search/:credentialId',
		async ({ params: { credentialId }, query, activeUser }) => {
			const hasPermission = await userHasCredential(activeUser, credentialId);
			if (!hasPermission)
				throw httpError(
					HttpCode.FORBIDDEN,
					ErrorCode.NO_CREDENTIAL_PERMISSION,
					activeUser.language as Language,
				);
			return Outlook.search(
				await Outlook.fromRequest(activeUser, credentialId),
				query,
			);
		},
		{
			detail: {
				summary: 'Search outlook',
				description: Outlook.searchDescription,
			},
			params: tObject({ credentialId: t.String({ format: 'uuid' }) }),
			query: Outlook.searchInput,
		},
	)
	.get(
		'/:credentialId',
		async ({ params: { credentialId }, query, activeUser }) => {
			const hasPermission = await userHasCredential(activeUser, credentialId);
			if (!hasPermission)
				throw httpError(
					HttpCode.FORBIDDEN,
					ErrorCode.NO_CREDENTIAL_PERMISSION,
					activeUser.language as Language,
				);
			return Outlook.read(
				await Outlook.fromRequest(activeUser, credentialId),
				query,
			);
		},
		{
			detail: {
				summary: 'Read outlook',
				description: Outlook.readDescription,
			},
			params: tObject({ credentialId: t.String({ format: 'uuid' }) }),
			query: Outlook.readInput,
		},
	);
