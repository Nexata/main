import React, { useState } from "react"
import type { UIMessage } from "@ai-sdk/react"
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "framer-motion"
import {
  ChevronRight,
  Loader2,
  Check,
  X,
  Ban,
  Globe,
} from "lucide-react"

import { useTypingText } from "@/hooks/use-typing-text"
import { cn } from "@/lib/utils"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { FilePreview } from "@/components/ui/file-preview"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { DINAMIC_DATA_SOURCES, STORAGE_DATA_SOURCES } from "@/lib/available-sources"
import { TypingText } from "../typing-text/typing-text"

/* -------------------------------------------------------------------------- */
/*                                   Styles                                    */
/* -------------------------------------------------------------------------- */

const chatBubbleVariants = cva(
  "relative break-words rounded-lg p-3 text-md max-w-[85%]",
  {
    variants: {
      isUser: {
        true: "bg-muted text-foreground",
        false: "bg-transparent text-foreground",
      },
      animation: {
        none: "",
        slide: "duration-300 animate-in fade-in-0",
        scale: "duration-300 animate-in fade-in-0 zoom-in-75",
        fade: "duration-500 animate-in fade-in-0",
      },
    },
  }
)

type Animation = VariantProps<typeof chatBubbleVariants>["animation"]

/* -------------------------------------------------------------------------- */
/*                                ChatMessage                                  */
/* -------------------------------------------------------------------------- */

export interface ChatMessageProps {
  message: UIMessage
  showTimeStamp?: boolean
  animation?: Animation
  actions?: React.ReactNode
  disableTypingAnimation?: boolean
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  showTimeStamp = false,
  animation = "scale",
  actions,
  disableTypingAnimation,
}) => {
  const isUser = message.role === "user"
  const isAssistant = message.role === "assistant"

  const textParts = message.parts.filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
  const lastStreamingTextPart = [...message.parts]
    .reverse()
    .find(
      (p): p is Extract<typeof p, { type: "text" }> =>
        p.type === "text" && p.state === "streaming"
    )

  const shouldAnimateTyping =
    isAssistant &&
    !disableTypingAnimation &&
    textParts.some((p) => p.state === "streaming")

  const typedContent = useTypingText(
    lastStreamingTextPart?.text ?? "",
    shouldAnimateTyping,
    4
  )

  const lastTextPartGlobalIndex = (() => {
    for (let i = message.parts.length - 1; i >= 0; i--) {
      if (message.parts[i]?.type === "text") return i
    }
    return -1
  })()

  const createdAt =
    typeof message.metadata === "object" &&
    message.metadata &&
    "createdAt" in message.metadata
      ? new Date((message.metadata as any).createdAt)
      : undefined

  const formattedTime = createdAt?.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })

  // Helper para FilePreview
  function filePartToBrowserFile(part: any): File {
    const base64 = part.url.split(",")[1]
    const bytes = atob(base64)
    const array = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i)

    return new File(
      [array],
      part.filename ?? "Unknown",
      { type: part.mediaType ?? "application/octet-stream" }
    )
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 w-full",
        isUser ? "items-end" : "items-start"
      )}
    >
      {(() => {
        const blocks: React.ReactNode[] = []

        // guardamos part + índice global
        let buffer: { part: any; globalIndex: number }[] = []

        const flushBuffer = () => {
          if (!buffer.length) return

          const firstIndex = buffer[0]?.globalIndex
          const lastIndex = buffer[buffer.length - 1]?.globalIndex
          const bubbleKey = `bubble-${firstIndex}-${lastIndex}`


          const textBuffer = buffer.filter(b => b.part.type === "text")
          const fileBuffer = buffer.filter(b => b.part.type === "file")

          blocks.push(
            <motion.div
              key={bubbleKey}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={cn(chatBubbleVariants({ isUser, animation: "none" }))}
            >
              {/* TEXT */}
              {textBuffer.map(({ part, globalIndex }, i) => {
                const isStreamingPart = shouldAnimateTyping && part === lastStreamingTextPart

                return (
                  <div key={`text-${i}`}>
                    {isStreamingPart ? (
                      <TypingText
                        text={part.text}
                        isActive={shouldAnimateTyping}
                      />
                    ) : (
                      <span className="inline">
                        <MarkdownRenderer>{part.text}</MarkdownRenderer>
                      </span>
                    )}
                  </div>
                )
              })}

              {/* FILES */}
              {fileBuffer.map(({ part }, i) => {
                const browserFile = filePartToBrowserFile(part)

                return (
                  <div
                    key={`file-${i}`}
                    className="mt-3 scale-90 origin-left"
                  >
                    <FilePreview file={browserFile} />
                  </div>
                )
              })}
            </motion.div>
          )

          buffer = []
        }

        message.parts.forEach((part, index) => {
          if (part.type === "text" || part.type === "file") {
            buffer.push({ part, globalIndex: index })
            return
          }

          // flush bubble before special block
          flushBuffer()

          if (part.type === "reasoning") {
            blocks.push(
              <ReasoningBlock
                key={`reasoning-${index}`}
                reasoning={part.text}
                streaming={part.state === "streaming"}
              />
            )
            return
          }

          if (isToolPart(part)) {
            blocks.push(
              <ToolRenderer
                key={`tool-${index}`}
                part={part}
              />
            )
          }
        })

        // flush final bubble
        flushBuffer()

        return blocks
      })()}

      {showTimeStamp && createdAt && (
        <time className="text-xs opacity-50">
          {formattedTime}
        </time>
      )}
    </div>
  )
}
/* -------------------------------------------------------------------------- */
/*                               ReasoningBlock                                */
/* -------------------------------------------------------------------------- */

