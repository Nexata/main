import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

// ─── Types ───────────────────────────────────────────────────────────

type TimelineEntry = {
  name: string;
  startYear: number;
  endYear: number;
  ongoing: boolean;
  duration: string;
  point?: boolean;
  dateLabel?: string;
};

type TimelineData = {
  years: number[];
  entries: TimelineEntry[];
  pointTimeline?: boolean;
};

type TimelineChartProps = {
  content: string;
};

// ─── Color palette (theme-aware) ─────────────────────────────────────

const BAR_COLORS = [
  { bg: "bg-blue-500/80 dark:bg-blue-400/70", dot: "bg-blue-500 dark:bg-blue-400" },
  { bg: "bg-emerald-500/80 dark:bg-emerald-400/70", dot: "bg-emerald-500 dark:bg-emerald-400" },
  { bg: "bg-violet-500/80 dark:bg-violet-400/70", dot: "bg-violet-500 dark:bg-violet-400" },
  { bg: "bg-amber-500/80 dark:bg-amber-400/70", dot: "bg-amber-500 dark:bg-amber-400" },
  { bg: "bg-rose-500/80 dark:bg-rose-400/70", dot: "bg-rose-500 dark:bg-rose-400" },
  { bg: "bg-cyan-500/80 dark:bg-cyan-400/70", dot: "bg-cyan-500 dark:bg-cyan-400" },
  { bg: "bg-orange-500/80 dark:bg-orange-400/70", dot: "bg-orange-500 dark:bg-orange-400" },
  { bg: "bg-pink-500/80 dark:bg-pink-400/70", dot: "bg-pink-500 dark:bg-pink-400" },
  { bg: "bg-teal-500/80 dark:bg-teal-400/70", dot: "bg-teal-500 dark:bg-teal-400" },
  { bg: "bg-indigo-500/80 dark:bg-indigo-400/70", dot: "bg-indigo-500 dark:bg-indigo-400" },
];

// ─── Detection ───────────────────────────────────────────────────────

export function isTimeline(text: string): boolean {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 3) return false;

  const yearLineRegex = /\b(19|20)\d{2}\b/g;
  let hasYearHeader = false;
  let hasAxisLine = false;
  let hasEntryLine = false;
  let hasDurationHint = false;
  let hasPointEventLine = false;
  let dateHintCount = 0;

  for (const line of lines) {
    const yearMatches = line.match(yearLineRegex);
    if (yearMatches && yearMatches.length >= 2) {
      hasYearHeader = true;
    }

    if (/[│┼─]{5,}/.test(line)) {
      hasAxisLine = true;
    }

    if (/├[─┼]*[┤┼][─┼]*\s*(?:──\s+)?[a-zA-ZáéíóúñÁÉÍÓÚÑ0-9_]/.test(line)) {
      hasEntryLine = true;
    }

    if (/├/.test(line)) {
      hasPointEventLine = true;
    }

    dateHintCount += line.match(/\(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\)/g)?.length ?? 0;

    if (/\((?:[^)]*a[ñn]os?[^)]*|[^)]*(vigente|continuo|actual|presente)[^)]*)\)/i.test(line)) {
      hasDurationHint = true;
    }
  }

  return hasYearHeader && (
    (hasEntryLine && (hasAxisLine || hasDurationHint)) ||
    (hasPointEventLine && dateHintCount >= 2)
  );
}

// ─── Parser ──────────────────────────────────────────────────────────

