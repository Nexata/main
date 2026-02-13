import type { UIMessage } from "@ai-sdk/react"
import {
  ChatMessage,
  type ChatMessageProps,
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

export function MessageList({
  messages,
  showTimeStamps = true,
  disableTypingAnimation = false,
  messageOptions,
}: MessageListProps) {
  return (
    <div className="space-y-4 overflow-visible">
      {messages.map((message, index) => {
        const additionalOptions = typeof messageOptions === "function" ? messageOptions(message) : messageOptions

        return (
          <ChatMessage
            key={message.id ?? index}
            message={message}
            showTimeStamp={showTimeStamps}
            disableTypingAnimation={disableTypingAnimation}
            {...additionalOptions}
          />
        )
      })}
    </div>
  )
}
