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
};

type TimelineData = {
  years: number[];
  entries: TimelineEntry[];
};

type TimelineChartProps = {
  content: string;
};

// ─── Color palette ───────────────────────────────────────────────────

const BAR_COLORS = [
  { bg: "bg-blue-500/75 dark:bg-blue-400/70", border: "border-blue-600/30 dark:border-blue-300/30" },
  { bg: "bg-emerald-500/75 dark:bg-emerald-400/70", border: "border-emerald-600/30 dark:border-emerald-300/30" },
  { bg: "bg-violet-500/75 dark:bg-violet-400/70", border: "border-violet-600/30 dark:border-violet-300/30" },
  { bg: "bg-amber-500/75 dark:bg-amber-400/70", border: "border-amber-600/30 dark:border-amber-300/30" },
  { bg: "bg-rose-500/75 dark:bg-rose-400/70", border: "border-rose-600/30 dark:border-rose-300/30" },
  { bg: "bg-cyan-500/75 dark:bg-cyan-400/70", border: "border-cyan-600/30 dark:border-cyan-300/30" },
  { bg: "bg-orange-500/75 dark:bg-orange-400/70", border: "border-orange-600/30 dark:border-orange-300/30" },
  { bg: "bg-pink-500/75 dark:bg-pink-400/70", border: "border-pink-600/30 dark:border-pink-300/30" },
  { bg: "bg-teal-500/75 dark:bg-teal-400/70", border: "border-teal-600/30 dark:border-teal-300/30" },
  { bg: "bg-indigo-500/75 dark:bg-indigo-400/70", border: "border-indigo-600/30 dark:border-indigo-300/30" },
];

// ─── Detection ───────────────────────────────────────────────────────

export function isTimeline(text: string): boolean {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 3) return false;

  // Must have a header line with multiple years (4-digit numbers)
  const yearLineRegex = /\b(19|20)\d{2}\b/g;
  let hasYearHeader = false;
  let hasBarLines = false;

  for (const line of lines) {
    const yearMatches = line.match(yearLineRegex);
    if (yearMatches && yearMatches.length >= 2) {
      hasYearHeader = true;
    }
    // Bar patterns: ├─────┤ or ├─────┼─────┤ followed by text
    if (/[├┤┼─]{3,}/.test(line) && /[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(line)) {
      hasBarLines = true;
    }
  }

  return hasYearHeader && hasBarLines;
}

// ─── Parser ──────────────────────────────────────────────────────────

function parseTimeline(text: string): TimelineData {
  const lines = text.split("\n");

  // Step 1: Find the year header line
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

  // Step 2: Parse entry lines
  // Each entry line has a bar pattern (├─...┤ or ├─...┼─...┤) followed by label text
  const entries: TimelineEntry[] = [];

  for (const line of lines) {
    // Skip lines that don't have bar patterns
    if (!/├/.test(line)) continue;

    // Find the bar start (├) and bar end (┤ or last ─ before text, or ┼── pattern)
    const barStartIdx = line.indexOf("├");
    // Find where the bar ends - look for the label text after the bar
    const labelMatch = line.match(/[┤├─┼]+\s*(?:──\s+)?([a-zA-ZáéíóúñÁÉÍÓÚÑ0-9_].+)$/);

    if (!labelMatch) continue;

    const labelText = labelMatch[1]!.trim();

    // Find the visual start and end positions of the bar
    // The bar starts at ├ and extends through ─ and ┼ characters
    const barEndIdx = barStartIdx + line.slice(barStartIdx).search(/[^\s├─┼┤│]/) - 1;
    const actualBarEnd = barEndIdx > barStartIdx ? barEndIdx : line.indexOf(labelText) - 1;

    // Map positions to years using the year header positions
    const startYear = positionToYear(barStartIdx, yearPositions, minYear, maxYear);
    let endYear = positionToYear(Math.max(actualBarEnd, barStartIdx + 1), yearPositions, minYear, maxYear);

    // Parse duration and ongoing status from the label
    const ongoing = /vigente|continuo|actual|presente/i.test(labelText);
    const durationMatch = labelText.match(/\((.+?)\)/);
    const duration = durationMatch ? durationMatch[1]! : "";

    // Extract clean name (without duration info)
    const name = labelText.replace(/\s*\(.+?\)\s*$/, "").trim();

    // If the bar extends to the last year column or beyond, and is marked ongoing
    if (ongoing && endYear < maxYear + 1) {
      endYear = maxYear + 1;
    }

    // Ensure minimum 1 year span
    if (endYear <= startYear) {
      endYear = startYear + 1;
    }

    entries.push({
      name,
      startYear: Math.round(startYear),
      endYear: Math.round(endYear),
      ongoing,
      duration,
    });
  }

  return { years, entries };
}

