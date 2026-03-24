import { authPlugin } from '@api/auth';
import { Microsoft } from '@api/integration/microsoft/lib';
import type { Language } from '@api/schema';
import type { ActiveUser } from '@api/utils/auth';
import { getTokensForUser, userHasCredential } from '@api/utils/credential';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { Nullish, tObject } from '@api/utils/type';
import type { Client } from '@microsoft/microsoft-graph-client';
import type {
	Attendee,
	DateTimeTimeZone,
	Event,
	Calendar as GraphCalendar,
	Location,
	Recipient,
} from '@microsoft/microsoft-graph-types';
import { Elysia, type Static, t } from 'elysia';

export namespace MicrosoftCalendar {
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

	function formatDateTime(
		dt: DateTimeTimeZone | null | undefined,
	): { dateTime?: string; timeZone?: string } | undefined {
		if (!dt) return undefined;
		return {
			dateTime: dt.dateTime ?? undefined,
			timeZone: dt.timeZone ?? undefined,
		};
	}

	function formatLocation(
		loc: Location | null | undefined,
	):
		| { displayName?: string; address?: string; locationType?: string }
		| undefined {
		if (!loc) return undefined;
		const addr = loc.address;
		const addressParts = [
			addr?.street,
			addr?.city,
			addr?.state,
			addr?.postalCode,
			addr?.countryOrRegion,
		].filter(Boolean);

		return {
			displayName: loc.displayName ?? undefined,
			address: addressParts.length ? addressParts.join(', ') : undefined,
			locationType: loc.locationType ?? undefined,
		};
	}

	function formatRecipient(
		r: Recipient | null | undefined,
	): { name?: string; email: string } | null {
		if (!r?.emailAddress?.address) return null;
		return {
			name: r.emailAddress.name ?? undefined,
			email: r.emailAddress.address,
		};
	}

	function formatAttendee(a: Attendee) {
		return {
			email: a.emailAddress?.address ?? '',
			name: a.emailAddress?.name ?? undefined,
			type: a.type ?? undefined,
			responseStatus: a.status?.response ?? undefined,
		};
	}

	function formatOnlineMeeting(event: Event) {
		const info = event.onlineMeeting;
		if (!info?.joinUrl) return undefined;
		return {
			joinUrl: info.joinUrl,
			conferenceId: info.conferenceId ?? undefined,
			provider: event.onlineMeetingProvider ?? undefined,
		};
	}

	function formatEventSummary(event: Event) {
		return {
			id: event.id!,
			subject: event.subject ?? '',
			bodyPreview: event.bodyPreview ?? undefined,
			start: formatDateTime(event.start),
			end: formatDateTime(event.end),
			location: formatLocation(event.location),
			isAllDay: event.isAllDay ?? false,
			isCancelled: event.isCancelled ?? false,
			showAs: event.showAs ?? undefined,
			importance: event.importance ?? 'normal',
			sensitivity: event.sensitivity ?? 'normal',
			organizer: formatRecipient(event.organizer),
			attendeeCount: event.attendees?.length ?? 0,
			isOnlineMeeting: event.isOnlineMeeting ?? false,
			onlineMeeting: formatOnlineMeeting(event),
			type: event.type ?? undefined,
			seriesMasterId: event.seriesMasterId ?? undefined,
			webLink: event.webLink ?? undefined,
		};
	}

	const CALENDAR_SELECT = [
		'id',
		'name',
		'color',
		'hexColor',
		'isDefaultCalendar',
		'canEdit',
		'canShare',
		'owner',
		'changeKey',
	];

	export const [listDescription, listInput] = [
		'Lists all Microsoft calendars the user has access to, including shared calendars.',
		t.Object({}),
	];

	export async function list(client: Client, _input: Static<typeof listInput>) {
		const response: { value?: GraphCalendar[] } = await client
			.api('/me/calendars')
			.select(CALENDAR_SELECT)
			.get();

		const calendars = (response.value ?? []).map((cal) => ({
			id: cal.id!,
			name: cal.name ?? '',
			color: cal.color ?? undefined,
			hexColor: cal.hexColor ?? undefined,
			isDefault: cal.isDefaultCalendar ?? false,
			canEdit: cal.canEdit ?? false,
			canShare: cal.canShare ?? false,
			owner: cal.owner
				? {
						name: cal.owner.name ?? undefined,
						email: cal.owner.address ?? undefined,
					}
				: undefined,
		}));

		return { calendars };
	}