function parseTimeline(text: string): TimelineData {
  const lines = text.split("\n");

  // Step 1: Find the year header line and extract year positions
  const yearLineRegex = /\b((?:19|20)\d{2})\b/g;
  let years: number[] = [];
  let yearPositions: { year: number; pos: number }[] = [];

  for (const line of lines) {
    const matches = [...line.matchAll(yearLineRegex)];
    if (matches.length >= 2) {
      yearPositions = matches.map((m) => ({
        year: parseInt(m[1]!, 10),
        pos: m.index!,
      }));
      years = yearPositions.map((yp) => yp.year);
      break;
    }
  }

  if (years.length === 0) {
    return { years: [], entries: [] };
  }

  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  // Compute the average character distance per year from the header
  const charPerYear =
    yearPositions.length >= 2
      ? (yearPositions[yearPositions.length - 1]!.pos - yearPositions[0]!.pos) /
        (yearPositions[yearPositions.length - 1]!.year - yearPositions[0]!.year)
      : 6; // fallback

  const pointEntries = parsePointTimelineEntries(lines, yearPositions);
  if (pointEntries.length >= 2) {
    return { years, entries: pointEntries, pointTimeline: true };
  }

  // Step 2: Parse range entry lines
  const rangeEntries: TimelineEntry[] = [];

  for (const line of lines) {
    if (!/├/.test(line)) continue;

    const barStartIdx = line.indexOf("├");

    // Extract label text after the bar
    const labelMatch = line.match(
      /[┤├─┼]+\s*(?:──\s+)?([a-zA-ZáéíóúñÁÉÍÓÚÑ0-9_].+)$/
    );
    if (!labelMatch) continue;

    const labelText = labelMatch[1]!.trim();

    // Parse ongoing status
    const ongoing = /vigente|continuo|actual|presente/i.test(labelText);

    // Parse duration from label: e.g., "(6 años, continuo)", "(1 año)", "(3 años, vigente)"
    const durationMatch = labelText.match(/\((.+?)\)/);
    const duration = durationMatch ? durationMatch[1]! : "";

    // Extract the numeric year count from the duration string
    const yearCountMatch = duration.match(/(\d+)\s*a[ñn]os?/i);
    let durationYears = yearCountMatch ? parseInt(yearCountMatch[1]!, 10) : 0;

    if (!durationYears && !ongoing && /\(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\)/.test(labelText)) {
      continue;
    }

    // Extract clean name
    const name = cleanTimelineLabel(labelText.replace(/\s*\(.+?\)\s*$/, ""));

    // Determine startYear from bar position relative to year header positions
    const startYear = positionToYear(barStartIdx, yearPositions, charPerYear, minYear, maxYear);

    // Determine endYear
    let endYear: number;

    if (durationYears > 0) {
      // Use explicit duration from the label
      endYear = startYear + durationYears;
    } else {
      // Count bar segments: each ┼ is a year boundary crossing
      const barSection = line.slice(barStartIdx);
      // Find where the bar ends (first letter/space before label text)
      const barEndSearch = barSection.search(/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/);
      const barPart = barEndSearch > 0 ? barSection.slice(0, barEndSearch) : barSection;

      // Count ┼ separators within the bar — each represents crossing a year boundary
      const crossings = (barPart.match(/┼/g) || []).length;
      // The bar spans crossings + 1 years (├ to first ┼ is year 1, each ┼ adds 1)
      const segmentYears = crossings + 1;
      endYear = startYear + segmentYears;
    }

    // Ongoing entries extend to at least maxYear + 1
    if (ongoing && endYear < maxYear + 1) {
      endYear = maxYear + 1;
    }

    // Clamp minimum span
    if (endYear <= startYear) {
      endYear = startYear + 1;
    }

    rangeEntries.push({
      name,
      startYear: Math.round(startYear),
      endYear: Math.round(endYear),
      ongoing,
      duration,
    });
  }

  return { years, entries: rangeEntries };
}

