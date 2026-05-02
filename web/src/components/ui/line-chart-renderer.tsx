import { useMemo } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type LineChartPoint = {
  year: number
  value: number
  formattedValue: string
  note: string | null
}

type ParsedLineChart = {
  unit: string | null
  points: LineChartPoint[]
}

type ValueCandidate = Omit<LineChartPoint, "year"> & {
  x: number
}

const YEAR_PATTERN = /\b((?:19|20)\d{2})\b/g
const MARKER_VALUE_PATTERN = /([★●◆•])\s*(\$?\s*-?\d[\d.,]*(?:\s*[KMB])?)(?:\s*\(([^)]*)\))?/gi
const CURRENCY_VALUE_PATTERN = /(\$\s*-?\d[\d.,]*(?:\s*[KMB])?)(?:\s*\(([^)]*)\))?/gi

export function isLineChart(text: string): boolean {
  return parseLineChart(text) !== null
}

export function LineChartRenderer({ content }: { content: string }) {
  const data = useMemo(() => parseLineChart(content), [content])

  if (!data) return null

  const hasCurrency = data.points.some((point) => point.formattedValue.includes("$"))
  const title = data.unit ? `Evolución (${data.unit})` : "Evolución"

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-border/40 bg-muted/20 px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold leading-tight text-foreground">
            {title}
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {data.points[0]?.year}–{data.points[data.points.length - 1]?.year}
          </p>
        </div>
        {data.unit && (
          <span className="shrink-0 rounded-md border border-border/50 bg-background/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
            {data.unit}
          </span>
        )}
      </div>

      <div className="h-72 px-3 py-4 sm:px-5">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.points} margin={{ top: 12, right: 18, bottom: 8, left: 6 }}>
            <CartesianGrid stroke="var(--border)" strokeOpacity={0.35} vertical={false} />
            <XAxis
              dataKey="year"
              tickLine={false}
              axisLine={{ stroke: "var(--border)", strokeOpacity: 0.5 }}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              width={64}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickFormatter={(value) => formatAxisValue(Number(value), hasCurrency)}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--chart-1)"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "var(--card)", stroke: "var(--chart-1)", strokeWidth: 2 }}
              activeDot={{ r: 6, fill: "var(--chart-1)", stroke: "var(--card)", strokeWidth: 2 }}
              label={({ x, y, value, index }) => {
                if (typeof index !== "number") return null

                const point = data.points[index]
                if (typeof x !== "number" || typeof y !== "number" || !point) return null

                return (
                  <text
                    x={x}
                    y={y - 12}
                    fill="var(--foreground)"
                    fontSize={11}
                    fontWeight={600}
                    textAnchor="middle"
                  >
                    {point.formattedValue || formatAxisValue(Number(value), hasCurrency)}
                  </text>
                )
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: LineChartPoint }>
}) {
  const point = payload?.[0]?.payload

  if (!active || !point) return null


  return (
    <div className="rounded-lg border border-border/60 bg-popover px-3 py-2 text-sm shadow-md">
      <div className="font-medium text-foreground">{point.year}</div>
      <div className="font-mono text-xs text-muted-foreground">
        {point.formattedValue}
      </div>
      {point.note && (
        <div className="mt-1 text-[11px] text-muted-foreground">{point.note}</div>
      )}
    </div>
  )
}

function parseLineChart(text: string): ParsedLineChart | null {
  const lines = text.replace(/\t/g, "  ").split("\n")
  const hasAxisCharacters = lines.some((line) => /[┤└┴│─]/.test(line))
  const hasPointMarker = lines.some((line) => /[★●◆•]/.test(line))

  if (!hasAxisCharacters || !hasPointMarker) {
    return null
  }

  const yearLine = findYearLine(lines)
  if (!yearLine || yearLine.years.length < 2) {
    return null
  }

  const candidates = extractValueCandidates(lines, yearLine.lineIndex)
  if (candidates.length < 2) {
    return null
  }

  const points = assignYears(candidates, yearLine.years)
  if (points.length < 2) {
    return null
  }

  return {
    unit: extractUnit(lines, yearLine.lineIndex),
    points,
  }
}

function findYearLine(lines: string[]) {
  for (let lineIndex = lines.length - 1; lineIndex >= 0; lineIndex--) {
    const matches = [...lines[lineIndex]!.matchAll(YEAR_PATTERN)]

    if (matches.length >= 2) {
      return {
        lineIndex,
        years: matches.map((match) => ({
          year: Number(match[1]),
          x: match.index ?? 0,
        })),
      }
    }
  }

  return null
}

