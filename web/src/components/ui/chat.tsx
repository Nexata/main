"use client"

import {
  forwardRef,
  useCallback,
  useRef,
  useState,
  type ReactElement,
} from "react"
import { ArrowDown, ThumbsDown, ThumbsUp } from "lucide-react"
import type { UIMessage } from "@ai-sdk/react"
import { cn } from "@/lib/utils"
import { useAutoScroll } from "@/hooks/use-auto-scroll"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import { MessageInput } from "@/components/ui/message-input"
import { MessageList } from "@/components/ui/message-list"
import { ChatThinkingIndicator } from "../chat-thinking/chat-thinking"

function getMessageText(message: UIMessage): string {
  if (!message.parts) return ""

  return message.parts
    .filter((p): p is Extract<typeof p, { type: "text" | "reasoning" }> => p.type === "text" || p.type === "reasoning")
    .map((p) => p.text ?? "")
    .join("")
}

interface ChatPropsBase {
  handleSubmit: (
    event?: { preventDefault?: () => void },
    options?: { attachments?: FileList }
  ) => void
  messages: UIMessage[]
  input: string
  className?: string
  handleInputChange: React.ChangeEventHandler<HTMLTextAreaElement>
  isGenerating: boolean
  stop?: () => void
  onRateResponse?: (
    messageId: string,
    rating: "thumbs-up" | "thumbs-down"
  ) => void
  setMessages?: (messages: UIMessage[]) => void
  transcribeAudio?: (blob: Blob) => Promise<string>
  welcomeLabel?: string
  isHydratingThread?: boolean
  isNewChat?: boolean
  isUserLoading?: boolean
  setExtraReason?: (value: boolean) => void
}

export function Chat({
  messages,
  handleSubmit,
  input,
  handleInputChange,
  stop,
  isGenerating,
  className,
  onRateResponse,
  setMessages,
  transcribeAudio,
  welcomeLabel,
  isHydratingThread,
  isNewChat,
  isUserLoading,
  setExtraReason
}: ChatPropsBase) {
  const isHydrating = isHydratingThread === true
  const isStreaming = isGenerating === true
  const showWelcome = isNewChat && !isHydrating && !isStreaming && messages.length === 0
  const showWelcomeSkeleton = isNewChat && isHydrating && messages.length === 0
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : undefined

  const assistantHasText =
    lastMessage?.role === "assistant" &&
    lastMessage.parts?.some(
      (p) => p.type === "text" && (p.text?.length ?? 0) > 0
    )

  const showThinking = isStreaming && !assistantHasText

  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const handleStop = useCallback(() => {
    stop?.()
  }, [stop])

  const messageOptions = useCallback(
    (message: UIMessage) => {
      const messageText = getMessageText(message)

      return {
        actions: onRateResponse ? (
          <>
            <div className="border-r pr-1">
              <CopyButton
                content={messageText}
                copyMessage="Copied response to clipboard!"
              />
            </div>

            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() =>
                message.id &&
                onRateResponse(message.id, "thumbs-up")
              }
            >
              <ThumbsUp className="h-4 w-4" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() =>
                message.id &&
                onRateResponse(message.id, "thumbs-down")
              }
            >
              <ThumbsDown className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <CopyButton
            content={messageText}
            copyMessage="Copied response to clipboard!"
          />
        ),
      }
    },
    [onRateResponse]
  )

  return (
    <ChatContainer className={className}>
      {showWelcome && (
        <ChatWelcome
          label={welcomeLabel}
          isLoading={isUserLoading}
        />
      )}

      {showWelcomeSkeleton && <ChatWelcome isLoading />}

      {isHydrating && (
        <ChatMessages messages={[]}>
          <ChatMessagesSkeleton />
        </ChatMessages>
      )}

      {!isHydrating && messages.length > 0 && (
        <ChatMessages messages={messages}>
          <MessageList
            messages={messages}
            disableTypingAnimation={
              !isStreaming && lastMessage?.role !== "user"
            }
            messageOptions={messageOptions}
          />

          {showThinking && (
            <div className="px-2 py-1">
              <ChatThinkingIndicator />
            </div>
          )}
        </ChatMessages>
      )}

      <ChatForm
        className="mt-auto"
        isPending={isHydrating || isStreaming}
        handleSubmit={handleSubmit}
      >
        {({ files, setFiles }) => (
          <MessageInput
            value={input}
            onChange={handleInputChange}
            allowAttachments
            files={files}
            setFiles={setFiles}
            stop={handleStop}
            isGenerating={isGenerating}
            transcribeAudio={transcribeAudio}
            setExtraReason={setExtraReason}
          />
        )}
      </ChatForm>
    </ChatContainer>
  )
}
Chat.displayName = "Chat"