const ReasoningBlock = ({
  reasoning,
  streaming,
}: {
  reasoning: string
  streaming?: boolean
}) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="w-full sm:max-w-[85%]">
      <Collapsible
        open={isOpen}
        onOpenChange={setIsOpen}
        className="rounded-lg border bg-muted/50"
      >
        <div className="flex items-center p-2">
          <CollapsibleTrigger className="flex items-center gap-2 text-md">
            <ChevronRight className="h-4 w-4 transition-transform data-[state=open]:rotate-90" />
            Thinking
            {streaming && <Loader2 className="h-3 w-3 animate-spin" />}
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <motion.div
            initial={false}
            animate={isOpen ? "open" : "closed"}
            variants={{
              open: { height: "auto", opacity: 1 },
              closed: { height: 0, opacity: 0 },
            }}
            transition={{ duration: 0.25 }}
            className="border-t p-2 text-xs whitespace-pre-wrap"
          >
            {reasoning}
          </motion.div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                ToolRenderer                                 */
/* -------------------------------------------------------------------------- */

function ToolRenderer({
  part,
}: {
  part: UIMessage["parts"][number]
}) {
  if (!isToolPart(part)) return null

  const rawToolName =
    part.type === "dynamic-tool"
      ? part.toolName
      : part.type.replace("tool-", "")

  const normalized = normalizeToolName(rawToolName)

  const dataSource = findDataSource(normalized)

  const StatusIcon = getStatusIcon(part.state)

  return (
    <div className="w-full sm:max-w-[85%] rounded-lg border bg-muted/40 px-4 py-3">
      <div className="flex items-center justify-between gap-4">

        {/* LEFT SIDE */}
        <div className="flex items-center gap-3 min-w-0">

          {/* Data source icon */}
          {dataSource ? (
            <img
              src={dataSource.icon}
              alt={dataSource.name}
              className="h-5 w-5 shrink-0"
            />
          ) : (
            <Globe className="h-5 w-5 shrink-0 text-muted-foreground" />
          )}

          {/* Tool name + ID */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-md font-medium truncate">
                {rawToolName}
              </span>

              {(part as any).toolCallId && (
                <span className="text-xs text-muted-foreground truncate">
                  | {(part as any).toolCallId}
                </span>
              )}
            </div>

            {(part as any).output?.credentialEmail && (
              <span className="text-xs opacity-60 truncate">
                {(part as any).output.credentialEmail}
              </span>
            )}
          </div>
        </div>

        {/* STATUS ICON */}
        <StatusIcon />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                             Helper functions                                */
/* -------------------------------------------------------------------------- */

function normalizeToolName(name: string) {
  return name
    .toLowerCase()
    .replace("search", "")
    .replace(/[_-]/g, "")
    .trim()
}

function findDataSource(normalized: string) {
  const all = [...DINAMIC_DATA_SOURCES, ...STORAGE_DATA_SOURCES]

  return all.find((source) =>
    normalized.includes(source.id.toLowerCase())
  )
}

function getStatusIcon(state?: string) {
  if (state === "output-available") return () => <Check className="h-4 w-4 text-green-500" />
  if (state === "output-error") return () => <X className="h-4 w-4 text-red-500" />
  if (state === "output-denied") return () => <Ban className="h-4 w-4 text-yellow-500" />

  return () => (<Loader2 className="h-4 w-4 animate-spin text-blue-500" />)
}

function isToolPart(
  part: UIMessage["parts"][number]
): part is Extract<UIMessage["parts"][number], { state: string }> {
  return (
    part.type === "dynamic-tool" ||
    part.type.startsWith("tool-")
  )
}