function extractValueCandidates(lines: string[], yearLineIndex: number): ValueCandidate[] {
  const candidates: ValueCandidate[] = []

  for (let lineIndex = 0; lineIndex < yearLineIndex; lineIndex++) {
    const line = lines[lineIndex]!
    collectMatches(line, MARKER_VALUE_PATTERN, candidates, true)

    if (!/[★●◆•]/.test(line)) {
      collectMatches(line, CURRENCY_VALUE_PATTERN, candidates, false)
    }
  }

  return candidates
}

function collectMatches(
  line: string,
  pattern: RegExp,
  candidates: ValueCandidate[],
  hasMarker: boolean
) {
  pattern.lastIndex = 0

  for (const match of line.matchAll(pattern)) {
    const formattedValue = (hasMarker ? match[2] : match[1])?.replace(/\s+/g, "")
    if (!formattedValue) continue

    const value = parseNumericValue(formattedValue)
    if (!Number.isFinite(value)) continue

    const markerIndex = hasMarker && match[1]
      ? line.indexOf(match[1], match.index)
      : -1

    candidates.push({
      x: markerIndex >= 0 ? markerIndex : (match.index ?? 0),
      value,
      formattedValue,
      note: (hasMarker ? match[3] : match[2])?.trim() ?? null,
    })
  }
}

function assignYears(
  candidates: ValueCandidate[],
  years: Array<{ year: number; x: number }>
): LineChartPoint[] {
  const sortedCandidates = [...candidates].sort((a, b) => a.x - b.x)
  const nearestPoints = sortedCandidates.map((candidate) => ({
    year: nearestYear(candidate.x, years),
    value: candidate.value,
    formattedValue: candidate.formattedValue,
    note: candidate.note,
  }))

  const uniqueYearCount = new Set(nearestPoints.map((point) => point.year)).size
  if (uniqueYearCount === nearestPoints.length) {
    return nearestPoints.sort((a, b) => a.year - b.year)
  }

  if (sortedCandidates.length <= years.length) {
    return sortedCandidates.map((candidate, index) => ({
      year: years[index]!.year,
      value: candidate.value,
      formattedValue: candidate.formattedValue,
      note: candidate.note,
    }))
  }

  return nearestPoints
    .filter((point, index, points) =>
      points.findIndex((candidate) => candidate.year === point.year) === index
    )
    .sort((a, b) => a.year - b.year)
}

function nearestYear(x: number, years: Array<{ year: number; x: number }>) {
  return years.reduce((nearest, current) =>
    Math.abs(current.x - x) < Math.abs(nearest.x - x) ? current : nearest
  ).year
}

function extractUnit(lines: string[], yearLineIndex: number) {
  for (let index = 0; index < yearLineIndex; index++) {
    const trimmed = lines[index]!.trim()
    if (/^[A-Z$%]{2,10}$/.test(trimmed)) {
      return trimmed
    }
  }

  return null
}

function parseNumericValue(value: string): number {
  const suffixMatch = value.match(/([KMB])$/i)
  const suffix = suffixMatch?.[1]?.toUpperCase()
  const multiplier = suffix === "K" ? 1_000 : suffix === "M" ? 1_000_000 : suffix === "B" ? 1_000_000_000 : 1
  const normalizedValue = value
    .replace(/[$\s]/g, "")
    .replace(/[KMB]$/i, "")
  const lastDot = normalizedValue.lastIndexOf(".")
  const lastComma = normalizedValue.lastIndexOf(",")

  if (lastDot !== -1 && lastComma !== -1) {
    return Number(
      lastComma > lastDot
        ? normalizedValue.replace(/\./g, "").replace(",", ".")
        : normalizedValue.replace(/,/g, "")
    ) * multiplier
  }

  if (lastComma !== -1) {
    return Number(
      /^-?\d{1,3}(,\d{3})+$/.test(normalizedValue)
        ? normalizedValue.replace(/,/g, "")
        : normalizedValue.replace(",", ".")
    ) * multiplier
  }

  if (/^-?\d{1,3}(\.\d{3})+$/.test(normalizedValue)) {
    return Number(normalizedValue.replace(/\./g, "")) * multiplier
  }

  return Number(normalizedValue) * multiplier
}

function formatAxisValue(value: number, hasCurrency: boolean) {
  const prefix = hasCurrency ? "$" : ""
  const absoluteValue = Math.abs(value)

  if (absoluteValue >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(1)}M`
  if (absoluteValue >= 1_000) return `${prefix}${(value / 1_000).toFixed(0)}K`
  return `${prefix}${value.toLocaleString("en-US")}`
}
