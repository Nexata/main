"use client"
import type { useChat } from '@ai-sdk/react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
} from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowDown, Calendar, Eye, FileText, Loader2, Mail, Search } from "lucide-react"
import type { UIMessage } from "@ai-sdk/react"
import { cn } from "@/lib/utils"
import { useAutoScroll } from "@/hooks/use-auto-scroll"
import { Button } from "@/components/ui/button"
import { MessageInput } from "@/components/ui/message-input"
import { MessageList } from "@/components/ui/message-list"
import { ChatThinkingIndicator } from "../chat-thinking/chat-thinking"
import {
  'chat.suggestions.prompt_1' as chat_suggestions_prompt_1,
  'chat.suggestions.prompt_2' as chat_suggestions_prompt_2,
  'chat.suggestions.prompt_3' as chat_suggestions_prompt_3,
  'chat.suggestions.prompt_4' as chat_suggestions_prompt_4,
  'chat.shared.banner' as chat_shared_banner,
  'chat.meta.syncing' as chat_meta_syncing,
} from '@/paraglide/messages.js'

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
  transcribeAudio?: (blob: Blob) => Promise<string>
  welcomeLabel?: string
  isHydratingThread?: boolean
  isNewChat?: boolean
  isUserLoading?: boolean
  setExtraReason?: (value: boolean) => void
  addToolOutput?: ReturnType<typeof useChat>['addToolOutput']
  addToolApprovalResponse?: ReturnType<typeof useChat>['addToolApprovalResponse']
  onEditMessage?: (messageId: string, newText: string) => void
  onBranchOff?: (messageId: string) => void
  onRetry?: (messageId: string) => void
  isReadOnly?: boolean
  isSyncing?: boolean
  onLoadOlderMessages?: () => void
  isFetchingOlderMessages?: boolean
  hasOlderMessages?: boolean
  onShareThread?: () => void
}

export function Chat({
  messages,
  handleSubmit,
  input,
  handleInputChange,
  stop,
  isGenerating,
  className,
  transcribeAudio,
  welcomeLabel,
  isHydratingThread,
  isNewChat,
  isUserLoading,
  setExtraReason,
  addToolOutput,
  addToolApprovalResponse,
  onEditMessage,
  onBranchOff,
  onRetry,
  isReadOnly,
  isSyncing,
  onLoadOlderMessages,
  isFetchingOlderMessages,
  hasOlderMessages,
  onShareThread,
}: ChatPropsBase) {
  const isHydrating = isHydratingThread === true
  const isStreaming = isGenerating === true
  const showWelcome = isNewChat && !isHydrating && !isStreaming && messages.length === 0
  const showWelcomeSkeleton = isNewChat && isHydrating && messages.length === 0
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : undefined

  const isAwaitingToolInput = !isStreaming && messages.some((msg) => {
    if (msg.role !== 'assistant') return false
    return (msg.parts ?? []).some((p) => {
      const part = p as Record<string, unknown>
      return (
        (part['type'] === 'tool-NexataAskQuestions' ||
          (part['type'] === 'dynamic-tool' && part['toolName'] === 'NexataAskQuestions')) &&
        part['state'] === 'input-available'
      )
    })
  })

  const assistantHasText =
    lastMessage?.role === "assistant" &&
    lastMessage.parts?.some((p) => p.type === "text" && (p.text?.length ?? 0) > 0)

  const assistantHasReasoning =
    lastMessage?.role === "assistant" &&
    lastMessage.parts?.some((p) => p.type === "reasoning")

  const showThinking = isStreaming && !assistantHasText && !assistantHasReasoning

  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const handleStop = useCallback(() => {
    stop?.()
  }, [stop])

  const messageOptions = useCallback(
    (message: UIMessage) => {
      return {
        addToolOutput,
        addToolApprovalResponse,
        onEdit: onEditMessage,
        onBranchOff,
        onRetry,
        isStreaming: isStreaming && message.id === lastMessage?.id,
        isChatStreaming: isStreaming,
        isSyncing,
      }
    },
    [addToolOutput, addToolApprovalResponse, onEditMessage, onBranchOff, onRetry, isStreaming, isSyncing, lastMessage?.id]
  )

  return (
    <ChatContainer className={className}>
      {/* Row 1 — relative wrapper so exiting/entering panels can overlap via
          absolute positioning without disturbing the grid during transitions */}
      <div className="relative min-h-0 overflow-hidden">
        <AnimatePresence initial={false}>
          {(showWelcome || showWelcomeSkeleton) && (
            <motion.div
              key="welcome"
              className="absolute inset-0 flex flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              {showWelcomeSkeleton ? (
                <ChatWelcome isLoading />
              ) : (
                <ChatWelcome
                  label={welcomeLabel}
                  isLoading={isUserLoading}
                  handleSubmit={handleSubmit}
                  input={input}
                  handleInputChange={handleInputChange}
                  isGenerating={isGenerating}
                  stop={stop}
                  transcribeAudio={transcribeAudio}
                  setExtraReason={setExtraReason}
                />
              )}
            </motion.div>
          )}

          {isHydrating && (
            <motion.div
              key="hydrating"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChatMessages messages={[]}>
                <ChatMessagesSkeleton />
              </ChatMessages>
            </motion.div>
          )}

          {!showWelcome && !showWelcomeSkeleton && !isHydrating && (
            <motion.div
              key="messages"
              className="absolute inset-0"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <ChatMessages
                messages={messages}
                onLoadOlderMessages={onLoadOlderMessages}
                isFetchingOlderMessages={isFetchingOlderMessages}
                hasOlderMessages={hasOlderMessages}
              >
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

                {!isStreaming && isSyncing && (
                  <div className="flex items-center gap-2.5 px-2 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary/70" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {chat_meta_syncing()}
                    </span>
                  </div>
                )}
              </ChatMessages>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Row 2 — form slides up when leaving the welcome state */}
      <AnimatePresence>
        {!showWelcome && !showWelcomeSkeleton && (
          <motion.div
            key="chat-form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {isReadOnly ? (
              <div className="flex justify-center">
                <div className="w-full max-w-4xl px-6">
                  <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                    <Eye className="h-4 w-4 shrink-0 opacity-80" />
                    <span>{chat_shared_banner()}</span>
                  </div>
                </div>
              </div>
            ) : (
              <ChatForm
                isPending={isHydrating || isStreaming || !!isSyncing}
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
                    isAwaitingToolInput={isAwaitingToolInput}
                    transcribeAudio={transcribeAudio}
                    setExtraReason={setExtraReason}
                    onShareThread={onShareThread}
                  />
                )}
              </ChatForm>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </ChatContainer>
  )
}
Chat.displayName = "Chat"


