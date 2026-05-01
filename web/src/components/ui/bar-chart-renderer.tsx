import { useMemo } from "react"
import { motion } from "framer-motion"
import { TrendingUp, TrendingDown, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────

type BarEntry = {
  label: string
  value: number
  formattedValue: string
}

type BarChartData = {
  title: string | null
  unit: string | null
  entries: BarEntry[]
}

// Block element Unicode range + common ASCII fill chars used by LLMs
const BAR_CHAR_RE = /[\u2580-\u259F\u2588█▄▀▐▌░▒▓]/

// ─── Detection ───────────────────────────────────────────────────────

export function isBarChart(text: string): boolean {
  const lines = text.split("\n").filter((l) => l.trim().length > 0)
  if (lines.length < 2) return false

  const barLinePattern = new RegExp(`^.+?\\s+[\\u2580-\\u259F]+`)
  const barLines = lines.filter((l) => barLinePattern.test(l.trim()))

  // At least 2 bar lines; allow one leading non-bar title line
  return barLines.length >= 2 && barLines.length >= lines.length - 1
}

// ─── Parser ──────────────────────────────────────────────────────────

function parseBarChart(text: string): BarChartData {
  const lines = text.split("\n").filter((l) => l.trim().length > 0)
  // label  <block chars>  optional-value
  const entryPattern = /^(.+?)\s+[\u2580-\u259F]+\s*(\$?[\d,\.]+)?/

  let title: string | null = null
  let unit: string | null = null
  const entries: BarEntry[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    const match = trimmed.match(entryPattern)

    if (!match) {
      if (entries.length === 0 && trimmed) {
        title = trimmed
        const unitMatch = trimmed.match(/\(([^)]+)\)/)
        if (unitMatch) unit = unitMatch[1]!
      }
      continue
    }

    const label = match[1]!.trim()
    const rawValue = (match[2] ?? "").trim()
    const numericValue = parseFloat(rawValue.replace(/[$,]/g, ""))

    entries.push({
      label,
      value: isNaN(numericValue) ? 0 : numericValue,
      formattedValue: rawValue,
    })
  }

  return { title, unit, entries }
}

// ─── Formatters ──────────────────────────────────────────────────────

function computeGrowth(prev: number, curr: number) {
  if (prev === 0) return null
  return ((curr - prev) / prev) * 100
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString("en-US")
}

// ─── Chart colors (uses CSS variables for full theme-safety) ─────────

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

// ─── Component ───────────────────────────────────────────────────────

type BarChartRendererProps = { content: string }

export function BarChartRenderer({ content }: BarChartRendererProps) {
  const data = useMemo(() => parseBarChart(content), [content])

  const maxValue = useMemo(
    () => Math.max(...data.entries.map((e) => e.value)),
    [data.entries],
  )

  const total = useMemo(
    () => data.entries.reduce((acc, e) => acc + e.value, 0),
    [data.entries],
  )

  const maxEntry = data.entries.find((e) => e.value === maxValue)

  const firstLabel = data.entries[0]?.label
  const lastLabel = data.entries[data.entries.length - 1]?.label
  const periodRange =
    firstLabel && lastLabel && firstLabel !== lastLabel
      ? `${firstLabel}–${lastLabel}`
      : (firstLabel ?? null)

  // Remove parenthetical unit suffix from title for a cleaner header
  const cleanTitle = data.title?.replace(/\s*\([^)]*\)\s*/g, "").trim() ?? null

  const totalDisplay = data.unit?.toUpperCase().includes("USD")
    ? `$${total.toLocaleString("en-US")}`
    : formatCompact(total)

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 border-b border-border/40 bg-muted/20 px-5 py-4">
        <div className="flex flex-col gap-0.5">
          {cleanTitle && (
            <h3 className="text-sm font-semibold leading-tight text-foreground">
              {cleanTitle}
            </h3>
          )}
          {periodRange && (
            <p className="text-[11px] text-muted-foreground">{periodRange}</p>
          )}
        </div>
        {data.unit && (
          <span className="shrink-0 rounded-md border border-border/50 bg-background/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
            {data.unit}
          </span>
        )}
      </div>

      {/* ── Bars ───────────────────────────────────────────────────── */}
      <div className="space-y-0.5 px-4 py-3">
        {data.entries.map((entry, index) => {
          const pct = maxValue > 0 ? (entry.value / maxValue) * 100 : 0
          const prevEntry = data.entries[index - 1]
          const growth = prevEntry ? computeGrowth(prevEntry.value, entry.value) : null
          const isMax = entry.value === maxValue
          const color = CHART_COLORS[index % CHART_COLORS.length]!
          const delay = index * 0.06

          return (
            <div
              key={`${entry.label}-${index}`}
              className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/30"
            >
              {/* Label */}
              <span
                className={cn(
                  "w-11 shrink-0 text-right font-mono text-xs font-medium tabular-nums",
                  isMax ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {entry.label}
              </span>

              {/* Bar track with grid guides */}
              <div className="relative h-7 flex-1 overflow-hidden rounded-full bg-muted/40">
                {/* Subtle 25 / 50 / 75 guide lines */}
                {[25, 50, 75].map((g) => (
                  <div
                    key={g}
                    className="pointer-events-none absolute inset-y-0 w-px bg-border/30"
                    style={{ left: `${g}%` }}
                  />
                ))}

                {/* Animated fill */}
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ backgroundColor: color, opacity: 0.85 }}
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: `${pct}%`, opacity: isMax ? 1 : 0.8 }}
                  transition={{
                    width: {
                      duration: 0.65,
                      delay,
                      ease: [0.25, 0.46, 0.45, 0.94],
                    },
                    opacity: { duration: 0.25, delay },
                  }}
                />

                {/* Shimmer on the max bar */}
                {isMax && (
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      background: `linear-gradient(90deg, transparent 60%, rgba(255,255,255,0.18) 80%, transparent 100%)`,
                      width: `${pct}%`,
                    }}
                    initial={{ opacity: 0, x: "-100%" }}
                    animate={{ opacity: 1, x: "100%" }}
                    transition={{ duration: 0.9, delay: delay + 0.55, ease: "easeOut" }}
                  />
                )}
              </div>

              {/* Value */}
              <div className="flex w-24 shrink-0 items-center justify-end gap-1">
                <span
                  className={cn(
                    "font-mono text-xs font-semibold tabular-nums",
                    isMax ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {entry.formattedValue}
                </span>
                {isMax && (
                  <Trophy
                    className="h-3 w-3 shrink-0 text-amber-500 dark:text-amber-400"
                    aria-label="Valor máximo"
                  />
                )}
              </div>

              {/* Growth badge */}
              <div className="hidden w-16 shrink-0 sm:block">
                {growth !== null && (
                  <span
                    className={cn(
                      "flex items-center gap-0.5 text-[10px] font-medium tabular-nums",
                      growth >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-500 dark:text-rose-400",
                    )}
                  >
                    {growth >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {growth >= 0 ? "+" : ""}
                    {growth.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-border/30 bg-muted/10 px-5 py-2.5">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {total > 0 && (
            <span>
              <span className="font-medium text-foreground/70">Total</span>{" "}
              {totalDisplay}
            </span>
          )}
          {maxEntry && (
            <span>
              <span className="font-medium text-foreground/70">Máx.</span>{" "}
              {maxEntry.formattedValue}{" "}
              <span className="opacity-60">({maxEntry.label})</span>
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground/40">
          {data.entries.length} {data.entries.length === 1 ? "período" : "períodos"}
        </span>
      </div>
    </div>
  )
}