export function ChatMessages({
  messages,
  children,
}: React.PropsWithChildren<{
  messages: UIMessage[]
}>) {
  const {
    containerRef,
    scrollToBottom,
    handleScroll,
    shouldAutoScroll,
    handleTouchStart,
  } = useAutoScroll([messages])

  return (
    <div
      className="grid grid-cols-1 overflow-y-auto scrollbar-thin pb-16 min-h-0"
      ref={containerRef}
      onScroll={handleScroll}
      onTouchStart={handleTouchStart}
    >
      <div className="col-[1/1] row-[1/1] flex justify-center">
        <div className="w-full max-w-4xl px-6">
          {children}
        </div>
      </div>

      {!shouldAutoScroll && (
        <div className="pointer-events-none flex flex-1 items-end justify-end col-[1/1] row-[1/1]">
          <div className="sticky bottom-0 left-0 flex w-full justify-end">
            <Button
              onClick={scrollToBottom}
              className="pointer-events-auto h-8 w-8 rounded-full ease-in-out animate-in fade-in-0 slide-in-from-bottom-1"
              size="icon"
              variant="ghost"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export const ChatContainer = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("grid max-h-full w-full grid-rows-[1fr_auto]", className)}
      {...props}
    />
  )
})
ChatContainer.displayName = "ChatContainer"

interface ChatFormProps {
  className?: string
  isPending: boolean
  handleSubmit: (
    event?: { preventDefault?: () => void },
    options?: { attachments?: FileList }
  ) => void
  children: (props: {
    files: File[] | null
    setFiles: React.Dispatch<React.SetStateAction<File[] | null>>
  }) => ReactElement
}

export const ChatForm = forwardRef<HTMLFormElement, ChatFormProps>(
  ({ children, handleSubmit, isPending, className }, ref) => {
    const [files, setFiles] = useState<File[] | null>(null)

    const onSubmit = (event: React.FormEvent) => {
      if (!files) {
        handleSubmit(event)
        return
      }

      const fileList = createFileList(files)
      handleSubmit(event, { attachments: fileList })
      setFiles(null)
    }

    return (
      <form ref={ref} onSubmit={onSubmit} className={className}>
        <div className="flex justify-center">
          <div className="w-full max-w-4xl px-6">
            {children({ files, setFiles })}
          </div>
        </div>
      </form>
    )
  }
)
ChatForm.displayName = "ChatForm"

function createFileList(files: File[] | FileList): FileList {
  const dataTransfer = new DataTransfer()
  for (const file of Array.from(files)) {
    dataTransfer.items.add(file)
  }
  return dataTransfer.files
}

export function ChatMessagesSkeleton() {
  return (
    <div className="flex flex-col gap-6 px-4 py-6 animate-pulse">
      {/* Assistant message — título + párrafo */}
      <div className="flex justify-start">
        <div className="w-[75%] space-y-3">
          {/* Title */}
          <div className="h-6 w-[60%] rounded-md bg-muted" />

          {/* Paragraph */}
          <div className="h-6 w-full rounded-md bg-muted" />
          <div className="h-6 w-[92%] rounded-md bg-muted" />
          <div className="h-6 w-[70%] rounded-md bg-muted" />
        </div>
      </div>

      {/* Assistant message — fake table / list */}
      <div className="flex justify-start">
        <div className="w-[70%] space-y-3">
          {/* Section header */}
          <div className="h-6 w-[45%] rounded-md bg-muted" />

          {/* Rows */}
          <div className="flex gap-3">
            <div className="h-6 w-[30%] rounded-md bg-muted" />
            <div className="h-6 w-[60%] rounded-md bg-muted" />
          </div>
          <div className="flex gap-3">
            <div className="h-6 w-[25%] rounded-md bg-muted" />
            <div className="h-6 w-[55%] rounded-md bg-muted" />
          </div>
          <div className="flex gap-3">
            <div className="h-6 w-[35%] rounded-md bg-muted" />
            <div className="h-6 w-[50%] rounded-md bg-muted" />
          </div>
        </div>
      </div>

      {/* User message — burbuja */}
      <div className="flex justify-end">
        <div className="w-[45%] space-y-3 rounded-2xl bg-muted p-4">
          <div className="h-6 w-full rounded bg-background/60" />
          <div className="h-6 w-[75%] rounded bg-background/60" />
        </div>
      </div>

      {/* Assistant message — bullets / emojis */}
      <div className="flex justify-start">
        <div className="w-[65%] space-y-3">
          {/* Bullet header */}
          <div className="h-6 w-[50%] rounded-md bg-muted" />

          {/* Bullet rows */}
          <div className="flex gap-3">
            <div className="h-6 w-6 rounded-full bg-muted" />
            <div className="h-6 w-[70%] rounded-md bg-muted" />
          </div>
          <div className="flex gap-3">
            <div className="h-6 w-6 rounded-full bg-muted" />
            <div className="h-6 w-[60%] rounded-md bg-muted" />
          </div>
          <div className="flex gap-3">
            <div className="h-6 w-6 rounded-full bg-muted" />
            <div className="h-6 w-[50%] rounded-md bg-muted" />
          </div>
        </div>
      </div>

      {/* User short reply */}
      <div className="flex justify-end">
        <div className="w-[30%] rounded-2xl bg-muted p-4">
          <div className="h-6 w-full rounded bg-background/60" />
        </div>
      </div>
    </div>
  )
}

// CHAT WELCOME
interface ChatWelcomeProps {
  label?: string
  isLoading?: boolean
}

export function ChatWelcome({ label, isLoading }: ChatWelcomeProps) {
  if (!label && !isLoading) return null

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      {isLoading ? (
        <div className="animate-pulse">
          <div className="h-10 w-130 rounded-md bg-muted" />
        </div>
      ) : (
        <h2
          className="
            text-2xl md:text-3xl
            font-semibold
            tracking-tight
            text-center
            text-black dark:text-white
            transition-colors
          "
        >
          {label}
        </h2>
      )}
    </div>
  )
}
