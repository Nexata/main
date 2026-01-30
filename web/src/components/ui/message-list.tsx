import type { UIMessage } from "@ai-sdk/react"

import {
  ChatMessage,
  type ChatMessageProps,
  type Message,
} from "@/components/ui/chat-message"
import { TypingIndicator } from "@/components/ui/typing-indicator"

type AdditionalMessageOptions = Omit<ChatMessageProps, keyof Message>

interface MessageListProps {
  messages: UIMessage[]
  showTimeStamps?: boolean
  isTyping?: boolean
  messageOptions?:
    | AdditionalMessageOptions
    | ((message: UIMessage) => AdditionalMessageOptions)
}

function extractParts(message: UIMessage) {
  const reasoning =
    message.parts
      ?.filter((part) => part.type === "reasoning")
      .map((part) => part.text)
      .join("") ?? ""

  const text =
    message.parts
      ?.filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("") ?? ""

  return { reasoning, text }
}

function uiMessageToMessage(message: UIMessage): Message {
  const { reasoning, text } = extractParts(message)

  return {
    id: message.id,
    role:
      message.role === "user" || message.role === "assistant"
        ? message.role
        : "assistant",
    content: text,
    reasoning: reasoning || undefined,
  }
}

export function MessageList({
  messages,
  showTimeStamps = true,
  isTyping = false,
  messageOptions,
}: MessageListProps) {
  return (
    <div className="space-y-4 overflow-visible">
      {messages.map((uiMessage, index) => {
        const message = uiMessageToMessage(uiMessage)

        const additionalOptions =
          typeof messageOptions === "function"
            ? messageOptions(uiMessage)
            : messageOptions

        return (
          <ChatMessage
            key={message.id ?? index}
            showTimeStamp={showTimeStamps}
            {...message}
            {...additionalOptions}
          />
        )
      })}

      {isTyping && <TypingIndicator />}
    </div>
  )
}
