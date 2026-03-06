import React from "react"
import type { UIMessage } from "@ai-sdk/react"
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "framer-motion"
import {
  Loader2,
  Check,
  X,
  Ban,
  Globe,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { FilePreview } from "@/components/ui/file-preview"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { DINAMIC_DATA_SOURCES, STORAGE_DATA_SOURCES } from "@/lib/available-sources"
import {
  'components.reasoning_block.title' as components_reasoning_block_title,
  'components.reasoning_block.description' as components_reasoning_block_description,
} from '@/paraglide/messages.js';

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
    if (!part.url) {
      return new File(
        [],
        part.filename ?? "Unknown",
        { type: part.mediaType ?? "application/octet-stream" }
      )
    }

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
                return (
                  <div key={`text-${i}`}>
                    <MarkdownRenderer>{part.text}</MarkdownRenderer>
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
  streaming,
}: {
  reasoning: string
  streaming?: boolean
}) => {
  if (!streaming) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: -4 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative flex items-center gap-3 w-full sm:max-w-[85%] rounded-xl border border-violet-500/30 bg-violet-500/5 px-4 py-3 overflow-hidden"
    >
      <motion.div
        className="absolute inset-0 bg-linear-to-r from-transparent via-violet-400/10 to-transparent"
        animate={{ x: ["-100%", "100%"] }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      />

      <div className="relative shrink-0">
        <motion.div
          className="absolute inset-0 rounded-full bg-violet-500/30 blur-sm"
          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <Sparkles className="relative h-4 w-4 text-violet-400" />
      </div>

      <div className="relative flex flex-col min-w-0">
        <span className="text-sm font-semibold text-violet-400">
          {components_reasoning_block_title()}
        </span>
        <span className="text-xs text-violet-400/60">
          {components_reasoning_block_description()}
        </span>
      </div>

      <div className="relative flex items-center gap-1 ml-auto shrink-0">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="block h-1.5 w-1.5 rounded-full bg-violet-400/70"
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              delay: i * 0.25,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </motion.div>
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
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="w-full sm:max-w-[85%] rounded-lg border bg-muted/40 px-4 py-3"
    >
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
    </motion.div>
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
