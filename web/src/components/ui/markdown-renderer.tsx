import React, { Suspense, useEffect, useId, useMemo, useState } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeRaw from "rehype-raw"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import rehypeKatex from "rehype-katex"
import { deflateRaw } from "pako"
import { cn } from "@/lib/utils"
import { CopyButton } from "@/components/ui/copy-button"
import { Badge } from "@/components/ui/badge"
import { DirectoryTree, isDirectoryTree } from "@/components/ui/directory-tree"
import { TimelineChart, isTimeline } from "@/components/ui/timeline-chart"
import { BarChartRenderer, isBarChart } from "@/components/ui/bar-chart-renderer"
import { LineChartRenderer, isLineChart } from "@/components/ui/line-chart-renderer"

interface MarkdownRendererProps {
  children: string
}

type ThemeColors = {
  background: string
  foreground: string
  card: string
  muted: string
  mutedForeground: string
  border: string
  primary: string
  secondary: string
  accent: string
  chart1: string
  chart2: string
  chart3: string
}

const FALLBACK_THEME_COLORS: ThemeColors = {
  background: "#eef0f3",
  foreground: "#111827",
  card: "#f5f6f8",
  muted: "#e2e5ea",
  mutedForeground: "#64748b",
  border: "#cbd5e1",
  primary: "#38bdf8",
  secondary: "#e2e8f0",
  accent: "#67e8f9",
  chart1: "#7dd3fc",
  chart2: "#38bdf8",
  chart3: "#0ea5e9",
}

const PLANTUML_SERVER_URL =
  import.meta.env.VITE_PLANTUML_SERVER_URL ??
  "https://www.plantuml.com/plantuml/svg"

const SANITIZE_SCHEMA = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "svg",
    "g",
    "path",
    "circle",
    "ellipse",
    "line",
    "polyline",
    "polygon",
    "rect",
    "text",
    "tspan",
    "defs",
    "linearGradient",
    "radialGradient",
    "stop",
    "marker",
    "pattern",
    "clipPath",
    "mask",
    "title",
    "desc",
    "use",
  ],
  attributes: {
    ...defaultSchema.attributes,
    "*": [
      ...(defaultSchema.attributes?.["*"] ?? []),
      "className",
      "id",
      "title",
      "role",
      "aria-label",
      "aria-hidden",
    ],
    svg: [
      "xmlns",
      "viewBox",
      "width",
      "height",
      "fill",
      "stroke",
      "strokeWidth",
      "strokeLinecap",
      "strokeLinejoin",
      "preserveAspectRatio",
      "role",
      "aria-label",
      "aria-hidden",
    ],
    g: ["fill", "stroke", "strokeWidth", "transform", "opacity"],
    path: [
      "d",
      "fill",
      "stroke",
      "strokeWidth",
      "strokeLinecap",
      "strokeLinejoin",
      "opacity",
      "transform",
      "markerEnd",
      "markerStart",
    ],
    circle: ["cx", "cy", "r", "fill", "stroke", "strokeWidth", "opacity"],
    ellipse: ["cx", "cy", "rx", "ry", "fill", "stroke", "strokeWidth", "opacity"],
    line: ["x1", "y1", "x2", "y2", "stroke", "strokeWidth", "strokeLinecap", "opacity", "markerEnd", "markerStart"],
    polyline: ["points", "fill", "stroke", "strokeWidth", "strokeLinecap", "strokeLinejoin", "opacity"],
    polygon: ["points", "fill", "stroke", "strokeWidth", "strokeLinejoin", "opacity"],
    rect: ["x", "y", "rx", "ry", "width", "height", "fill", "stroke", "strokeWidth", "opacity"],
    text: ["x", "y", "dx", "dy", "fill", "fontFamily", "fontSize", "fontWeight", "textAnchor", "dominantBaseline", "transform"],
    tspan: ["x", "y", "dx", "dy", "fill", "fontSize", "fontWeight", "textAnchor"],
    linearGradient: ["id", "x1", "y1", "x2", "y2", "gradientUnits", "gradientTransform"],
    radialGradient: ["id", "cx", "cy", "r", "fx", "fy", "gradientUnits", "gradientTransform"],
    stop: ["offset", "stopColor", "stopOpacity"],
    marker: ["id", "viewBox", "refX", "refY", "markerWidth", "markerHeight", "orient", "fill", "stroke"],
    pattern: ["id", "x", "y", "width", "height", "patternUnits", "patternTransform"],
    clipPath: ["id"],
    mask: ["id", "x", "y", "width", "height"],
    use: ["href", "xlinkHref", "x", "y", "width", "height", "fill", "stroke"],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
    xlinkHref: ["http", "https"],
    src: ["http", "https"],
  },
}

function MarkdownRendererBase({ children }: MarkdownRendererProps) {
  const segments = useMemo(() => segmentMarkdownContent(children), [children])

  return (
    <div className="space-y-3">
      {segments.map((segment, index) => {
        if (segment.type === "markdown") {
          return renderMarkdownSegment(segment.content, `markdown-${index}`)
        }

        return renderStructuredBlock(
          segment.type,
          segment.content,
          `structured-${index}`
        )
      })}
    </div>
  )
}

export const MarkdownRenderer = React.memo(MarkdownRendererBase)

interface HighlightedPre extends React.HTMLAttributes<HTMLPreElement> {
  children: string
  language: string
}

