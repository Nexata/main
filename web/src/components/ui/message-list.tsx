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

function extractTextFromParts(message: UIMessage): string {
  if (!message.parts) return ""

  return message.parts
    .filter(
      (part) => part.type === "text" || part.type === "reasoning"
    )
    .map((part) => {
      if (part.type === "text") return part.text
      if (part.type === "reasoning") return part.text
      return ""
    })
    .join("")
}

function uiMessageToMessage(message: UIMessage): Message {
  return {
    id: message.id,
    role:
      message.role === "user" || message.role === "assistant"
        ? message.role
        : "assistant",
    content: extractTextFromParts(message),
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
