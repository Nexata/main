import { memo, useMemo } from "react"
import type { UIMessage } from "@ai-sdk/react"
import {
  ChatMessage,
  type ChatMessageProps,
  isToolPart,
  GROUPABLE_TOOL_BLACKLIST,
} from "@/components/ui/chat-message"

type AdditionalMessageOptions = Omit<ChatMessageProps, "message">

interface MessageListProps {
  messages: UIMessage[]
  showTimeStamps?: boolean
  disableTypingAnimation?: boolean
  messageOptions?:
    | AdditionalMessageOptions
    | ((message: UIMessage) => AdditionalMessageOptions)
}

/**
 * Returns true if this assistant message consists only of whitespace text
 * plus exactly one groupable (non-special) tool part.
 * Such messages can be absorbed into the previous message's tool group.
 */
function isCrossMessageToolContinuation(msg: UIMessage): boolean {
  if (msg.role !== "assistant") return false
  const parts = msg.parts ?? []

  // Must not have any real text or files
  const hasRealContent = parts.some((p) => {
    if (p.type === "file") return true
    if (p.type === "text") return (p as { text?: string }).text?.trim()
    return false
  })
  if (hasRealContent) return false

  // Must have exactly one tool part, and it must be groupable
  const toolParts = parts.filter(isToolPart)
  if (toolParts.length !== 1) return false

  const rawName =
    toolParts[0].type === "dynamic-tool"
      ? (toolParts[0] as { toolName: string }).toolName
      : toolParts[0].type.replace("tool-", "")

  return !GROUPABLE_TOOL_BLACKLIST.has(rawName)
}

function MessageListBase({
  messages,
  showTimeStamps = true,
  disableTypingAnimation = false,
  messageOptions,
}: MessageListProps) {
  const staticOptions = useMemo(
    () => typeof messageOptions === "function" ? undefined : messageOptions,
    [messageOptions]
  )

  // Pre-process: build extraToolParts map and hidden set for cross-message tool grouping
  const { extraToolPartsMap, hiddenMessageIds } = useMemo(() => {
    const extraToolPartsMap = new Map<string, UIMessage["parts"][number][]>()
    const hiddenMessageIds = new Set<string>()

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      if (msg.role !== "assistant") continue
      if (hiddenMessageIds.has(msg.id)) continue

      // This message must end with at least one groupable regular tool call
      const parts = msg.parts ?? []
      const hasGroupableToolCall = parts.some((p) => {
        if (!isToolPart(p)) return false
        const rawName =
          p.type === "dynamic-tool"
            ? (p as { toolName: string }).toolName
            : p.type.replace("tool-", "")
        return !GROUPABLE_TOOL_BLACKLIST.has(rawName)
      })
      if (!hasGroupableToolCall) continue

      // Collect continuation tool parts from subsequent whitespace-only messages
      const extra: UIMessage["parts"][number][] = []
      let j = i + 1
      while (j < messages.length) {
        const next = messages[j]
        if (!isCrossMessageToolContinuation(next)) break
        const toolPart = (next.parts ?? []).find(isToolPart)
        if (toolPart) extra.push(toolPart)
        hiddenMessageIds.add(next.id)
        j++
      }

      if (extra.length > 0) {
        extraToolPartsMap.set(msg.id, extra)
      }
    }

    return { extraToolPartsMap, hiddenMessageIds }
  }, [messages])

  return (
    <div className="space-y-4 overflow-visible">
      {messages.map((message, index) => {
        // Skip messages that were absorbed into a previous group
        if (hiddenMessageIds.has(message.id)) return null

        const additionalOptions = typeof messageOptions === "function" ? messageOptions(message) : staticOptions

        // Actions toolbar should only show on the last message of a consecutive assistant group
        const isLastInGroup = message.role === 'user' || (
          index === messages.length - 1 ||
          messages[index + 1]?.role === 'user'
        )

        const extraToolParts = extraToolPartsMap.get(message.id)

        return (
          <ChatMessage
            key={message.id ?? index}
            message={message}
            showTimeStamp={showTimeStamps}
            disableTypingAnimation={disableTypingAnimation}
            isLastInGroup={isLastInGroup}
            extraToolParts={extraToolParts}
            {...additionalOptions}
          />
        )
      })}
    </div>
  )
}

export const MessageList = memo(MessageListBase)