function positionToYear(
  pos: number,
  yearPositions: { year: number; pos: number }[],
  minYear: number,
  _maxYear: number,
): number {
  if (yearPositions.length < 2) return minYear;

  // Find the two surrounding year markers
  let before = yearPositions[0]!;
  let after = yearPositions[yearPositions.length - 1]!;

  for (let i = 0; i < yearPositions.length - 1; i++) {
    const curr = yearPositions[i]!;
    const next = yearPositions[i + 1]!;
    if (pos >= curr.pos && pos <= next.pos) {
      before = curr;
      after = next;
      break;
    }
  }

  // If before the first marker
  if (pos <= before.pos) return before.year;
  // If after the last marker
  if (pos >= after.pos) return after.year;

  // Linear interpolation
  const ratio = (pos - before.pos) / (after.pos - before.pos);
  return before.year + ratio * (after.year - before.year);
}

// ─── Main Component ──────────────────────────────────────────────────

export function TimelineChart({ content }: TimelineChartProps) {
  const data = useMemo(() => parseTimeline(content), [content]);

  if (data.years.length === 0 || data.entries.length === 0) return null;

  const minYear = Math.min(...data.years);
  const maxYear = Math.max(...data.years) + 1; // Add 1 for ongoing items
  const totalSpan = maxYear - minYear;

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      {/* Header */}
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
            Timeline
          </span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/35 select-none">
          {minYear}–{maxYear - 1}
        </span>
      </div>

      {/* Timeline content */}
      <div className="px-4 py-4 overflow-x-auto [scrollbar-width:thin]">
        {/* Year headers */}
        <div className="relative mb-3 ml-[140px]">
          <div className="flex justify-between">
            {data.years.map((year) => (
              <span
                key={year}
                className="text-xs font-mono text-muted-foreground/60 text-center"
                style={{
                  position: "absolute",
                  left: `${((year - minYear) / totalSpan) * 100}%`,
                  transform: "translateX(-50%)",
                }}
              >
                {year}
              </span>
            ))}
          </div>
        </div>

        {/* Year grid lines + entries */}
        <div className="relative ml-[140px] mt-6">
          {/* Vertical grid lines */}
          <div className="absolute inset-0 pointer-events-none">
            {data.years.map((year) => (
              <div
                key={year}
                className="absolute top-0 bottom-0 w-px bg-border/30"
                style={{
                  left: `${((year - minYear) / totalSpan) * 100}%`,
                }}
              />
            ))}
          </div>

          {/* Entry rows */}
          <div className="space-y-1.5 relative">
            {data.entries.map((entry, i) => {
              const color = BAR_COLORS[i % BAR_COLORS.length]!;
              const startPct =
                ((entry.startYear - minYear) / totalSpan) * 100;
              const widthPct =
                ((entry.endYear - entry.startYear) / totalSpan) * 100;

              return (
                <div key={`${entry.name}-${i}`} className="flex items-center h-8">
                  {/* Label (positioned to the left) */}
                  <div
                    className="absolute right-full mr-3 w-[128px] text-right shrink-0"
                  >
                    <span className="text-xs text-foreground/70 truncate block">
                      {entry.name}
                    </span>
                  </div>

                  {/* Bar */}
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <div
                          className={cn(
                            "absolute h-6 rounded-md border transition-all duration-150 hover:brightness-110 hover:shadow-sm cursor-default",
                            color.bg,
                            color.border,
                            entry.ongoing &&
                              "rounded-r-none border-r-0"
                          )}
                          style={{
                            left: `${startPct}%`,
                            width: `${Math.max(widthPct, 2)}%`,
                          }}
                        />
                      }
                    >
                      {/* Inner label for wider bars */}
                      {widthPct > 15 && (
                        <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium text-white dark:text-white/90 truncate">
                          {entry.name}
                        </span>
                      )}
                      {/* Ongoing indicator */}
                      {entry.ongoing && (
                        <span className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-r from-transparent to-muted/60" />
                      )}
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-center">
                        <div className="font-medium">{entry.name}</div>
                        <div className="text-[10px] opacity-80">
                          {entry.startYear}–{entry.ongoing ? "presente" : entry.endYear}
                          {entry.duration && ` · ${entry.duration}`}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
