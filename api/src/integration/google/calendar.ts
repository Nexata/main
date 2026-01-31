import { authPlugin } from '@api/auth';
import { Google } from '@api/integration/google/lib';
import type { JwtPayload } from '@api/utils/auth';
import { getTokensForUser, userHasCredential } from '@api/utils/credential';
import { Nullish, tObject } from '@api/utils/type';
import { calendar, type calendar_v3 } from '@googleapis/calendar';
import { Elysia, type Static, t } from 'elysia';
import { HttpError } from 'elysia-logger';

export namespace Calendar {
	export const fromRequest = async (
		activeUser: JwtPayload,
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
		return calendar({ version: 'v3', auth });
	};

	export const [listDescription, listInput] = [
		'Lists all calendars the user has access to.',
		t.Object({
			showHidden: Nullish(t.Boolean(), {
				default: false,
				description: 'Include hidden calendars in the result',
			}),
		}),
	];

	export async function list(
		client: calendar_v3.Calendar,
		input: Static<typeof listInput>,
	) {
		const res = await client.calendarList.list({
			showHidden: input.showHidden ?? false,
		});

		if (res.status !== 200) throw HttpError.Conflict('EXTERNAL_ERROR');

		const calendars =
			res.data.items?.map((cal) => ({
				id: cal.id!,
				summary: cal.summary ?? '',
				description: cal.description ?? undefined,
				timeZone: cal.timeZone ?? undefined,
				colorId: cal.colorId ?? undefined,
				backgroundColor: cal.backgroundColor ?? undefined,
				foregroundColor: cal.foregroundColor ?? undefined,
				accessRole: cal.accessRole ?? undefined,
				primary: cal.primary ?? false,
			})) ?? [];

		return { calendars };
	}

	function formatEventTime(
		eventTime: calendar_v3.Schema$EventDateTime | undefined,
	): { dateTime?: string; date?: string; timeZone?: string } | undefined {
		if (!eventTime) return undefined;
		return {
			dateTime: eventTime.dateTime ?? undefined,
			date: eventTime.date ?? undefined,
			timeZone: eventTime.timeZone ?? undefined,
		};
	}

	function formatAttendee(attendee: calendar_v3.Schema$EventAttendee): {
		email: string;
		displayName?: string;
		responseStatus?: string;
	} {
		return {
			email: attendee.email!,
			displayName: attendee.displayName ?? undefined,
			responseStatus: attendee.responseStatus ?? undefined,
		};
	}

	function formatEventSummary(event: calendar_v3.Schema$Event) {
		return {
			id: event.id!,
			summary: event.summary ?? '',
			description: event.description ?? undefined,
			location: event.location ?? undefined,
			start: formatEventTime(event.start),
			end: formatEventTime(event.end),
			status: event.status ?? undefined,
			htmlLink: event.htmlLink ?? undefined,
			created: event.created ?? undefined,
			updated: event.updated ?? undefined,
			recurrence: event.recurrence ?? undefined,
			recurringEventId: event.recurringEventId ?? undefined,
		};
	}

	export const [eventsDescription, eventsInput] = [
		'Lists calendar events with optional filtering by time range and search query.',
		t.Union([
			t.Object({
				pageToken: t.String({
					description:
						'Continuation token for pagination. If provided, other params are ignored except calendarId.',
				}),
				calendarId: Nullish(t.String(), {
					default: 'primary',
					description: 'Calendar ID to fetch events from (default: primary)',
				}),
			}),
			t.Object({
				calendarId: Nullish(t.String(), {
					default: 'primary',
					description: 'Calendar ID to fetch events from (default: primary)',
				}),
				query: Nullish(t.String(), {
					description: 'Free-text search query for events',
				}),
				timeMin: Nullish(t.String({ format: 'date-time' }), {
					description:
						'Lower bound for event start time (ISO 8601). Defaults to current time.',
				}),
				timeMax: Nullish(t.String({ format: 'date-time' }), {
					description: 'Upper bound for event start time (ISO 8601)',
				}),
				maxResults: Nullish(t.Number({ minimum: 1, maximum: 2500 }), {
					default: 250,
					description: 'Maximum number of events to return (max 2500)',
				}),
				showDeleted: Nullish(t.Boolean(), {
					default: false,
					description: 'Include deleted events',
				}),
			}),
		]),
	];

	export async function events(
		client: calendar_v3.Calendar,
		input: Static<typeof eventsInput>,
	) {
		const calendarId =
			('calendarId' in input ? input.calendarId : undefined) ?? 'primary';

		const res =
			'pageToken' in input
				? await client.events.list({
						calendarId,
						pageToken: input.pageToken,
						singleEvents: true,
						orderBy: 'startTime',
					})
				: await client.events.list({
						calendarId,
						q: input.query ?? undefined,
						timeMin: input.timeMin ?? new Date().toISOString(),
						timeMax: input.timeMax ?? undefined,
						maxResults: input.maxResults ?? 250,
						showDeleted: input.showDeleted ?? false,
						singleEvents: true,
						orderBy: 'startTime',
					});

		if (res.status !== 200) throw HttpError.Conflict('EXTERNAL_ERROR');

		const events = res.data.items?.map(formatEventSummary) ?? [];

		return {
			nextPageToken: res.data.nextPageToken ?? null,
			events,
		};
	}