	const EVENT_LIST_SELECT = [
		'id',
		'subject',
		'bodyPreview',
		'start',
		'end',
		'location',
		'attendees',
		'organizer',
		'isAllDay',
		'isCancelled',
		'showAs',
		'importance',
		'sensitivity',
		'webLink',
		'onlineMeeting',
		'onlineMeetingProvider',
		'isOnlineMeeting',
		'seriesMasterId',
		'type',
		'recurrence',
	];

	export const [eventsDescription, eventsInput] = [
		'Lists or searches Microsoft calendar events. When startDateTime and endDateTime are provided, uses calendarView to expand recurring events into individual instances. Otherwise lists event series. Supports filtering by subject query, time range, and cancelled status.',
		t.Union([
			t.Object({
				nextLink: t.String({
					description:
						'Continuation URL for pagination. If provided, other params are ignored.',
				}),
			}),
			t.Object({
				calendarId: Nullish(t.String(), {
					description:
						'Calendar ID to fetch events from. Omit or leave empty for the default calendar.',
				}),
				query: Nullish(t.String(), {
					description:
						'Free-text search query to filter events by subject (e.g., "standup", "1:1")',
				}),
				startDateTime: Nullish(t.String({ format: 'date-time' }), {
					description:
						'Lower bound for event time range (ISO 8601). When provided with endDateTime, recurring events are expanded into individual instances.',
				}),
				endDateTime: Nullish(t.String({ format: 'date-time' }), {
					description:
						'Upper bound for event time range (ISO 8601). Required when startDateTime is provided.',
				}),
				maxResults: Nullish(t.Number({ minimum: 1, maximum: 1000 }), {
					default: 50,
					description: 'Maximum number of events to return (max 1000)',
				}),
				showCancelled: Nullish(t.Boolean(), {
					default: false,
					description: 'Include cancelled events in results',
				}),
			}),
		]),
	];

	export async function events(
		client: Client,
		input: Static<typeof eventsInput>,
	) {
		let response: { value?: Event[]; '@odata.nextLink'?: string };

		if ('nextLink' in input) {
			response = await client.api(input.nextLink).get();
		} else {
			const calendarBase = input.calendarId
				? `/me/calendars/${input.calendarId}`
				: '/me/calendar';
			const top = input.maxResults ?? 50;
			const useCalendarView = input.startDateTime && input.endDateTime;

			let request = useCalendarView
				? client.api(`${calendarBase}/calendarView`).query({
						startDateTime: input.startDateTime!,
						endDateTime: input.endDateTime!,
					})
				: client.api(`${calendarBase}/events`);

			request = request.select(EVENT_LIST_SELECT).top(top);

			const filters: string[] = [];

			if (input.query)
				filters.push(`contains(subject,'${input.query.replace(/'/g, "''")}')`);

			if (!input.showCancelled) filters.push('isCancelled eq false');

			if (filters.length) request = request.filter(filters.join(' and '));

			request = request.orderby('start/dateTime');

			response = await request.get();
		}

		const events = (response.value ?? []).map(formatEventSummary);

		return {
			nextLink: response['@odata.nextLink'] ?? null,
			events,
		};
	}

	const EVENT_READ_SELECT = [
		'id',
		'subject',
		'body',
		'bodyPreview',
		'start',
		'end',
		'location',
		'locations',
		'attendees',
		'organizer',
		'isAllDay',
		'isCancelled',
		'isOrganizer',
		'showAs',
		'importance',
		'sensitivity',
		'webLink',
		'onlineMeeting',
		'onlineMeetingProvider',
		'isOnlineMeeting',
		'seriesMasterId',
		'type',
		'recurrence',
		'hasAttachments',
		'categories',
		'responseStatus',
		'reminderMinutesBeforeStart',
		'createdDateTime',
		'lastModifiedDateTime',
		'iCalUId',
	];

	export const [readDescription, readInput] = [
		'Reads a single Microsoft calendar event by ID, returning full details including body, attendees, online meeting info, and attachments metadata.',
		t.Object({
			eventId: t.String({
				description: 'The event ID to retrieve',
			}),
		}),
	];