export function ChatMessages({
  messages,
  children,
  onLoadOlderMessages,
  isFetchingOlderMessages,
  hasOlderMessages,
}: React.PropsWithChildren<{
  messages: UIMessage[]
  onLoadOlderMessages?: () => void
  isFetchingOlderMessages?: boolean
  hasOlderMessages?: boolean
}>) {
  const {
    containerRef,
    scrollToBottom,
    handleScroll: autoScrollHandler,
    shouldAutoScroll,
    handleTouchStart,
  } = useAutoScroll([messages])

  // --- Scroll-to-top detection for loading older messages ---
  const SCROLL_TOP_THRESHOLD = 100
  const loadTriggeredRef = useRef(false)

  // Reset trigger guard when fetch completes
  useEffect(() => {
    if (!isFetchingOlderMessages) {
      loadTriggeredRef.current = false
    }
  }, [isFetchingOlderMessages])

  // --- Preserve scroll position when messages are prepended ---
  const prevFirstMessageIdRef = useRef<string | null>(null)
  const scrollSnapshotRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null)

  // Before render: snapshot scroll if the first message is about to change
  const firstMessageId = messages.length > 0 ? messages[0]?.id ?? null : null

  if (
    prevFirstMessageIdRef.current !== null &&
    firstMessageId !== prevFirstMessageIdRef.current &&
    containerRef.current
  ) {
    // A prepend is about to happen — snapshot current scroll
    scrollSnapshotRef.current = {
      scrollHeight: containerRef.current.scrollHeight,
      scrollTop: containerRef.current.scrollTop,
    }
  }

  useLayoutEffect(() => {
    const el = containerRef.current
    const snapshot = scrollSnapshotRef.current

    if (el && snapshot) {
      const heightDelta = el.scrollHeight - snapshot.scrollHeight
      el.scrollTop = snapshot.scrollTop + heightDelta
      scrollSnapshotRef.current = null
    }

    prevFirstMessageIdRef.current = firstMessageId
  }, [firstMessageId, containerRef])

  const handleScroll = useCallback(() => {
    autoScrollHandler()

    const el = containerRef.current
    if (!el) return

    if (
      hasOlderMessages &&
      !isFetchingOlderMessages &&
      !loadTriggeredRef.current &&
      el.scrollTop < SCROLL_TOP_THRESHOLD &&
      onLoadOlderMessages
    ) {
      loadTriggeredRef.current = true
      onLoadOlderMessages()
    }
  }, [autoScrollHandler, containerRef, hasOlderMessages, isFetchingOlderMessages, onLoadOlderMessages])

  return (
    <div
      className="grid grid-cols-1 h-full overflow-y-auto scrollbar-thin pb-16 min-h-0"
      ref={containerRef}
      onScroll={handleScroll}
      onTouchStart={handleTouchStart}
    >
      <div className="col-[1/1] row-[1/1] flex justify-center">
        <div className="w-full max-w-4xl px-6 pt-4 sm:pt-6">
          {isFetchingOlderMessages && (
            <div className="flex justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {children}
          {/* Bottom spacer */}
          <div className="h-4" />
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
      if (isPending) {
        event.preventDefault()
        return
      }

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
        <div className="flex justify-center" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}>
          <div className="w-full max-w-4xl px-6 max-sm:px-3">
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
  handleSubmit?: (
    event?: { preventDefault?: () => void },
    options?: { attachments?: FileList }
  ) => void
  input?: string
  handleInputChange?: React.ChangeEventHandler<HTMLTextAreaElement>
  isGenerating?: boolean
  stop?: () => void
  transcribeAudio?: (blob: Blob) => Promise<string>
  setExtraReason?: (value: boolean) => void
}

export function ChatWelcome({
  label,
  isLoading,
  handleSubmit,
  input,
  handleInputChange,
  isGenerating,
  stop,
  transcribeAudio,
  setExtraReason,
}: ChatWelcomeProps) {
  const [files, setFiles] = useState<File[] | null>(null)

  if (!label && !isLoading) return null

  const suggestions = [
    { Icon: Mail,     text: chat_suggestions_prompt_1() },
    { Icon: FileText, text: chat_suggestions_prompt_2() },
    { Icon: Calendar, text: chat_suggestions_prompt_3() },
    { Icon: Search,   text: chat_suggestions_prompt_4() },
  ] as const

  const triggerSuggestion = (text: string) => {
    handleInputChange?.({ target: { value: text } } as React.ChangeEvent<HTMLTextAreaElement>)
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!handleSubmit) return
    if (!files) {
      handleSubmit(e)
      return
    }
    const fileList = createFileList(files)
    handleSubmit(e, { attachments: fileList })
    setFiles(null)
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 gap-8 pb-6">
      {isLoading ? (
        <div className="flex flex-col items-center gap-8 w-full max-w-2xl animate-pulse">
          {/* Heading */}
          <div className="flex flex-col items-center gap-3 w-full px-4">
            <div className="h-9 md:h-11 lg:h-14 w-[85%] md:w-[70%] rounded-xl bg-muted" />
            <div className="h-9 md:h-11 lg:h-14 w-[55%] md:w-[45%] rounded-xl bg-muted" />
          </div>

          {/* Input box */}
          <div className="w-full px-4 md:px-0">
            <div className="h-[56px] w-full rounded-2xl bg-muted" />
          </div>

          {/* Suggestion chips */}
          <div className="flex flex-wrap gap-2 justify-center w-full px-4">
            {[110, 155, 135, 165].map((w, i) => (
              <div
                key={i}
                className="h-9 rounded-full bg-muted"
                style={{ width: `${w}px` }}
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-center text-foreground max-w-2xl"
          >
            {label}
          </motion.h1>

          {handleSubmit && (
            <>
              <motion.form
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
                onSubmit={onSubmit}
                className="w-full max-w-2xl"
              >
                <MessageInput
                  value={input ?? ""}
                  onChange={handleInputChange!}
                  allowAttachments
                  files={files}
                  setFiles={setFiles}
                  stop={stop}
                  isGenerating={isGenerating ?? false}
                  transcribeAudio={transcribeAudio}
                  setExtraReason={setExtraReason}
                />
              </motion.form>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.18 }}
                className="flex flex-wrap gap-2 justify-center max-w-2xl w-full"
              >
                {suggestions.map((s, i) => (
                  <motion.button
                    key={i}
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.2 + i * 0.07, ease: "easeOut" }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => triggerSuggestion(s.text)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-background hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer"
                  >
                    <s.Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{s.text}</span>
                  </motion.button>
                ))}
              </motion.div>
            </>
          )}
        </>
      )}
    </div>
  )
}