	export const [readDescription, readInput] = [
		'Reads a single calendar event by ID, returning full details including attendees.',
		t.Object({
			eventId: t.String({
				description: 'The calendar event ID to retrieve',
			}),
			calendarId: Nullish(t.String(), {
				default: 'primary',
				description: 'Calendar ID the event belongs to (default: primary)',
			}),
		}),
	];

	export async function read(
		client: calendar_v3.Calendar,
		input: Static<typeof readInput>,
	) {
		const res = await client.events.get({
			calendarId: input.calendarId ?? 'primary',
			eventId: input.eventId,
		});

		if (res.status !== 200) throw HttpError.Conflict('EXTERNAL_ERROR');

		const event = res.data;

		return {
			id: event.id!,
			summary: event.summary ?? '',
			description: event.description ?? undefined,
			location: event.location ?? undefined,
			start: formatEventTime(event.start),
			end: formatEventTime(event.end),
			status: event.status ?? undefined,
			htmlLink: event.htmlLink ?? undefined,
			created: event.created ?? undefined,
			updated: event.updated ?? undefined,
			creator: event.creator
				? {
						email: event.creator.email ?? undefined,
						displayName: event.creator.displayName ?? undefined,
						self: event.creator.self ?? false,
					}
				: undefined,
			organizer: event.organizer
				? {
						email: event.organizer.email ?? undefined,
						displayName: event.organizer.displayName ?? undefined,
						self: event.organizer.self ?? false,
					}
				: undefined,
			attendees: event.attendees?.map(formatAttendee) ?? [],
			recurrence: event.recurrence ?? undefined,
			recurringEventId: event.recurringEventId ?? undefined,
			visibility: event.visibility ?? undefined,
			iCalUID: event.iCalUID ?? undefined,
			hangoutLink: event.hangoutLink ?? undefined,
			conferenceData: event.conferenceData
				? {
						entryPoints:
							event.conferenceData.entryPoints?.map((ep) => ({
								entryPointType: ep.entryPointType ?? undefined,
								uri: ep.uri ?? undefined,
								label: ep.label ?? undefined,
							})) ?? [],
					}
				: undefined,
			attachments:
				event.attachments?.map((a) => ({
					fileUrl: a.fileUrl ?? undefined,
					title: a.title ?? undefined,
					mimeType: a.mimeType ?? undefined,
				})) ?? [],
		};
	}
}

export const calendarRouter = new Elysia({ prefix: '/calendar' })
	.use(authPlugin())
	.get(
		'/list/:credentialId',
		async ({ params: { credentialId }, query, activeUser }) => {
			const hasPermission = await userHasCredential(activeUser, credentialId);
			if (!hasPermission) throw HttpError.Forbidden('NO_CREDENTIAL_PERMISSION');
			return Calendar.list(
				await Calendar.fromRequest(activeUser, credentialId),
				query,
			);
		},
		{
			detail: {
				summary: 'List calendars',
				description: Calendar.listDescription,
			},
			params: tObject({ credentialId: t.String({ format: 'uuid' }) }),
			query: Calendar.listInput,
		},
	)
	.get(
		'/events/:credentialId',
		async ({ params: { credentialId }, query, activeUser }) => {
			const hasPermission = await userHasCredential(activeUser, credentialId);
			if (!hasPermission) throw HttpError.Forbidden('NO_CREDENTIAL_PERMISSION');
			return Calendar.events(
				await Calendar.fromRequest(activeUser, credentialId),
				query,
			);
		},
		{
			detail: {
				summary: 'List calendar events',
				description: Calendar.eventsDescription,
			},
			params: tObject({ credentialId: t.String({ format: 'uuid' }) }),
			query: Calendar.eventsInput,
		},
	)
	.get(
		'/event/:credentialId',
		async ({ params: { credentialId }, query, activeUser }) => {
			const hasPermission = await userHasCredential(activeUser, credentialId);
			if (!hasPermission) throw HttpError.Forbidden('NO_CREDENTIAL_PERMISSION');
			return Calendar.read(
				await Calendar.fromRequest(activeUser, credentialId),
				query,
			);
		},
		{
			detail: {
				summary: 'Read calendar event',
				description: Calendar.readDescription,
			},
			params: tObject({ credentialId: t.String({ format: 'uuid' }) }),
			query: Calendar.readInput,
		},
	);