const HighlightedPre = React.memo(
  async ({ children, language, ...props }: HighlightedPre) => {
    const { codeToTokens, bundledLanguages } = await import("shiki")

    if (!(language in bundledLanguages)) {
      return <pre {...props}>{children}</pre>
    }

    const { tokens } = await codeToTokens(children, {
      lang: language as keyof typeof bundledLanguages,
      defaultColor: false,
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
    })

    return (
      <pre {...props}>
        <code>
          {tokens.map((line, lineIndex) => (
            <span
              key={lineIndex}
              className="group/line flex items-start -ml-4 pl-4 hover:bg-[oklch(0.965_0.007_252)] dark:hover:bg-[oklch(0.20_0.022_256)] transition-colors duration-100"
            >
              <span
                className="select-none w-12 shrink-0 px-4 text-right font-mono leading-relaxed text-[oklch(0.72_0.010_252)] dark:text-[oklch(0.42_0.018_256)] group-hover/line:text-[oklch(0.45_0.010_252)] dark:group-hover/line:text-[oklch(0.55_0.018_256)] transition-colors duration-100 bg-[oklch(0.975_0.005_252)] dark:bg-[oklch(0.168_0.020_256)] border-r border-[oklch(0.920_0.010_252)] dark:border-[oklch(0.24_0.018_256)] mr-4"
                aria-hidden
              >
                {lineIndex + 1}
              </span>
              <span className="flex-1 min-w-0 pl-4 pr-5">
                {line.map((token, tokenIndex) => {
                  const style =
                    typeof token.htmlStyle === "string"
                      ? undefined
                      : token.htmlStyle

                  return (
                    <span
                      key={tokenIndex}
                      className="shiki-token"
                      style={style}
                    >
                      {token.content}
                    </span>
                  )
                })}
              </span>
            </span>
          ))}
        </code>
      </pre>
    )
  }
)
HighlightedPre.displayName = "HighlightedCode"

interface CodeBlockProps extends React.HTMLAttributes<HTMLPreElement> {
  children: React.ReactNode
  className?: string
  language: string
}

const CodeBlock = ({
  children,
  className,
  language,
  ...restProps
}: CodeBlockProps) => {
  const code =
    typeof children === "string"
      ? children
      : childrenTakeAllStringContents(children)

  const lineCount = code.split("\n").length

  const preClass = cn(
    "overflow-x-auto py-3 pl-4 font-mono text-sm leading-relaxed bg-[oklch(0.99_0.003_252)] dark:bg-[oklch(0.148_0.018_256)]",
    "[scrollbar-width:thin]",
    "[&::-webkit-scrollbar]:h-1.5",
    "[&::-webkit-scrollbar-track]:bg-transparent",
    "[&::-webkit-scrollbar-thumb]:rounded-full",
    "[&::-webkit-scrollbar-thumb]:bg-border/50",
  )

  return (
    <div className="group/code my-4 overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      {/* Header bar */}
      <div className="flex h-11 items-center justify-between border-b border-border/40 bg-muted/30 px-4">
        <div className="flex items-center gap-3">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-400/60 dark:bg-red-500/50 ring-1 ring-red-500/25 dark:ring-red-400/20" />
            <span className="h-3 w-3 rounded-full bg-amber-400/60 dark:bg-amber-500/50 ring-1 ring-amber-500/25 dark:ring-amber-400/20" />
            <span className="h-3 w-3 rounded-full bg-emerald-400/60 dark:bg-emerald-500/50 ring-1 ring-emerald-500/25 dark:ring-emerald-400/20" />
          </div>
          <div className="h-4 w-px bg-border/50" />
          <Badge
            variant="secondary"
            className="h-5 rounded-md px-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 bg-background/50 border border-border/50 select-none"
          >
            {language}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden select-none font-mono text-[10px] text-muted-foreground/35 sm:block">
            {lineCount} {lineCount === 1 ? "line" : "lines"}
          </span>
          <div className="h-3 w-px bg-border/40" />
          <CopyButton content={code} copyMessage="Copied code to clipboard" />
        </div>
      </div>

      {/* Code content */}
      <Suspense
        fallback={
          <pre className={preClass} {...restProps}>
            {children}
          </pre>
        }
      >
        <HighlightedPre language={language} className={preClass}>
          {code}
        </HighlightedPre>
      </Suspense>
    </div>
  )
}

type DiagramCardProps = {
  label: string
  children: React.ReactNode
  error?: string | null
  actions?: React.ReactNode
}

