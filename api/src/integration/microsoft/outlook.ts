import { authPlugin } from '@api/auth';
import { NexataFile } from '@api/file';
import { getMimeTypeFromExt } from '@api/file/lib/types';
import { Microsoft } from '@api/integration/microsoft/lib';
import type { Language } from '@api/schema';
import type { ActiveUser } from '@api/utils/auth';
import { checkTenantCanIngest } from '@api/utils/billing';
import { getTokensForUser, userHasCredential } from '@api/utils/credential';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { Nullish, tObject } from '@api/utils/type';
import type { Client } from '@microsoft/microsoft-graph-client';
import type {
	Attachment,
	FileAttachment,
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
			.api(`/me/messages/${input.messageId.replace(/\//g, '-')}`)
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

	async function downloadAttachment(
		client: Client,
		messageId: string,
		attachmentId: string,
	): Promise<ArrayBuffer> {
		const attachment: FileAttachment = await client
			.api(`/me/messages/${messageId}/attachments/${attachmentId}`)
			.get();

		if (!attachment.contentBytes)
			throw httpError(HttpCode.CONFLICT, ErrorCode.EXTERNAL_ERROR);

		return Buffer.from(attachment.contentBytes, 'base64').buffer as ArrayBuffer;
	}

	export const [ingestAttachmentsDescription, ingestAttachmentsInput] = [
		'Outlook tool to ingest (download and process) email attachments into Nexata so their content becomes searchable and readable. Use OutlookRead first to see available attachments, then call this tool with the message ID and optionally specific attachment IDs. If attachmentIds is omitted, all attachments on the message are ingested.',
		tObject({
			messageId: t.String({
				description: 'The Outlook message ID containing the attachments.',
			}),
			credentialEmail: Nullish(t.String({ format: 'email' }), {
				description:
					'The email address of the Outlook account that owns this message. Should match the credentialEmail from search or read results.',
			}),
			attachmentIds: Nullish(t.Array(t.String()), {
				description:
					'Specific attachment IDs to ingest. If omitted, all attachments on the message are ingested.',
			}),
		}),
	];

	export async function ingestAttachments(
		client: Client,
		activeUser: ActiveUser,
		input: Static<typeof ingestAttachmentsInput>,
	) {
		const message = await read(client, { messageId: input.messageId });

		if (!message.attachments?.length)
			throw httpError(
				HttpCode.NOT_FOUND,
				ErrorCode.FILE_NOT_FOUND,
				activeUser.language as Language,
			);

		const targets = input.attachmentIds?.length
			? message.attachments.filter((a) => input.attachmentIds!.includes(a.id))
			: message.attachments;

		if (!targets.length)
			throw httpError(
				HttpCode.NOT_FOUND,
				ErrorCode.FILE_NOT_FOUND,
				activeUser.language as Language,
			);

		const blockReason = await checkTenantCanIngest(activeUser.slug);
		if (blockReason)
			throw httpError(
				blockReason === ErrorCode.PAYMENT_REQUIRED
					? HttpCode.PAYMENT_REQUIRED
					: HttpCode.PRECONDITION_FAILED,
				ErrorCode[blockReason as keyof typeof ErrorCode],
				activeUser.language as Language,
			);

		const results: { filename: string; status: string; fileId?: string }[] = [];

		for (const attachment of targets) {
			const fileId = crypto.randomUUID();
			try {
				const content = await downloadAttachment(
					client,
					input.messageId,
					attachment.id,
				);

				const resolvedMime =
					attachment.contentType === 'application/octet-stream'
						? getMimeTypeFromExt(attachment.name)
						: attachment.contentType;

				const file = new File([content], attachment.name, {
					type: resolvedMime,
				});

				const status = await NexataFile.ingest(
					{
						id: fileId,
						userId: activeUser.id,
						slug: activeUser.slug,
						name: attachment.name,
						type: resolvedMime,
					},
					file,
				);

				results.push({
					filename: attachment.name,
					status,
					fileId: status === 'OK' ? fileId : undefined,
				});
			} catch {
				results.push({ filename: attachment.name, status: 'FAILED' });
			}
		}

		return {
			messageId: message.id,
			subject: message.subject,
			results,
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
