import React, { Suspense, useMemo } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import { cn } from "@/lib/utils"
import { CopyButton } from "@/components/ui/copy-button"
import { Badge } from "@/components/ui/badge"
import { DirectoryTree, isDirectoryTree } from "@/components/ui/directory-tree"
import { TimelineChart, isTimeline } from "@/components/ui/timeline-chart"

interface MarkdownRendererProps {
  children: string
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

type StructuredBlockType = "directory-tree" | "timeline"

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

  if (isTree === isTimelineBlock) {
    return null
  }

  return isTree ? "directory-tree" : "timeline"
}

function renderStructuredBlock(
  type: StructuredBlockType,
  content: string,
  key: string
) {
  if (type === "directory-tree") {
    return <DirectoryTree key={key} content={content} />
  }

  return <TimelineChart key={key} content={content} />
}

function renderMarkdownSegment(content: string, key: string) {
  return (
    <Markdown
      key={key}
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
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