	export async function read(client: Client, input: Static<typeof readInput>) {
		const event: Event = await client
			.api(`/me/events/${input.eventId.replace(/\//g, '-')}`)
			.select(EVENT_READ_SELECT)
			.header('Prefer', 'outlook.body-content-type="text"')
			.get();

		return {
			id: event.id!,
			subject: event.subject ?? '',
			body: event.body?.content ?? null,
			bodyPreview: event.bodyPreview ?? undefined,
			start: formatDateTime(event.start),
			end: formatDateTime(event.end),
			location: formatLocation(event.location),
			locations: event.locations?.map(formatLocation).filter(Boolean) ?? [],
			isAllDay: event.isAllDay ?? false,
			isCancelled: event.isCancelled ?? false,
			isOrganizer: event.isOrganizer ?? false,
			showAs: event.showAs ?? undefined,
			importance: event.importance ?? 'normal',
			sensitivity: event.sensitivity ?? 'normal',
			organizer: formatRecipient(event.organizer),
			attendees: event.attendees?.map(formatAttendee) ?? [],
			isOnlineMeeting: event.isOnlineMeeting ?? false,
			onlineMeeting: formatOnlineMeeting(event),
			type: event.type ?? undefined,
			seriesMasterId: event.seriesMasterId ?? undefined,
			recurrence: event.recurrence
				? {
						pattern: event.recurrence.pattern
							? {
									type: event.recurrence.pattern.type ?? undefined,
									interval: event.recurrence.pattern.interval ?? undefined,
									daysOfWeek: event.recurrence.pattern.daysOfWeek ?? undefined,
									dayOfMonth: event.recurrence.pattern.dayOfMonth ?? undefined,
								}
							: undefined,
						range: event.recurrence.range
							? {
									type: event.recurrence.range.type ?? undefined,
									startDate: event.recurrence.range.startDate ?? undefined,
									endDate: event.recurrence.range.endDate ?? undefined,
								}
							: undefined,
					}
				: undefined,
			hasAttachments: event.hasAttachments ?? false,
			categories: event.categories ?? [],
			responseStatus: event.responseStatus?.response ?? undefined,
			reminderMinutes: event.reminderMinutesBeforeStart ?? undefined,
			created: event.createdDateTime ?? undefined,
			lastModified: event.lastModifiedDateTime ?? undefined,
			iCalUId: event.iCalUId ?? undefined,
			webLink: event.webLink ?? undefined,
		};
	}
}

export const microsoftCalendarRouter = new Elysia({ prefix: '/calendar' })
	.use(authPlugin())
	.get(
		'/list/:credentialId',
		async ({ params: { credentialId }, query, activeUser }) => {
			const hasPermission = await userHasCredential(activeUser, credentialId);
			if (!hasPermission)
				throw httpError(
					HttpCode.FORBIDDEN,
					ErrorCode.NO_CREDENTIAL_PERMISSION,
					activeUser.language as Language,
				);
			return MicrosoftCalendar.list(
				await MicrosoftCalendar.fromRequest(activeUser, credentialId),
				query,
			);
		},
		{
			detail: {
				summary: 'List Microsoft calendars',
				description: MicrosoftCalendar.listDescription,
			},
			params: tObject({ credentialId: t.String({ format: 'uuid' }) }),
			query: MicrosoftCalendar.listInput,
		},
	)
	.get(
		'/events/:credentialId',
		async ({ params: { credentialId }, query, activeUser }) => {
			const hasPermission = await userHasCredential(activeUser, credentialId);
			if (!hasPermission)
				throw httpError(
					HttpCode.FORBIDDEN,
					ErrorCode.NO_CREDENTIAL_PERMISSION,
					activeUser.language as Language,
				);
			return MicrosoftCalendar.events(
				await MicrosoftCalendar.fromRequest(activeUser, credentialId),
				query,
			);
		},
		{
			detail: {
				summary: 'List Microsoft calendar events',
				description: MicrosoftCalendar.eventsDescription,
			},
			params: tObject({ credentialId: t.String({ format: 'uuid' }) }),
			query: MicrosoftCalendar.eventsInput,
		},
	)
	.get(
		'/event/:credentialId',
		async ({ params: { credentialId }, query, activeUser }) => {
			const hasPermission = await userHasCredential(activeUser, credentialId);
			if (!hasPermission)
				throw httpError(
					HttpCode.FORBIDDEN,
					ErrorCode.NO_CREDENTIAL_PERMISSION,
					activeUser.language as Language,
				);
			return MicrosoftCalendar.read(
				await MicrosoftCalendar.fromRequest(activeUser, credentialId),
				query,
			);
		},
		{
			detail: {
				summary: 'Read Microsoft calendar event',
				description: MicrosoftCalendar.readDescription,
			},
			params: tObject({ credentialId: t.String({ format: 'uuid' }) }),
			query: MicrosoftCalendar.readInput,
		},
	);
