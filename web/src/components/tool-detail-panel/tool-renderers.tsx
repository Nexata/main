import React from "react";
import { Mail, File, Calendar, Users, MessageSquare, Database, Clock, Paperclip, ExternalLink, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  "chat.tool_detail.from" as td_from,
  "chat.tool_detail.to" as td_to,
  "chat.tool_detail.subject" as td_subject,
  "chat.tool_detail.date" as td_date,
  "chat.tool_detail.name" as td_name,
  "chat.tool_detail.location" as td_location,
  "chat.tool_detail.organizer" as td_organizer,
  "chat.tool_detail.attendees" as td_attendees,
  "chat.tool_detail.all_day" as td_all_day,
  "chat.tool_detail.provider" as td_provider,
  "chat.tool_detail.email" as td_email,
  "chat.tool_detail.role" as td_role,
  "chat.tool_detail.messages" as td_messages,
  "chat.tool_detail.events" as td_events,
  "chat.tool_detail.calendars" as td_calendars,
  "chat.tool_detail.files" as td_files,
  "chat.tool_detail.users" as td_users,
  "chat.tool_detail.entries" as td_entries,
  "chat.tool_detail.chunks" as td_chunks,
  "chat.tool_detail.results" as td_results,
  "chat.tool_detail.no_output" as td_no_output,
} from "@/paraglide/messages.js";

/* -------------------------------------------------------------------------- */
/*                              Shared primitives                              */
/* -------------------------------------------------------------------------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-sm text-foreground break-words">{children}</span>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium", className)}>
      {children}
    </span>
  );
}

function CountBadge({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </div>
  );
}

function ListCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-muted/30 px-3 py-2.5", className)}>
      {children}
    </div>
  );
}

function formatDate(raw: string | Date | undefined | null): string {
  if (!raw) return "";
  try {
    const d = typeof raw === "string" ? new Date(raw) : raw;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(raw);
  }
}

function formatSize(mb: number | undefined): string {
  if (mb === undefined || mb === null) return "";
  if (mb < 1) return `${Math.round(mb * 1024)} KB`;
  return `${mb.toFixed(1)} MB`;
}

function EmailAddress({ addr }: { addr: { name?: string; email: string } | string | null | undefined }) {
  if (!addr) return null;
  if (typeof addr === "string") return <span>{addr}</span>;
  return <span>{addr.name ? `${addr.name} <${addr.email}>` : addr.email}</span>;
}

/* -------------------------------------------------------------------------- */
/*                             Email renderers                                 */
/* -------------------------------------------------------------------------- */

function EmailListRenderer({ output }: { output: any }) {
  const messages = output?.messages ?? [];
  if (messages.length === 0) return <EmptyOutput />;

  return (
    <div className="flex flex-col gap-2">
      <CountBadge icon={Mail} label={td_messages({ count: messages.length })} />
      <div className="flex flex-col gap-1.5">
        {messages.map((m: any, i: number) => (
          <ListCard key={m.id ?? i}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="text-sm font-medium truncate">{m.subject || "(no subject)"}</span>
                <span className="text-xs text-muted-foreground truncate">
                  {m.from && (typeof m.from === "string" ? m.from : m.from.name || m.from.email)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {m.hasAttachment && <Paperclip className="h-3 w-3 text-muted-foreground" />}
                {m.isUnread && <span className="h-2 w-2 rounded-full bg-blue-500" />}
              </div>
            </div>
            {m.snippet && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.snippet}</p>
            )}
            {m.date && (
              <span className="text-xs text-muted-foreground/60 mt-1 block">{formatDate(m.date)}</span>
            )}
          </ListCard>
        ))}
      </div>
    </div>
  );
}