function parsePointTimelineEntries(
  lines: string[],
  yearPositions: { year: number; pos: number }[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const markerIndex = line.indexOf("├");

    if (markerIndex === -1) continue;

    const chunks = [extractTimelineText(line.slice(markerIndex + 1))];

    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex++) {
      const nextLine = lines[nextIndex]!;
      if (nextLine.includes("├")) break;

      const chunk = extractTimelineText(nextLine);
      if (chunk) chunks.push(chunk);

      if (/\(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\)/.test(chunk)) {
        index = nextIndex - 1;
        break;
      }
    }

    const label = chunks.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    const dateMatch = label.match(/\((\d{1,2})[/-](\d{1,2})(?:[/-]((?:\d{2}){1,2}))?\)/);
    if (!label || !dateMatch) continue;

    const year = parseEventYear(markerIndex, yearPositions, dateMatch[3]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[1]);
    const startYear = dateToDecimalYear(year, month, day);
    const name = cleanTimelineLabel(label.replace(/\s*\([^)]*\)\s*$/, ""));

    entries.push({
      name,
      startYear,
      endYear: startYear,
      ongoing: false,
      duration: "",
      point: true,
      dateLabel: `${day.toString().padStart(2, "0")}/${month.toString().padStart(2, "0")}/${year}`,
    });
  }

  return entries.sort((a, b) => a.startYear - b.startYear);
}

function extractTimelineText(text: string) {
  return text
    .split("│")
    .map((part) => part.replace(/[─┼┤└┴]/g, " ").trim())
    .filter((part) => /[a-zA-ZáéíóúñÁÉÍÓÚÑ0-9]/.test(part))
    .join(" ")
    .trim();
}