function DiagramCard({ label, children, error, actions }: DiagramCardProps) {
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="flex h-10 items-center justify-between border-b border-border/40 bg-muted/30 px-4">
        <Badge
          variant="secondary"
          className="h-5 rounded-md border border-border/50 bg-background/50 px-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 select-none"
        >
          {label}
        </Badge>
        {actions}
      </div>
      <div className="max-h-[75vh] overflow-auto p-4 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/50 [&::-webkit-scrollbar-track]:bg-transparent">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

function MermaidDiagram({ content }: { content: string }) {
  const id = useId().replace(/:/g, "")
  const themeVersion = useThemeVersion()
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(160)

  useEffect(() => {
    let cancelled = false

    async function renderDiagram() {
      setError(null)
      setSvg(null)

      try {
        const mermaid = (await import("mermaid")).default
        const colors = getThemeColors()

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          themeVariables: {
            background: colors.card,
            mainBkg: colors.card,
            primaryColor: colors.primary,
            primaryTextColor: colors.foreground,
            primaryBorderColor: colors.border,
            secondaryColor: colors.secondary,
            secondaryTextColor: colors.foreground,
            secondaryBorderColor: colors.border,
            tertiaryColor: colors.muted,
            tertiaryTextColor: colors.foreground,
            tertiaryBorderColor: colors.border,
            lineColor: colors.mutedForeground,
            textColor: colors.foreground,
            nodeTextColor: colors.foreground,
            edgeLabelBackground: colors.card,
            clusterBkg: colors.muted,
            clusterBorder: colors.border,
            noteBkgColor: colors.secondary,
            noteTextColor: colors.foreground,
            noteBorderColor: colors.border,
            actorBkg: colors.card,
            actorBorder: colors.primary,
            actorTextColor: colors.foreground,
            signalColor: colors.foreground,
            signalTextColor: colors.foreground,
            labelBoxBkgColor: colors.card,
            labelBoxBorderColor: colors.border,
            labelTextColor: colors.foreground,
          },
        })

        const result = await mermaid.render(`mermaid-${id}`, content)

        if (!cancelled) {
          setSvg(result.svg)
        }
      } catch (renderError) {
        if (!cancelled) {
          setError(
            renderError instanceof Error
              ? renderError.message
              : "Unable to render Mermaid diagram"
          )
        }
      }
    }

    renderDiagram()

    return () => {
      cancelled = true
    }
  }, [content, id, themeVersion])

  return (
    <DiagramCard
      label="mermaid"
      error={error}
      actions={
        !error && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <button
              type="button"
              className="rounded-md border border-border/50 bg-background/50 px-2 py-1 leading-none transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
              onClick={() => setZoom((currentZoom) => Math.max(80, currentZoom - 20))}
              disabled={zoom <= 80}
            >
              -
            </button>
            <button
              type="button"
              className="min-w-12 rounded-md border border-border/50 bg-background/50 px-2 py-1 font-mono text-[10px] leading-none transition-colors hover:bg-muted"
              onClick={() => setZoom(160)}
            >
              {zoom}%
            </button>
            <button
              type="button"
              className="rounded-md border border-border/50 bg-background/50 px-2 py-1 leading-none transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
              onClick={() => setZoom((currentZoom) => Math.min(300, currentZoom + 20))}
              disabled={zoom >= 300}
            >
              +
            </button>
          </div>
        )
      }
    >
      {svg ? (
        <div
          className="min-w-[720px] text-foreground [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-none"
          style={{ width: `${zoom}%` }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Rendering diagram...</p>
      )}
    </DiagramCard>
  )
}

function PlantUmlDiagram({ content }: { content: string }) {
  const themeVersion = useThemeVersion()
  const [failed, setFailed] = useState(false)
  const source = useMemo(() => addPlantUmlTheme(content), [content, themeVersion])
  const imageUrl = useMemo(
    () => `${PLANTUML_SERVER_URL.replace(/\/$/, "")}/${encodePlantUml(source)}`,
    [source]
  )

  useEffect(() => {
    setFailed(false)
  }, [imageUrl])

  return (
    <DiagramCard
      label="plantuml"
      error={failed ? "Unable to load PlantUML diagram" : null}
    >
      <img
        src={imageUrl}
        alt="PlantUML diagram"
        className="h-auto max-w-full rounded-md bg-card"
        onError={() => setFailed(true)}
      />
    </DiagramCard>
  )
}

function SvgBlock({ content }: { content: string }) {
  const sanitizedSvg = useMemo(() => sanitizeSvg(content), [content])

  return (
    <DiagramCard label="svg">
      <div
        className="min-w-max text-foreground [&_svg]:h-auto [&_svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
      />
    </DiagramCard>
  )
}

function childrenTakeAllStringContents(element: any): string {
  if (typeof element === "string") {
    return element
  }

  if (element?.props?.children) {
    let children = element.props.children

    if (Array.isArray(children)) {
      return children
        .map((child) => childrenTakeAllStringContents(child))
        .join("")
    } else {
      return childrenTakeAllStringContents(children)
    }
  }

  return ""
}

function useThemeVersion() {
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => {
      setVersion((currentVersion) => currentVersion + 1)
    })

    observer.observe(root, { attributes: true, attributeFilter: ["class"] })

    return () => observer.disconnect()
  }, [])

  return version
}

function getThemeColors(): ThemeColors {
  if (typeof window === "undefined") {
    return FALLBACK_THEME_COLORS
  }

  const styles = getComputedStyle(document.documentElement)
  const readColor = (name: string, fallback: string, matte?: string) => {
    const value = styles.getPropertyValue(name).trim()
    if (!value) return fallback
    return cssColorToHex(value, matte ?? fallback) ?? value
  }

  const background = readColor("--background", FALLBACK_THEME_COLORS.background)

  return {
    background,
    foreground: readColor("--foreground", FALLBACK_THEME_COLORS.foreground, background),
    card: readColor("--card", FALLBACK_THEME_COLORS.card, background),
    muted: readColor("--muted", FALLBACK_THEME_COLORS.muted, background),
    mutedForeground: readColor("--muted-foreground", FALLBACK_THEME_COLORS.mutedForeground, background),
    border: readColor("--border", FALLBACK_THEME_COLORS.border, background),
    primary: readColor("--primary", FALLBACK_THEME_COLORS.primary, background),
    secondary: readColor("--secondary", FALLBACK_THEME_COLORS.secondary, background),
    accent: readColor("--accent", FALLBACK_THEME_COLORS.accent, background),
    chart1: readColor("--chart-1", FALLBACK_THEME_COLORS.chart1, background),
    chart2: readColor("--chart-2", FALLBACK_THEME_COLORS.chart2, background),
    chart3: readColor("--chart-3", FALLBACK_THEME_COLORS.chart3, background),
  }
}