function EmailDetailRenderer({ output }: { output: any }) {
  if (!output) return <EmptyOutput />;
  return (
    <div className="flex flex-col gap-3">
      <Field label={td_subject()}>{output.subject}</Field>
      <Field label={td_from()}>
        <EmailAddress addr={output.from} />
      </Field>
      {output.to?.length > 0 && (
        <Field label={td_to()}>
          <div className="flex flex-col gap-0.5">
            {output.to.map((a: any, i: number) => (
              <EmailAddress key={i} addr={a} />
            ))}
          </div>
        </Field>
      )}
      <Field label={td_date()}>{formatDate(output.date || output.sentDate)}</Field>
      {output.body && (
        <div className="mt-2 rounded-lg border bg-background p-3">
          <p className="text-sm whitespace-pre-wrap break-words line-clamp-20">
            {typeof output.body === "string" ? output.body : output.body.text || output.body.html || ""}
          </p>
        </div>
      )}
      {output.attachments?.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Attachments
          </span>
          <div className="flex flex-wrap gap-1.5">
            {output.attachments.map((a: any, i: number) => (
              <Badge key={i}>
                <Paperclip className="h-3 w-3 mr-1" />
                {a.filename || a.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                           File list renderers                               */
/* -------------------------------------------------------------------------- */

function FileListRenderer({ output }: { output: any }) {
  const entries = output?.entries ?? [];
  if (entries.length === 0) return <EmptyOutput />;

  return (
    <div className="flex flex-col gap-2">
      <CountBadge icon={File} label={td_entries({ count: entries.length })} />
      <div className="flex flex-col gap-1.5">
        {entries.map((entry: any, i: number) => (
          <ListCard key={entry.id ?? i}>
            <div className="flex items-center gap-2">
              <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium truncate">{entry.name}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {entry.ext && entry.ext !== "dir" && <span>.{entry.ext}</span>}
                  {entry.ext === "dir" && <Badge>DIR</Badge>}
                  {entry.size != null && <span>{formatSize(entry.size)}</span>}
                  {entry.updatedAt && <span>{formatDate(entry.updatedAt)}</span>}
                </div>
              </div>
              {entry.url && (
                <a href={entry.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                </a>
              )}
            </div>
          </ListCard>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                          Calendar renderers                                 */
/* -------------------------------------------------------------------------- */

function CalendarListRenderer({ output }: { output: any }) {
  const calendars = output?.calendars ?? [];
  if (calendars.length === 0) return <EmptyOutput />;

  return (
    <div className="flex flex-col gap-2">
      <CountBadge icon={Calendar} label={td_calendars({ count: calendars.length })} />
      <div className="flex flex-col gap-1.5">
        {calendars.map((cal: any, i: number) => (
          <ListCard key={cal.id ?? i}>
            <div className="flex items-center gap-2">
              {cal.backgroundColor && (
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: cal.backgroundColor }}
                />
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate">{cal.summary || cal.name}</span>
                {cal.description && (
                  <span className="text-xs text-muted-foreground truncate">{cal.description}</span>
                )}
              </div>
              {cal.primary || cal.isDefault ? <Badge>Primary</Badge> : null}
            </div>
          </ListCard>
        ))}
      </div>
    </div>
  );
}

function EventListRenderer({ output }: { output: any }) {
  const events = output?.events ?? [];
  if (events.length === 0) return <EmptyOutput />;

  return (
    <div className="flex flex-col gap-2">
      <CountBadge icon={Calendar} label={td_events({ count: events.length })} />
      <div className="flex flex-col gap-1.5">
        {events.map((evt: any, i: number) => {
          const startStr = evt.start?.dateTime || evt.start?.date;
          const endStr = evt.end?.dateTime || evt.end?.date;
          const isAllDay = evt.isAllDay || (!evt.start?.dateTime && !!evt.start?.date);

          return (
            <ListCard key={evt.id ?? i}>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">{evt.summary || evt.subject || "(no title)"}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  {isAllDay ? (
                    <Badge>{td_all_day()}</Badge>
                  ) : (
                    <>
                      {startStr && <span>{formatDate(startStr)}</span>}
                      {endStr && <span>— {formatDate(endStr)}</span>}
                    </>
                  )}
                </div>
                {evt.location?.displayName && (
                  <span className="text-xs text-muted-foreground">{evt.location.displayName}</span>
                )}
                {typeof evt.location === "string" && evt.location && (
                  <span className="text-xs text-muted-foreground">{evt.location}</span>
                )}
              </div>
            </ListCard>
          );
        })}
      </div>
    </div>
  );
}

function EventDetailRenderer({ output }: { output: any }) {
  if (!output) return <EmptyOutput />;
  const startStr = output.start?.dateTime || output.start?.date;
  const endStr = output.end?.dateTime || output.end?.date;
  const isAllDay = output.isAllDay || (!output.start?.dateTime && !!output.start?.date);

  return (
    <div className="flex flex-col gap-3">
      <Field label={td_subject()}>{output.summary || output.subject}</Field>
      <Field label={td_date()}>
        {isAllDay ? td_all_day() : (
          <>
            {startStr && formatDate(startStr)}
            {endStr && ` — ${formatDate(endStr)}`}
          </>
        )}
      </Field>
      {(output.location?.displayName || (typeof output.location === "string" && output.location)) && (
        <Field label={td_location()}>
          {output.location?.displayName || output.location}
        </Field>
      )}
      {output.organizer && (
        <Field label={td_organizer()}>
          <EmailAddress addr={output.organizer} />
        </Field>
      )}
      {output.attendees?.length > 0 && (
        <Field label={td_attendees()}>
          <div className="flex flex-col gap-0.5">
            {output.attendees.slice(0, 10).map((a: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <EmailAddress addr={a} />
                {a.responseStatus && (
                  <Badge className="text-[10px]">{a.responseStatus}</Badge>
                )}
              </div>
            ))}
            {output.attendees.length > 10 && (
              <span className="text-xs text-muted-foreground">
                +{output.attendees.length - 10} more
              </span>
            )}
          </div>
        </Field>
      )}
      {output.description && (
        <div className="mt-2 rounded-lg border bg-background p-3">
          <p className="text-sm whitespace-pre-wrap break-words line-clamp-20">{output.description}</p>
        </div>
      )}
      {output.body && (
        <div className="mt-2 rounded-lg border bg-background p-3">
          <p className="text-sm whitespace-pre-wrap break-words line-clamp-20">{output.body}</p>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                           Nexata tool renderers                             */
/* -------------------------------------------------------------------------- */

function NexataFileSearchRenderer({ output }: { output: any }) {
  const files = Array.isArray(output) ? output : [];
  if (files.length === 0) return <EmptyOutput />;

  return (
    <div className="flex flex-col gap-2">
      <CountBadge icon={File} label={td_files({ count: files.length })} />
      <div className="flex flex-col gap-1.5">
        {files.map((f: any, i: number) => (
          <ListCard key={f.id ?? i}>
            <div className="flex items-start gap-2">
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <span className="text-sm font-medium truncate">{f.name}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  {f.provider && <Badge>{f.provider}</Badge>}
                  {f.type && <span>{f.type}</span>}
                  {f.modifiedAt && <span>{formatDate(f.modifiedAt)}</span>}
                </div>
                {f.ownedBy?.displayName && (
                  <span className="text-xs text-muted-foreground">{f.ownedBy.displayName}</span>
                )}
                {f.chunks?.length > 0 && (
                  <span className="text-xs text-muted-foreground">{td_chunks({ count: f.chunks.length })}</span>
                )}
              </div>
              {f.url && (
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </ListCard>
        ))}
      </div>
    </div>
  );
}

function NexataFileReadRenderer({ output }: { output: any }) {
  const chunks = Array.isArray(output) ? output : [];
  if (chunks.length === 0) return <EmptyOutput />;

  return (
    <div className="flex flex-col gap-2">
      <CountBadge icon={Database} label={td_chunks({ count: chunks.length })} />
      <div className="flex flex-col gap-1.5">
        {chunks.slice(0, 5).map((chunk: any, i: number) => (
          <ListCard key={chunk.id ?? i}>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Badge>#{chunk.order ?? i + 1}</Badge>
                {chunk.similarity != null && (
                  <span className="text-xs text-muted-foreground">
                    {(chunk.similarity * 100).toFixed(0)}% match
                  </span>
                )}
              </div>
              <p className="text-xs text-foreground whitespace-pre-wrap line-clamp-4">{chunk.text}</p>
            </div>
          </ListCard>
        ))}
        {chunks.length > 5 && (
          <span className="text-xs text-muted-foreground text-center">
            +{chunks.length - 5} more chunks
          </span>
        )}
      </div>
    </div>
  );
}

function NexataUsersRenderer({ output }: { output: any }) {
  const users = Array.isArray(output) ? output : [];
  if (users.length === 0) return <EmptyOutput />;

  return (
    <div className="flex flex-col gap-2">
      <CountBadge icon={Users} label={td_users({ count: users.length })} />
      <div className="flex flex-col gap-1.5">
        {users.map((u: any, i: number) => (
          <ListCard key={u.id ?? i}>
            <div className="flex items-center gap-3">
              {u.pfpUrl ? (
                <img src={u.pfpUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                  {(u.displayName || u.email || "?")[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate">{u.displayName}</span>
                <span className="text-xs text-muted-foreground truncate">{u.email}</span>
              </div>
              {u.isAdmin && <Badge>Admin</Badge>}
            </div>
          </ListCard>
        ))}
      </div>
    </div>
  );
}

function NexataCredentialsRenderer({ output }: { output: any }) {
  const creds = Array.isArray(output) ? output : [];
  if (creds.length === 0) return <EmptyOutput />;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        {creds.map((c: any, i: number) => (
          <ListCard key={c.id ?? i}>
            <div className="flex flex-col gap-0.5">
              {c.email && <Field label={td_email()}>{c.email}</Field>}
              {c.provider && <Field label={td_provider()}>{c.provider}</Field>}
              {c.scope && <Field label={td_role()}>{c.scope}</Field>}
            </div>
          </ListCard>
        ))}
      </div>
    </div>
  );
}

function NexataFeedbackRenderer({ output }: { output: any }) {
  const items = Array.isArray(output) ? output : [];
  if (items.length === 0) return <EmptyOutput />;

  return (
    <div className="flex flex-col gap-2">
      <CountBadge icon={MessageSquare} label={td_entries({ count: items.length })} />
      <div className="flex flex-col gap-1.5">
        {items.map((fb: any, i: number) => (
          <ListCard key={fb.id ?? i}>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Badge>{fb.type}</Badge>
                <Badge>{fb.status}</Badge>
              </div>
              <p className="text-sm line-clamp-3">{fb.comment}</p>
              {fb.user?.displayName && (
                <span className="text-xs text-muted-foreground">{fb.user.displayName}</span>
              )}
              {fb.createdAt && (
                <span className="text-xs text-muted-foreground/60">{formatDate(fb.createdAt)}</span>
              )}
            </div>
          </ListCard>
        ))}
      </div>
    </div>
  );
}

function NexataReingestRenderer({ output }: { output: any }) {
  if (!output) return <EmptyOutput />;
  return (
    <div className="flex flex-col gap-2">
      <Field label={td_name()}>{output.name}</Field>
      <Field label="Result">
        <Badge className={cn(
          output.result === "OK" && "bg-green-500/10 text-green-600",
          output.result === "FAILED" && "bg-red-500/10 text-red-600",
          output.result === "UNMODIFIED" && "bg-yellow-500/10 text-yellow-600",
        )}>
          {output.result}
        </Badge>
      </Field>
    </div>
  );
}

function GmailIngestAttachmentsRenderer({ output }: { output: any }) {
  if (!output) return <EmptyOutput />;
  const results: { filename: string; status: string; fileId?: string }[] = output.results ?? [];
  return (
    <div className="flex flex-col gap-2">
      {output.subject && <Field label={td_subject()}>{output.subject}</Field>}
      {results.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <CountBadge icon={Paperclip} label={td_files({ count: results.length })} />
          <div className="space-y-1">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/30 px-3 py-2 text-sm">
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{r.filename}</span>
                <Badge className={cn(
                  r.status === "OK" && "bg-green-500/10 text-green-600",
                  r.status === "FAILED" && "bg-red-500/10 text-red-600",
                )}>
                  {r.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProviderIngestRenderer({ output }: { output: any }) {
  if (!output) return <EmptyOutput />;
  return (
    <div className="flex flex-col gap-2">
      {output.credentialEmail && <Field label={td_email()}>{output.credentialEmail}</Field>}
      <div className="flex items-center gap-2">
        {output.ok > 0 && (
          <Badge className="bg-green-500/10 text-green-600">
            {output.ok} OK
          </Badge>
        )}
        {output.unmodified > 0 && (
          <Badge className="bg-yellow-500/10 text-yellow-600">
            {output.unmodified} Unmodified
          </Badge>
        )}
        {output.failed > 0 && (
          <Badge className="bg-red-500/10 text-red-600">
            {output.failed} Failed
          </Badge>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                           Web Search renderer                               */
/* -------------------------------------------------------------------------- */

function WebSearchRenderer({ output }: { output: any }) {
  const results: any[] = Array.isArray(output?.results) ? output.results : [];
  if (results.length === 0) return <EmptyOutput />;

  return (
    <div className="flex flex-col gap-2">
      <CountBadge icon={Search} label={td_results({ count: results.length })} />
      <div className="flex flex-col gap-1.5">
        {results.map((r: any, i: number) => (
          <ListCard key={r.url ?? i}>
            <div className="flex flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium line-clamp-2">{r.title || r.url}</span>
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              {r.url && (
                <span className="text-xs text-muted-foreground/60 truncate">{r.url}</span>
              )}
              {r.content && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">{r.content}</p>
              )}
            </div>
          </ListCard>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                         Code Execution renderer                             */
/* -------------------------------------------------------------------------- */

function CodeExecutionRenderer({ output }: { output: any }) {
  if (!output) return <EmptyOutput />;

  const hasError = output.error !== undefined;
  const displayValue = hasError ? output.error : (output.result ?? output);

  return (
    <div className="flex flex-col gap-2">
      {hasError && (
        <Badge className="bg-red-500/10 text-red-600 self-start">Error</Badge>
      )}
      <pre className={cn(
        "text-xs rounded-lg p-3 overflow-x-auto max-h-96 whitespace-pre-wrap break-words",
        hasError ? "bg-red-500/5 text-red-600 dark:text-red-400" : "bg-muted/50",
      )}>
        {typeof displayValue === "string" ? displayValue : JSON.stringify(displayValue, null, 2)}
      </pre>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Fallback / Empty                               */
/* -------------------------------------------------------------------------- */

function EmptyOutput() {
  return (
    <p className="text-sm text-muted-foreground italic">{td_no_output()}</p>
  );
}

function JsonFallbackRenderer({ output }: { output: any }) {
  if (!output) return <EmptyOutput />;
  return (
    <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto max-h-96 whitespace-pre-wrap break-words">
      {JSON.stringify(output, null, 2)}
    </pre>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Router / Exports                               */
/* -------------------------------------------------------------------------- */

const TOOL_RENDERER_MAP: Record<string, React.FC<{ output: any }>> = {
  // Web search
  webSearch: WebSearchRenderer,
  // Code execution
  codeExecution: CodeExecutionRenderer,
  // Email search
  GmailSearch: EmailListRenderer,
  OutlookSearch: EmailListRenderer,
  // Email read
  GmailRead: EmailDetailRenderer,
  OutlookRead: EmailDetailRenderer,
  // File list
  DriveSearch: FileListRenderer,
  DriveListDir: FileListRenderer,
  OneDriveSearch: FileListRenderer,
  OneDriveListDir: FileListRenderer,
  DropboxSearch: FileListRenderer,
  DropboxListDir: FileListRenderer,
  // Calendar list
  CalendarList: CalendarListRenderer,
  MicrosoftCalendarList: CalendarListRenderer,
  // Calendar events
  CalendarEvents: EventListRenderer,
  MicrosoftCalendarEvents: EventListRenderer,
  // Calendar read
  CalendarRead: EventDetailRenderer,
  MicrosoftCalendarRead: EventDetailRenderer,
  // Gmail / Outlook ingest
  GmailIngestAttachments: GmailIngestAttachmentsRenderer,
  OutlookIngestAttachments: GmailIngestAttachmentsRenderer,
  // Drive / Dropbox / OneDrive ingest
  DriveIngest: ProviderIngestRenderer,
  DropboxIngest: ProviderIngestRenderer,
  OneDriveIngest: ProviderIngestRenderer,
  // Nexata
  NexataFileSearch: NexataFileSearchRenderer,
  NexataFileRead: NexataFileReadRenderer,
  NexataListUsers: NexataUsersRenderer,
  NexataListCredentials: NexataCredentialsRenderer,
  NexataFeedbackList: NexataFeedbackRenderer,
  NexataFeedbackCreate: JsonFallbackRenderer,
  NexataReingest: NexataReingestRenderer,
  NexataListFilesOnThread: NexataFileSearchRenderer,
  NexataListFilesOnMessage: NexataFileSearchRenderer,
};

/**
 * Extract a human-readable text from error output.
 *
 * Error output may arrive in different shapes:
 * - Streaming: a plain string (the SDK's `errorText`), possibly JSON-encoded
 * - Hydrated:  a parsed array like `[{ code: "...", text: "..." }]`
 *
 * Returns the display string if a `[0].text` field is found, or the raw string
 * if the output is already a plain string. Returns `null` to fall back to JSON.
 */
function extractErrorDisplayText(output: unknown): string | null {
  // Already-parsed array with .text (hydrated path)
  if (Array.isArray(output)) {
    const text = output[0]?.text;
    if (typeof text === "string") return text;
    return null;
  }

  // Plain string (streaming errorText path)
  if (typeof output === "string") {
    // Try to parse as JSON in case it's an encoded array with .text
    try {
      const parsed = JSON.parse(output);
      if (Array.isArray(parsed)) {
        const text = parsed[0]?.text;
        if (typeof text === "string") return text;
      }
    } catch {
      // not JSON — return the string as-is
    }
    return output;
  }

  return null;
}

/**
 * Renders tool output in a structured, human-readable format.
 * Falls back to JSON for unknown tools.
 */
export function ToolOutputRenderer({ toolName, output, isError }: { toolName: string; output: unknown; isError?: boolean }) {
  // When the tool errored, extract a human-readable message when possible
  if (isError) {
    const displayText = extractErrorDisplayText(output);
    if (displayText) {
      return (
        <pre className="text-xs bg-red-500/5 text-red-600 dark:text-red-400 rounded-lg p-3 overflow-x-auto max-h-96 whitespace-pre-wrap break-words">
          {displayText}
        </pre>
      );
    }
    return <JsonFallbackRenderer output={output} />;
  }

  // Handle multi-credential wrapped output (array of results with credentialEmail)
  const unwrapped = unwrapMultiCredentialOutput(output);

  if (unwrapped.length > 1) {
    return (
      <div className="flex flex-col gap-4">
        {unwrapped.map(({ credentialEmail, data }, i) => (
          <div key={i} className="flex flex-col gap-2">
            {credentialEmail && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{credentialEmail}</span>
              </div>
            )}
            <SingleToolOutput toolName={toolName} output={data} />
          </div>
        ))}
      </div>
    );
  }

  const single = unwrapped[0];
  return <SingleToolOutput toolName={toolName} output={single?.data ?? output} />;
}

function SingleToolOutput({ toolName, output }: { toolName: string; output: unknown }) {
  const Renderer = TOOL_RENDERER_MAP[toolName] ?? JsonFallbackRenderer;
  return <Renderer output={output} />;
}

/**
 * Some tools return an array when multiple credentials match.
 * Each element has `credentialEmail` appended by the backend's `mold` function.
 */
function unwrapMultiCredentialOutput(output: unknown): { credentialEmail?: string; data: any }[] {
  if (!Array.isArray(output)) {
    // Single credential result
    if (output && typeof output === "object" && "credentialEmail" in output) {
      const { credentialEmail, ...rest } = output as Record<string, any>;
      return [{ credentialEmail, data: rest }];
    }
    return [{ data: output }];
  }

  // Could be multi-credential results or just a regular array result (like NexataFileSearch)
  if (output.length > 0 && output[0] && typeof output[0] === "object" && "credentialEmail" in output[0]) {
    // Check if ALL elements have credentialEmail — then it's multi-credential
    const allHaveEmail = output.every((item: any) => item && typeof item === "object" && "credentialEmail" in item);
    if (allHaveEmail) {
      return output.map((item: any) => {
        const { credentialEmail, ...rest } = item;
        return { credentialEmail, data: rest };
      });
    }
  }

  // It's a regular array (e.g., NexataFileSearch returns an array of files)
  return [{ data: output }];
}