function cleanTimelineLabel(text: string) {
  return text
    .replace(/[│┃┆┊┼─├┤└┴┬┐┌|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseEventYear(
  markerIndex: number,
  yearPositions: { year: number; pos: number }[],
  explicitYear?: string,
) {
  if (explicitYear) {
    const numericYear = Number(explicitYear);
    return numericYear < 100 ? 2000 + numericYear : numericYear;
  }

  return yearPositions.reduce((currentYear, yearPosition) =>
    yearPosition.pos <= markerIndex ? yearPosition.year : currentYear
  , yearPositions[0]?.year ?? new Date().getFullYear());
}

function dateToDecimalYear(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);

  return year + (date.getTime() - start) / (end - start);
}

function positionToYear(
  pos: number,
  yearPositions: { year: number; pos: number }[],
  charPerYear: number,
  minYear: number,
  maxYear: number,
): number {
  if (yearPositions.length < 2) return minYear;

  // Find the two surrounding year markers
  for (let i = 0; i < yearPositions.length - 1; i++) {
    const curr = yearPositions[i]!;
    const next = yearPositions[i + 1]!;
    if (pos >= curr.pos && pos <= next.pos) {
      // Linear interpolation between these two markers
      const ratio = (pos - curr.pos) / (next.pos - curr.pos);
      return Math.round(curr.year + ratio * (next.year - curr.year));
    }
  }

  // Before the first marker
  const first = yearPositions[0]!;
  if (pos < first.pos) {
    const yearsBack = (first.pos - pos) / charPerYear;
    return Math.max(minYear, Math.round(first.year - yearsBack));
  }

  // After the last marker
  const last = yearPositions[yearPositions.length - 1]!;
  const yearsForward = (pos - last.pos) / charPerYear;
  return Math.min(maxYear + 1, Math.round(last.year + yearsForward));
}

// ─── Main Component ──────────────────────────────────────────────────

export function TimelineChart({ content }: TimelineChartProps) {
  const data = useMemo(() => parseTimeline(content), [content]);

  if (data.years.length === 0 || data.entries.length === 0) return null;

  if (data.pointTimeline) {
    return <PointTimelineChart data={data} />;
  }

  const minYear = Math.min(...data.years);
  const maxYear = Math.max(...data.years) + 1; // +1 for ongoing items
  const totalSpan = maxYear - minYear;

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      {/* Header bar */}
      <div className="flex h-11 items-center justify-between border-b border-border/40 bg-muted/30 px-4">
        <div className="flex items-center gap-2.5">
          <svg
            className="size-4 text-primary/70"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <circle cx="6" cy="12" r="1.5" fill="currentColor" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            <circle cx="18" cy="12" r="1.5" fill="currentColor" />
          </svg>
          <span className="text-sm font-medium text-foreground/80">
            Línea de tiempo
          </span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/35 select-none">
          {minYear}–{maxYear - 1}
        </span>
      </div>

      {/* ── Desktop view (sm+) ──────────────────────────────────── */}
      <div className="hidden sm:block px-4 pt-4 pb-3 overflow-x-auto [scrollbar-width:thin]">
        <div className="min-w-[720px] pr-4">
          {/* Year axis */}
          <div className="flex mb-1 pl-[var(--label-w)]" style={{ "--label-w": "130px" } as React.CSSProperties}>
            <div className="relative h-6">
              {data.years.map((year) => {
                const pct = ((year - minYear) / totalSpan) * 100;
                return (
                  <span
                    key={year}
                    className="absolute text-[11px] font-mono text-muted-foreground/60 -translate-x-1/2 select-none"
                    style={{ left: `${pct}%` }}
                  >
                    {year}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Entries */}
          <div className="flex flex-col gap-1">
            {data.entries.map((entry, i) => {
              const color = BAR_COLORS[i % BAR_COLORS.length]!;
              const startPct = ((entry.startYear - minYear) / totalSpan) * 100;
              const widthPct = ((entry.endYear - entry.startYear) / totalSpan) * 100;

              return (
                <div
                  key={`${entry.name}-${i}`}
                  className="flex items-center gap-3 h-7"
                  style={{ "--label-w": "130px" } as React.CSSProperties}
                >
                  {/* Label */}
                  <div className="w-[var(--label-w)] shrink-0 text-right pr-1">
                    <span className="text-xs text-foreground/70 truncate block leading-tight">
                      {entry.name}
                    </span>
                  </div>

                  {/* Bar area */}
                  <div className="relative h-full min-w-0 flex-1 rounded-md bg-muted/10">
                    {/* Vertical gridlines */}
                    {data.years.map((year) => {
                      const pct = ((year - minYear) / totalSpan) * 100;
                      return (
                        <div
                          key={year}
                          className="absolute top-0 bottom-0 w-px bg-border/25"
                          style={{ left: `${pct}%` }}
                        />
                      );
                    })}

                    {/* Bar / point */}
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          entry.point ? (
                            <div
                              className={cn(
                                "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-card transition-transform duration-150 hover:scale-110 cursor-default",
                                color.dot,
                              )}
                              style={{ left: `${startPct}%` }}
                            />
                          ) : (
                            <div
                              className={cn(
                                "absolute top-0.5 bottom-0.5 rounded-md transition-colors duration-150 hover:brightness-110 cursor-default",
                                color.bg,
                                entry.ongoing && "rounded-r-none",
                              )}
                              style={{
                                left: `${startPct}%`,
                                width: `${Math.max(widthPct, 1.5)}%`,
                              }}
                            />
                          )
                        }
                      >
                        {/* Ongoing fade */}
                        {!entry.point && entry.ongoing && (
                          <span className="absolute right-0 top-0 bottom-0 w-5 rounded-r bg-gradient-to-r from-transparent to-card pointer-events-none" />
                        )}
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <div className="text-center">
                          <div className="font-medium">{entry.name}</div>
                          <div className="text-[10px] opacity-80">
                            {entry.point ? entry.dateLabel : `${entry.startYear}–${entry.ongoing ? "presente" : entry.endYear}`}
                            {entry.duration && ` · ${entry.duration}`}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Mobile view (<sm) ───────────────────────────────────── */}
      <div className="sm:hidden px-3 pt-3 pb-2">
        {/* Compact year axis */}
        <div className="relative h-5 mb-2">
          {data.years.filter((_, idx, arr) => {
            // On mobile show fewer labels: first, last, and every other
            if (idx === 0 || idx === arr.length - 1) return true;
            return arr.length <= 4 || idx % 2 === 0;
          }).map((year) => {
            const pct = ((year - minYear) / totalSpan) * 100;
            return (
              <span
                key={year}
                className="absolute text-[10px] font-mono text-muted-foreground/50 -translate-x-1/2 select-none"
                style={{ left: `${pct}%` }}
              >
                {year}
              </span>
            );
          })}
        </div>

        {/* Entries stacked */}
        <div className="flex flex-col gap-2">
          {data.entries.map((entry, i) => {
            const color = BAR_COLORS[i % BAR_COLORS.length]!;
            const startPct = ((entry.startYear - minYear) / totalSpan) * 100;
            const widthPct = ((entry.endYear - entry.startYear) / totalSpan) * 100;

            return (
              <div key={`${entry.name}-${i}`}>
                {/* Label row */}
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={cn("size-2 rounded-full shrink-0", color.dot)} />
                  <span className="text-xs text-foreground/80 truncate leading-tight">
                    {entry.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50 ml-auto shrink-0 whitespace-nowrap">
                    {entry.point ? entry.dateLabel : `${entry.startYear}–${entry.ongoing ? "presente" : entry.endYear}`}
                  </span>
                </div>
                {/* Bar / point */}
                <div className="relative h-5 rounded-md bg-muted/30">
                  {/* Gridlines */}
                  {data.years.map((year) => {
                    const pct = ((year - minYear) / totalSpan) * 100;
                    return (
                      <div
                        key={year}
                        className="absolute top-0 bottom-0 w-px bg-border/20"
                        style={{ left: `${pct}%` }}
                      />
                    );
                  })}
                  {entry.point ? (
                    <div
                      className={cn(
                        "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-muted/30",
                        color.dot,
                      )}
                      style={{ left: `${startPct}%` }}
                    />
                  ) : (
                    <div
                      className={cn(
                        "absolute top-0 bottom-0 rounded-md transition-colors duration-150",
                        color.bg,
                        entry.ongoing && "rounded-r-none",
                      )}
                      style={{
                        left: `${startPct}%`,
                        width: `${Math.max(widthPct, 2)}%`,
                      }}
                    >
                      {entry.ongoing && (
                        <span className="absolute right-0 top-0 bottom-0 w-4 rounded-r bg-gradient-to-r from-transparent to-muted/30 pointer-events-none" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PointTimelineChart({ data }: { data: TimelineData }) {
  const firstYear = Math.floor(data.entries[0]?.startYear ?? data.years[0]!);
  const lastYear = Math.floor(data.entries[data.entries.length - 1]?.startYear ?? data.years[data.years.length - 1]!);

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="flex h-11 items-center justify-between border-b border-border/40 bg-muted/30 px-4">
        <div className="flex items-center gap-2.5">
          <svg
            className="size-4 text-primary/70"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="4" x2="12" y2="20" />
            <circle cx="12" cy="7" r="1.5" fill="currentColor" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            <circle cx="12" cy="17" r="1.5" fill="currentColor" />
          </svg>
          <span className="text-sm font-medium text-foreground/80">
            Línea de tiempo
          </span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/35 select-none">
          {firstYear === lastYear ? firstYear : `${firstYear}–${lastYear}`}
        </span>
      </div>

      <div className="px-4 py-3 sm:px-5">
        <div className="relative space-y-2">
          <div className="absolute bottom-4 left-[5.5rem] top-4 w-px bg-border/50 sm:left-[6.5rem]" />
          {data.entries.map((entry, index) => {
            const color = BAR_COLORS[index % BAR_COLORS.length]!;
            const year = Math.floor(entry.startYear);

            return (
              <div key={`${entry.name}-${index}`} className="relative grid grid-cols-[4.75rem_1rem_1fr] items-start gap-3 py-1 sm:grid-cols-[5.75rem_1rem_1fr]">
                <div className="pt-0.5 text-right font-mono text-[11px] text-muted-foreground/70">
                  {entry.dateLabel?.replace(`/${year}`, "") ?? year}
                </div>
                <div className="relative z-10 flex justify-center pt-1.5">
                  <span className={cn("size-2.5 rounded-full ring-4 ring-card", color.dot)} />
                </div>
                <div className="rounded-lg border border-border/35 bg-muted/15 px-3 py-2">
                  <div className="text-sm font-medium leading-snug text-foreground/85">
                    {entry.name}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {entry.dateLabel}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
