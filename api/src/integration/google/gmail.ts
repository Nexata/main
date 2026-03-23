import { authPlugin } from '@api/auth';
import { NexataFile } from '@api/file';
import { getMimeTypeFromExt } from '@api/file/lib/types';
import { Google } from '@api/integration/google/lib';
import type { Language } from '@api/schema';
import type { ActiveUser } from '@api/utils/auth';
import { checkTenantCanIngest } from '@api/utils/billing';
import { getTokensForUser, userHasCredential } from '@api/utils/credential';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { Nullish, tObject } from '@api/utils/type';
import { gmail, type gmail_v1 } from '@googleapis/gmail';
import { Elysia, type Static, t } from 'elysia';

export namespace Gmail {
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

	export const fromTokens = (access_token: string, refresh_token: string) => {
		const auth = Google.createOAuth2Client();
		auth.setCredentials({ access_token, refresh_token });
		return gmail({ version: 'v1', auth });
	};

	function getHeader(
		headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
		name: string,
	): string | undefined {
		return (
			headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())
				?.value ?? undefined
		);
	}

	function parseEmailAddress(header: string): { name?: string; email: string } {
		const match = header.match(/^(?:(.+?)\s*)?<([^>]+)>$/);
		if (match) return { name: match[1]?.trim(), email: match[2]! };
		return { email: header.trim() };
	}

	function extractBody(payload?: gmail_v1.Schema$MessagePart): {
		text?: string;
		html?: string;
	} {
		if (!payload) return {};

		const result: { text?: string; html?: string } = {};

		if (payload.mimeType === 'text/plain' && payload.body?.data)
			result.text = Buffer.from(payload.body.data, 'base64url').toString(
				'utf-8',
			);
		else if (payload.mimeType === 'text/html' && payload.body?.data)
			result.html = Buffer.from(payload.body.data, 'base64url').toString(
				'utf-8',
			);
		else if (payload.parts)
			for (const part of payload.parts) {
				const partBody = extractBody(part);
				if (partBody.text && !result.text) result.text = partBody.text;
				if (partBody.html && !result.html) result.html = partBody.html;
			}

		return result;
	}

	function extractAttachments(
		payload?: gmail_v1.Schema$MessagePart,
	): { id: string; filename: string; mimeType: string; size: number }[] {
		if (!payload) return [];

		const attachments: {
			id: string;
			filename: string;
			mimeType: string;
			size: number;
		}[] = [];

		if (payload.filename && payload.body?.attachmentId)
			attachments.push({
				id: payload.body.attachmentId,
				filename: payload.filename,
				mimeType: payload.mimeType ?? 'application/octet-stream',
				size: payload.body.size ?? 0,
			});

		if (payload.parts)
			for (const part of payload.parts)
				attachments.push(...extractAttachments(part));

		return attachments;
	}

	function buildQuery(
		input: Exclude<Static<typeof searchInput>, { pageToken: string }>,
	): string {
		const parts: string[] = [];

		if (input.query) parts.push(input.query);
		if (input.from) parts.push(`from:${input.from}`);
		if (input.to) parts.push(`to:${input.to}`);
		if (input.subject) parts.push(`subject:${input.subject}`);
		if (input.after) parts.push(`after:${input.after.replace(/-/g, '/')}`);
		if (input.before) parts.push(`before:${input.before.replace(/-/g, '/')}`);
		if (input.hasAttachment) parts.push('has:attachment');
		if (input.isUnread === true) parts.push('is:unread');
		if (input.isUnread === false) parts.push('is:read');
		if (input.isStarred) parts.push('is:starred');
		if (input.label) parts.push(`label:${input.label}`);

		return parts.join(' ');
	}

	export const [searchDescription, searchInput] = [
		'Gmail tool to search for emails using Gmail query syntax.',
		t.Union([
			t.Object({
				pageToken: t.String({
					description:
						'Continuation token for pagination. If provided, other params are ignored.',
				}),
			}),
			t.Object({
				query: Nullish(t.String(), {
					description:
						'Gmail search query (e.g., "from:someone@example.com is:unread"). Combines with other filters.',
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
					description: 'Messages after date (YYYY-MM-DD)',
				}),
				before: Nullish(t.String({ format: 'date' }), {
					description: 'Messages before date (YYYY-MM-DD)',
				}),
				hasAttachment: Nullish(t.Boolean(), {
					description: 'Filter for messages with attachments',
				}),
				isUnread: Nullish(t.Boolean(), {
					description: 'Filter by read/unread status',
				}),
				isStarred: Nullish(t.Boolean(), {
					description: 'Filter for starred messages',
				}),
				label: Nullish(t.String(), {
					description:
						'Filter by label name (e.g., "INBOX", "SENT", "IMPORTANT")',
				}),
				maxResults: Nullish(t.Number({ minimum: 1, maximum: 500 }), {
					default: 50,
					description: 'Maximum number of results (max 500)',
				}),
			}),
		]),
	];

	export async function search(
		client: gmail_v1.Gmail,
		input: Static<typeof searchInput>,
	) {
		const res =
			'pageToken' in input
				? await client.users.messages.list({
						userId: 'me',
						pageToken: input.pageToken,
					})
				: await client.users.messages.list({
						userId: 'me',
						q: buildQuery(input),
						maxResults: input.maxResults ?? 50,
					});

		if (res.status !== 200)
			throw httpError(HttpCode.CONFLICT, ErrorCode.EXTERNAL_ERROR);

		const messageIds = res.data.messages ?? [];

		const messages = await Promise.all(
			messageIds.map(async (msg) => {
				const detail = await client.users.messages.get({
					userId: 'me',
					id: msg.id!,
					format: 'METADATA',
					metadataHeaders: ['From', 'To', 'Subject', 'Date'],
				});

				const headers = detail.data.payload?.headers;
				return {
					id: detail.data.id!,
					threadId: detail.data.threadId!,
					subject: getHeader(headers, 'Subject') ?? '',
					from: getHeader(headers, 'From') ?? '',
					to: getHeader(headers, 'To') ?? '',
					date: getHeader(headers, 'Date'),
					snippet: detail.data.snippet ?? '',
					isUnread: detail.data.labelIds?.includes('UNREAD') ?? false,
					hasAttachment:
						detail.data.payload?.parts?.some((p) => !!p.filename) ?? false,
					labels: detail.data.labelIds ?? [],
				};
			}),
		);

		return {
			nextPageToken: res.data.nextPageToken ?? null,
			messages,
		};
	}

	export const [readDescription, readInput] = [
		'Reads a Gmail message by ID, returning full details including headers and body.',
		t.Object({
			messageId: t.String({
				description: 'The Gmail message ID to retrieve',
			}),
			credentialEmail: Nullish(t.String({ format: 'email' }), {
				description:
					'The email address of the Gmail account that owns this message. Should match the credentialEmail from search results.',
			}),
			format: Nullish(
				t.Union([
					t.Literal('full'),
					t.Literal('metadata'),
					t.Literal('minimal'),
				]),
				{
					default: 'full',
					description:
						'Response format: full (with body), metadata (headers only), minimal (IDs only)',
				},
			),
		}),
	];

	export async function read(
		client: gmail_v1.Gmail,
		input: Static<typeof readInput>,
	) {
		const format = input.format ?? 'full';

		const res = await client.users.messages.get({
			userId: 'me',
			id: input.messageId,
			format: format.toUpperCase() as 'FULL' | 'METADATA' | 'MINIMAL',
		});

		if (res.status !== 200)
			throw httpError(HttpCode.CONFLICT, ErrorCode.EXTERNAL_ERROR);

		const data = res.data;
		const headers = data.payload?.headers;

		const fromHeader = getHeader(headers, 'From');
		const toHeader = getHeader(headers, 'To');
		const ccHeader = getHeader(headers, 'Cc');
		const bccHeader = getHeader(headers, 'Bcc');

		const body = format === 'full' ? extractBody(data.payload) : undefined;
		const attachments =
			format === 'full' ? extractAttachments(data.payload) : undefined;

		return {
			id: data.id!,
			threadId: data.threadId!,
			subject: getHeader(headers, 'Subject') ?? '',
			from: fromHeader ? parseEmailAddress(fromHeader) : null,
			to: toHeader
				? toHeader.split(',').map((addr) => parseEmailAddress(addr.trim()))
				: [],
			cc: ccHeader
				? ccHeader.split(',').map((addr) => parseEmailAddress(addr.trim()))
				: undefined,
			bcc: bccHeader
				? bccHeader.split(',').map((addr) => parseEmailAddress(addr.trim()))
				: undefined,
			date: getHeader(headers, 'Date'),
			snippet: data.snippet ?? '',
			body,
			attachments,
			labels: data.labelIds ?? [],
			isUnread: data.labelIds?.includes('UNREAD') ?? false,
			isStarred: data.labelIds?.includes('STARRED') ?? false,
			sizeEstimate: data.sizeEstimate ?? 0,
		};
	}

	async function downloadAttachment(
		client: gmail_v1.Gmail,
		messageId: string,
		attachmentId: string,
	): Promise<ArrayBuffer> {
		const res = await client.users.messages.attachments.get({
			userId: 'me',
			id: attachmentId,
			messageId,
		});

		if (res.status !== 200 || !res.data.data)
			throw httpError(HttpCode.CONFLICT, ErrorCode.EXTERNAL_ERROR);

		return Buffer.from(res.data.data, 'base64url').buffer as ArrayBuffer;
	}

	export const [ingestAttachmentsDescription, ingestAttachmentsInput] = [
		'Gmail tool to ingest (download and process) email attachments into Nexata so their content becomes searchable and readable. Use GmailRead first to see available attachments, then call this tool with the message ID and optionally specific attachment IDs. If attachmentIds is omitted, all attachments on the message are ingested.',
		tObject({
			messageId: t.String({
				description: 'The Gmail message ID containing the attachments.',
			}),
			credentialEmail: Nullish(t.String({ format: 'email' }), {
				description:
					'The email address of the Gmail account that owns this message. Should match the credentialEmail from search or read results.',
			}),
			attachmentIds: Nullish(t.Array(t.String()), {
				description:
					'Specific attachment IDs to ingest. If omitted, all attachments on the message are ingested.',
			}),
		}),
	];

	export async function ingestAttachments(
		client: gmail_v1.Gmail,
		activeUser: ActiveUser,
		input: Static<typeof ingestAttachmentsInput>,
	) {
		const message = await read(client, {
			messageId: input.messageId,
			format: 'full',
		});

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
					attachment.mimeType === 'application/octet-stream'
						? getMimeTypeFromExt(attachment.filename)
						: attachment.mimeType;

				const file = new File([content], attachment.filename, {
					type: resolvedMime,
				});

				const status = await NexataFile.ingest(
					{
						id: fileId,
						userId: activeUser.id,
						slug: activeUser.slug,
						name: attachment.filename,
						type: resolvedMime,
					},
					file,
				);

				results.push({
					filename: attachment.filename,
					status,
					fileId: status === 'OK' ? fileId : undefined,
				});
			} catch {
				results.push({ filename: attachment.filename, status: 'FAILED' });
			}
		}

		return {
			messageId: message.id,
			subject: message.subject,
			results,
		};
	}
}

export const gmailRouter = new Elysia({ prefix: '/gmail' })
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
			return Gmail.search(
				await Gmail.fromRequest(activeUser, credentialId),
				query,
			);
		},
		{
			detail: {
				summary: 'Search gmail',
				description: Gmail.searchDescription,
			},
			params: tObject({ credentialId: t.String({ format: 'uuid' }) }),
			query: Gmail.searchInput,
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
			return Gmail.read(
				await Gmail.fromRequest(activeUser, credentialId),
				query,
			);
		},
		{
			detail: {
				summary: 'Read gmail',
				description: Gmail.readDescription,
			},
			params: tObject({ credentialId: t.String({ format: 'uuid' }) }),
			query: Gmail.readInput,
		},
	);