function cssColorToHex(color: string, matteColor?: string): string | null {
  if (typeof window === "undefined") {
    return null
  }

  const option = document.createElement("option")
  option.style.color = color
  document.body.append(option)
  const resolvedColor = getComputedStyle(option).color
  option.remove()

  return parseRgbToHex(resolvedColor, matteColor) ?? parseOklchToHex(resolvedColor, matteColor) ?? parseOklchToHex(color, matteColor)
}

function parseRgbToHex(color: string, matteColor?: string): string | null {
  const match = color.match(
    /^rgba?\(\s*(\d+(?:\.\d+)?)(?:,\s*|\s+)(\d+(?:\.\d+)?)(?:,\s*|\s+)(\d+(?:\.\d+)?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/
  )

  if (!match) {
    return null
  }

  const [, r, g, b, alpha] = match
  return rgbToHex(
    Number(r),
    Number(g),
    Number(b),
    parseAlpha(alpha),
    matteColor
  )
}

function parseOklchToHex(color: string, matteColor?: string): string | null {
  const match = color.match(
    /^oklch\(\s*([\d.]+%?)(?:\s+)([\d.]+)(?:\s+)([\d.]+)(?:deg)?(?:\s*\/\s*([\d.]+%?))?\s*\)$/i
  )

  if (!match) {
    return null
  }

  const [, lightness, chroma, hue, alpha] = match
  if (!lightness || !chroma || !hue) {
    return null
  }

  const l = lightness.endsWith("%") ? Number(lightness.slice(0, -1)) / 100 : Number(lightness)
  const c = Number(chroma)
  const h = (Number(hue) * Math.PI) / 180
  const a = c * Math.cos(h)
  const b = c * Math.sin(h)

  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b
  const sPrime = l - 0.0894841775 * a - 1.291485548 * b

  const lLinear = lPrime ** 3
  const mLinear = mPrime ** 3
  const sLinear = sPrime ** 3

  return rgbToHex(
    linearToRgb(4.0767416621 * lLinear - 3.3077115913 * mLinear + 0.2309699292 * sLinear),
    linearToRgb(-1.2684380046 * lLinear + 2.6097574011 * mLinear - 0.3413193965 * sLinear),
    linearToRgb(-0.0041960863 * lLinear - 0.7034186147 * mLinear + 1.707614701 * sLinear),
    parseAlpha(alpha),
    matteColor
  )
}

function linearToRgb(value: number) {
  const clamped = Math.min(1, Math.max(0, value))
  const encoded = clamped <= 0.0031308
    ? 12.92 * clamped
    : 1.055 * clamped ** (1 / 2.4) - 0.055

  return Math.round(encoded * 255)
}

function parseAlpha(alpha: string | undefined) {
  if (!alpha) return 1
  return alpha.endsWith("%") ? Number(alpha.slice(0, -1)) / 100 : Number(alpha)
}

function rgbToHex(red: number, green: number, blue: number, alpha: number, matteColor?: string) {
  const matte = matteColor ? parseHexColor(matteColor) : null
  const channels = [red, green, blue].map((channel, index) => {
    const clamped = Math.min(255, Math.max(0, Math.round(channel)))
    if (!matte || alpha >= 1) return clamped
    return Math.round(clamped * alpha + matte[index]! * (1 - alpha))
  })

  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`
}

function parseHexColor(color: string): [number, number, number] | null {
  const match = color.match(/^#([0-9a-f]{6})$/i)
  if (!match) return null

  const value = match[1]
  if (!value) return null

  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]
}

function addPlantUmlTheme(content: string) {
  const colors = getThemeColors()
  const theme = [
    "skinparam backgroundColor transparent",
    `skinparam defaultTextColor ${colors.foreground}`,
    `skinparam defaultFontColor ${colors.foreground}`,
    `skinparam arrowColor ${colors.mutedForeground}`,
    `skinparam shadowing false`,
    `skinparam roundcorner 10`,
    `skinparam classBackgroundColor ${colors.card}`,
    `skinparam classBorderColor ${colors.primary}`,
    `skinparam classFontColor ${colors.foreground}`,
    `skinparam participantBackgroundColor ${colors.card}`,
    `skinparam participantBorderColor ${colors.primary}`,
    `skinparam participantFontColor ${colors.foreground}`,
    `skinparam activityBackgroundColor ${colors.card}`,
    `skinparam activityBorderColor ${colors.primary}`,
    `skinparam activityFontColor ${colors.foreground}`,
    `skinparam noteBackgroundColor ${colors.secondary}`,
    `skinparam noteBorderColor ${colors.border}`,
    `skinparam noteFontColor ${colors.foreground}`,
    `skinparam sequenceLifeLineBorderColor ${colors.border}`,
    `skinparam sequenceGroupBackgroundColor ${colors.muted}`,
    `skinparam sequenceGroupBorderColor ${colors.border}`,
  ].join("\n")

  return content.replace(/(@start\w+\b)/, `$1\n${theme}`)
}

function encodePlantUml(content: string) {
  const compressed = deflateRaw(new TextEncoder().encode(content), { level: 9 })
  let encoded = ""

  for (let index = 0; index < compressed.length; index += 3) {
    encoded += encodePlantUmlTriplet(
      compressed[index]!,
      compressed[index + 1] ?? 0,
      compressed[index + 2] ?? 0
    )
  }

  return encoded
}

function encodePlantUmlTriplet(byte1: number, byte2: number, byte3: number) {
  const char1 = byte1 >> 2
  const char2 = ((byte1 & 0x3) << 4) | (byte2 >> 4)
  const char3 = ((byte2 & 0xf) << 2) | (byte3 >> 6)
  const char4 = byte3 & 0x3f

  return (
    encodePlantUmlChar(char1 & 0x3f) +
    encodePlantUmlChar(char2 & 0x3f) +
    encodePlantUmlChar(char3 & 0x3f) +
    encodePlantUmlChar(char4 & 0x3f)
  )
}

function encodePlantUmlChar(value: number) {
  if (value < 10) return String.fromCharCode(48 + value)
  if (value < 36) return String.fromCharCode(65 + value - 10)
  if (value < 62) return String.fromCharCode(97 + value - 36)
  return value === 62 ? "-" : "_"
}

function sanitizeSvg(content: string) {
  if (typeof window === "undefined") {
    return ""
  }

  const parser = new DOMParser()
  const document = parser.parseFromString(content, "image/svg+xml")
  const parserError = document.querySelector("parsererror")

  if (parserError) {
    return ""
  }

  sanitizeSvgElement(document.documentElement)
  return new XMLSerializer().serializeToString(document.documentElement)
}

function sanitizeSvgElement(element: Element) {
  const blockedTags = new Set(["script", "foreignObject", "iframe", "object", "embed"])

  if (blockedTags.has(element.tagName)) {
    element.remove()
    return
  }

  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase()
    const value = attribute.value.trim().toLowerCase()

    if (
      name.startsWith("on") ||
      value.includes("javascript:") ||
      value.includes("data:text/html") ||
      value.includes("@import") ||
      value.includes("expression(")
    ) {
      element.removeAttribute(attribute.name)
    }
  }

  for (const child of Array.from(element.children)) {
    sanitizeSvgElement(child)
  }
}

// ---------------------------------------------------------------------------
// ASCII / Unicode box-drawing diagram detection & rendering
// ---------------------------------------------------------------------------

/**
 * Returns true when `text` looks like an ASCII or Unicode-box diagram that
 * the LLM produced outside of a code fence (e.g. using ┌─┐│└┘ characters,
 * +---+ ASCII boxes, or multi-line geometric art with arrow symbols).
 */
function isAsciiDiagram(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false

  const lines = trimmed.split("\n")

  // Count Unicode box-drawing characters (U+2500–U+257F)
  let boxCharCount = 0
  for (const char of trimmed) {
    const code = char.charCodeAt(0)
    if (code >= 0x2500 && code <= 0x257f) boxCharCount++
  }

  // Multi-line block: 4+ box chars is strong enough evidence
  if (lines.length >= 2 && boxCharCount >= 4) return true

  // Single-line (LLM collapsed multi-line into one line via spaces):
  // require 12+ chars to avoid false positives on stray characters
  if (lines.length === 1 && boxCharCount >= 12) return true

  // ASCII art: +---+ / +===+ borders with | side lines
  if (
    /[+][─\-=]{2,}[+]/.test(trimmed) &&
    lines.some((l) => /^\s*\|.+\|\s*$/.test(l))
  )
    return true

  // Multi-line geometric ASCII art (triangles, cones, spheres…)
  // combined with at least one Unicode symbol (arrow, bullet, geometric shape)
  if (lines.length >= 3) {
    const geometricLines = lines.filter((l) =>
      /^[\s/\\|_\-=+.oO#*~<>^v]+$/.test(l)
    )
    const hasSymbols = /[▶►◄◀▼▲↑↓←→●■○□◆◇]/.test(trimmed)
    if (geometricLines.length >= 2 && hasSymbols) return true
  }

  return false
}

// ─── Pre-normalizer ──────────────────────────────────────────────────────────
//
// Runs before colorization to fix the two most common visual-misalignment
// sources in LLM-generated diagrams:
//
//  ① Mixed-border lines: if a line already contains Unicode box-drawing chars
//    (U+2500–U+257F), any bare ASCII "|" on that line is also a border—upgrade
//    it to │ (U+2502) so every glyph uses the same cell width.
//
//  ② Pure ASCII-border lines (only |, -, +, space): upgrade the whole line to
//    Unicode equivalents so the font renders each cell at the correct width.
//    Also upgrades the ─+─ junction to ─┼─.
//
//  ③ Arrow sequences: converts ──> → ──►  and <── → ◄──  (and their ASCII
//    equivalents --> → ──►  /  <-- → ◄──) so arrows receive their accent
//    colour and are visually unambiguous.
//
function normalizeDiagramContent(raw: string): string {
  return raw
    .split("\n")
    .map((line) => {
      let l = line

      // ① Lines that already contain box-drawing chars: upgrade ASCII | → │
      if (/[\u2500-\u257F]/.test(l)) {
        l = l.replace(/\|/g, "\u2502") // | → │
      }

      // ② Pure ASCII-border lines (only | - + and spaces)
      if (/^[ |+\-]*$/.test(l) && /[|+\-]/.test(l.trim())) {
        l = l
          .replace(/\|/g, "\u2502")                             // | → │
          .replace(/-+/g, (m) => "\u2500".repeat(m.length))    // ---  → ───
          .replace(/\u2500\+\u2500/g, "\u2500\u253C\u2500")    // ─+─  → ─┼─
      }

      // ③ Arrow normalization (only 2+ char sequences to avoid false positives)
      l = l
        // Unicode-dash arrows:  ──> → ──►   <── → ◄──
        .replace(/(\u2500{2,})>/g, "$1\u25BA")
        .replace(/<(\u2500{2,})/g, "\u25C4$1")
        // ASCII-dash arrows:  --> → ──►   <-- → ◄──
        .replace(/(-{2,})>/g, (_, d: string) => "\u2500".repeat(d.length) + "\u25BA")
        .replace(/<(-{2,})/g, (_, d: string) => "\u25C4" + "\u2500".repeat(d.length))

      return l
    })
    .join("\n")
}

// ─── Regex tokenizer ─────────────────────────────────────────────────────────
//
// Each capture group covers one semantic category.  Horizontal-line runs are
// matched greedily (G3) so a whole row of ─────── becomes one span instead of
// one per character.
//
//  G1  corners       ┌ ┐ └ ┘ ╔ ╗ ╚ ╝
//  G2  junctions     ├ ┤ ┬ ┴ ┼ ┣ ┫ ┳ ┻ ╋ ╠ ╣ ╦ ╩ ╬
//  G3  h-lines       ─ ━ ═  (greedy run)
//  G4  v-lines       │ ┃ ║
//  G5  arrows        ← → ↑ ↓ ↔ ↕ ⇒ ⇐ ⇑ ⇓ ⟵ ⟶ ⟺  and similar
//  G6  shapes        ▼ ▲ ▶ ◀ ● ■ □ ○ ◆ ◇ ★ ☆ …  (U+25A0–U+25FF)
//  G7  block fills   ░ ▒ ▓ █  (U+2580–U+259F)
const DIAGRAM_TOKEN_RE = new RegExp(
  "(" +
    [
      "[\u250C\u2510\u2514\u2518\u2554\u2557\u255A\u255D]",
      "[\u251C\u2524\u252C\u2534\u253C\u2523\u252B\u2533\u253B\u254B\u2560\u2563\u2566\u2569\u256C]",
      "[\u2500\u2501\u2550\u2504\u2505\u2508\u2509]+",
      "[\u2502\u2503\u2551\u254E\u254F]",
      "[\u2190-\u21FF]|[\u27F5-\u27FF]|[\u25BA\u25C4]",
      "[\u25A0-\u25FF]",
      "[\u2580-\u259F]",
    ].join(")|(") +
    ")",
  "g",
)

// Tailwind classes per group (index 0 → G1)
const DIAGRAM_GROUP_CLASSES = [
  "text-primary/45",           // G1 corners      — subtle, structural
  "text-primary/70",           // G2 junctions    — slightly more visible
  "text-muted-foreground/38",  // G3 h-lines      — very muted scaffolding
  "text-muted-foreground/52",  // G4 v-lines      — slightly more visible
  "text-primary font-bold",    // G5 arrows       — full primary, bold
  "text-primary font-semibold",// G6 shapes       — full primary
  "text-muted-foreground/22",  // G7 block fills  — barely visible fill
] as const

/**
 * Regex-based tokenizer: uses matchAll to split content into semantically
 * coloured spans and plain-text fragments in a single pass.
 * Newlines are preserved verbatim so the parent <pre> renders them naturally.
 */
function colorizeAsciiContent(content: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let keyIdx = 0

  for (const match of content.matchAll(DIAGRAM_TOKEN_RE)) {
    const matchStart = match.index!

    // Plain text before this token
    if (matchStart > lastIndex) {
      nodes.push(
        <React.Fragment key={keyIdx++}>
          {content.slice(lastIndex, matchStart)}
        </React.Fragment>,
      )
    }

    // Find which group matched (groups are 1-based; slice(1) makes it 0-based)
    const groupIndex = match.slice(1).findIndex((g) => g !== undefined)
    const className = DIAGRAM_GROUP_CLASSES[groupIndex] ?? ""

    nodes.push(
      <span key={keyIdx++} className={className}>
        {match[0]}
      </span>,
    )

    lastIndex = matchStart + match[0].length
  }

  // Trailing plain text
  if (lastIndex < content.length) {
    nodes.push(
      <React.Fragment key={keyIdx++}>
        {content.slice(lastIndex)}
      </React.Fragment>,
    )
  }

  return nodes
}

// Explicit monospace font stack — JetBrains Mono / Fira Code / system fallback
const MONO_FONT_FAMILY =
  "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'Courier New', monospace"

const AsciiDiagramRenderer = React.memo(function AsciiDiagramRenderer({
  content,
}: {
  content: string
}) {
  const normalized = useMemo(() => normalizeDiagramContent(content), [content])
  const nodes = useMemo(() => colorizeAsciiContent(normalized), [normalized])
  const hasBoxChars = /[\u2500-\u257F]/.test(normalized)
  const label = hasBoxChars ? "diagram" : "ascii"

  return (
    <DiagramCard
      label={label}
      actions={
        <CopyButton content={content} copyMessage="Copied diagram to clipboard" />
      }
    >
      {/* Inner code-editor surface */}
      <div className="rounded-lg overflow-hidden ring-1 ring-inset ring-border/20 bg-muted/10">
        <pre
          className={cn(
            "m-0 overflow-x-auto p-5",
            "whitespace-pre text-[13px] leading-[1.75]",
            "text-foreground/80 selection:bg-primary/15",
            "[scrollbar-width:thin]",
            "[&::-webkit-scrollbar]:h-1.5",
            "[&::-webkit-scrollbar-thumb]:rounded-full",
            "[&::-webkit-scrollbar-thumb]:bg-border/50",
            "[&::-webkit-scrollbar-track]:bg-transparent",
          )}
          style={{ fontFamily: MONO_FONT_FAMILY }}
        >
          {nodes}
        </pre>
      </div>
    </DiagramCard>
  )
})

// ---------------------------------------------------------------------------

type StructuredBlockType = "directory-tree" | "timeline" | "bar-chart" | "line-chart" | "ascii-diagram"

type MarkdownSegment =
  | { type: "markdown"; content: string }
  | { type: StructuredBlockType; content: string }

function getStructuredBlockType(text: string): StructuredBlockType | null {
  const normalizedText = text.trim()

  if (!normalizedText) {
    return null
  }

  const isTree = isDirectoryTree(normalizedText)
  const isTimelineBlock = isTimeline(normalizedText)
  const isBarChartBlock = isBarChart(normalizedText)
  const isLineChartBlock = isLineChart(normalizedText)

  const matchCount = [isTree, isTimelineBlock, isBarChartBlock, isLineChartBlock].filter(Boolean).length

  if (matchCount === 1) {
    if (isTree) return "directory-tree"
    if (isTimelineBlock) return "timeline"
    if (isLineChartBlock) return "line-chart"
    return "bar-chart"
  }

  // Only check for ASCII diagrams when no other structured type matched,
  // so we never compete with directory-tree (which also uses box chars).
  if (matchCount === 0 && isAsciiDiagram(normalizedText)) {
    return "ascii-diagram"
  }

  return null
}

function renderStructuredBlock(
  type: StructuredBlockType,
  content: string,
  key: string
) {
  if (type === "directory-tree") {
    return <DirectoryTree key={key} content={content} />
  }

  if (type === "bar-chart") {
    return <BarChartRenderer key={key} content={content} />
  }

  if (type === "line-chart") {
    return <LineChartRenderer key={key} content={content} />
  }

  if (type === "ascii-diagram") {
    return <AsciiDiagramRenderer key={key} content={content} />
  }

  return <TimelineChart key={key} content={content} />
}

function renderMarkdownSegment(content: string, key: string) {
  return (
    <Markdown
      key={key}
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, SANITIZE_SCHEMA], rehypeKatex]}
      components={COMPONENTS}
    >
      {content}
    </Markdown>
  )
}

function segmentMarkdownContent(text: string): MarkdownSegment[] {
  const lines = text.split("\n")
  const segments: MarkdownSegment[] = []
  let plainBuffer: string[] = []
  let fenceBuffer: string[] | null = null

  const flushPlainBuffer = () => {
    if (plainBuffer.length === 0) {
      return
    }

    segments.push(...splitPlainTextSegments(plainBuffer.join("\n")))
    plainBuffer = []
  }

  const flushFenceBuffer = () => {
    if (!fenceBuffer || fenceBuffer.length === 0) {
      return
    }

    segments.push(classifyFenceSegment(fenceBuffer))
    fenceBuffer = null
  }

  for (const line of lines) {
    const trimmedLine = line.trim()
    const isFenceLine = /^```/.test(trimmedLine)

    if (isFenceLine) {
      if (fenceBuffer) {
        fenceBuffer.push(line)
        flushFenceBuffer()
        continue
      }

      flushPlainBuffer()
      fenceBuffer = [line]
      continue
    }

    if (fenceBuffer) {
      fenceBuffer.push(line)
      continue
    }

    if (/^[-_]{8,}\s*$/.test(trimmedLine)) {
      flushPlainBuffer()
      segments.push({ type: "markdown", content: line })
      continue
    }

    plainBuffer.push(line)
  }

  flushPlainBuffer()
  flushFenceBuffer()

  return mergeMarkdownSegments(segments)
}

function splitPlainTextSegments(text: string): MarkdownSegment[] {
  const lines = text.split("\n")
  const segments: MarkdownSegment[] = []
  let blockBuffer: string[] = []
  let blankBuffer: string[] = []

  const flushBlockBuffer = () => {
    if (blockBuffer.length === 0) {
      return
    }

    segments.push(classifyWholeBlock(blockBuffer.join("\n")))
    blockBuffer = []
  }

  const flushBlankBuffer = () => {
    if (blankBuffer.length === 0) {
      return
    }

    segments.push({ type: "markdown", content: blankBuffer.join("\n") })
    blankBuffer = []
  }

  for (const line of lines) {
    const trimmedLine = line.trim()

    if (!trimmedLine) {
      flushBlockBuffer()
      blankBuffer.push(line)
      continue
    }

    flushBlankBuffer()
    blockBuffer.push(line)
  }

  flushBlockBuffer()
  flushBlankBuffer()

  return mergeMarkdownSegments(segments)
}

function classifyFenceSegment(lines: string[]): MarkdownSegment {
  if (lines.length < 2) {
    return { type: "markdown", content: lines.join("\n") }
  }

  const fenceContent = lines.slice(1, -1).join("\n")
  const structuredBlockType = getStructuredBlockType(fenceContent)

  if (structuredBlockType) {
    return {
      type: structuredBlockType,
      content: fenceContent.trim(),
    }
  }

  return { type: "markdown", content: lines.join("\n") }
}

function classifyWholeBlock(text: string): MarkdownSegment {
  const normalizedText = text.trim()

  if (!normalizedText) {
    return { type: "markdown", content: text }
  }

  const structuredBlockType = getStructuredBlockType(normalizedText)

  if (structuredBlockType) {
    return { type: structuredBlockType, content: normalizedText }
  }

  return { type: "markdown", content: text }
}

function mergeMarkdownSegments(segments: MarkdownSegment[]): MarkdownSegment[] {
  const merged: MarkdownSegment[] = []

  for (const segment of segments) {
    const previousSegment = merged[merged.length - 1]

    if (
      segment.type === "markdown" &&
      previousSegment?.type === "markdown"
    ) {
      previousSegment.content = `${previousSegment.content}\n${segment.content}`
      continue
    }

    merged.push(segment)
  }

  return merged
}

const COMPONENTS = {
  h1: withClass("h1", "text-2xl font-semibold"),
  h2: withClass("h2", "font-semibold text-xl"),
  h3: withClass("h3", "font-semibold text-lg"),
  h4: withClass("h4", "font-semibold text-base"),
  h5: withClass("h5", "font-medium"),
  strong: withClass("strong", "font-semibold"),
  a: ({ node, ...props }: any) => (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2"
    />
  ),
  blockquote: withClass("blockquote", "border-l-2 border-primary pl-4"),
  code: ({ children, className, node, ...rest }: any) => {
    const match = /language-(\w+)/.exec(className || "")
    const language = match?.[1]?.toLowerCase()

    // Extract text content for auto-detection
    const textContent =
      typeof children === "string"
        ? children
        : childrenTakeAllStringContents(children)

    const structuredBlockType = !match
      ? getStructuredBlockType(textContent)
      : null

    if (structuredBlockType) {
      return renderStructuredBlock(structuredBlockType, textContent, "code-block")
    }

    if (language === "mermaid") {
      return <MermaidDiagram content={textContent} />
    }

    if (language === "plantuml" || language === "puml") {
      return <PlantUmlDiagram content={textContent} />
    }

    if (language === "svg") {
      return <SvgBlock content={textContent} />
    }

    if (language === "ascii" || language === "art" || language === "text-diagram") {
      return <AsciiDiagramRenderer content={textContent} />
    }

    return match ? (
      <CodeBlock className={className} language={match[1]} {...rest}>
        {children}
      </CodeBlock>
    ) : (
      <code
        className={cn(
          "font-mono text-sm [:not(pre)>&]:rounded-md [:not(pre)>&]:bg-background/50 [:not(pre)>&]:px-1 [:not(pre)>&]:py-0.5"
        )}
        {...rest}
      >
        {children}
      </code>
    )
  },
  pre: ({ children }: any) => children,
  ol: withClass("ol", "list-decimal space-y-2 pl-6"),
  ul: withClass("ul", "list-disc space-y-2 pl-6"),
  li: withClass("li", "my-1.5"),
  table: ({ node, ...props }: any) => (
    <div className="my-4 w-full overflow-x-auto rounded-lg border bg-card">
      <table
        className="w-full border-collapse text-sm"
        {...props}
      />
    </div>
  ),
  thead: withClass(
    "thead",
    "border-b bg-muted/50"
  ),
  tbody: withClass(
    "tbody",
    ""
  ),
  tr: withClass(
    "tr",
    "border-b transition-colors hover:bg-muted/40"
  ),
  th: withClass(
    "th",
    "px-4 py-3 text-left font-medium text-muted-foreground [&[align=center]]:text-center [&[align=right]]:text-right"
  ),
  td: withClass(
    "td",
    "px-4 py-3 [&[align=center]]:text-center [&[align=right]]:text-right"
  ),
  p: ({ node, children, ...props }: any) => {
    // Check if paragraph contains tree/timeline text (plain text without code fences)
    const textContent =
      typeof children === "string"
        ? children
        : childrenTakeAllStringContents({ props: { children } })

    const structuredBlockType = getStructuredBlockType(textContent)

    if (structuredBlockType) {
      return renderStructuredBlock(structuredBlockType, textContent, "paragraph-block")
    }

    return (
      <p
        className="whitespace-pre-wrap animate-in fade-in-0 duration-800"
        {...props}
      >
        {children}
      </p>
    )
  },
  hr: withClass("hr", "border-foreground/20"),
}

function withClass(Tag: keyof React.JSX.IntrinsicElements, classes: string) {
  const Component = ({ node, ...props }: any) => (
    <Tag className={classes} {...props} />
  )
  Component.displayName = String(Tag)
  return Component
}

export default MarkdownRenderer
