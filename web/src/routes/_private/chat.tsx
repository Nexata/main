'use client'

import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Chat } from '@/components/ui/chat'
import { 'chat.meta.title' as chat_meta_title } from '@/paraglide/messages.js'

import { useChat } from '@ai-sdk/react'
import { createAuthenticatedChatTransport } from '@/lib/chat-transport'

export const Route = createFileRoute('/_private/chat')({
  component: NexataChat,
  validateSearch: (search: Record<string, unknown>) => ({
    threadId: typeof search.threadId === 'string' ? search.threadId : null,
  }),
})

export function NexataChat() {
  const { threadId } = Route.useSearch()

  useEffect(() => {
    document.title = chat_meta_title()
  }, [])

  const [input, setInput] = useState('')

  const transport = useMemo(
    () => createAuthenticatedChatTransport(threadId),
    [threadId],
  )

  const {
    messages,
    sendMessage,
    status,
    stop,
    error,
  } = useChat({
    transport,
  })

  const isGenerating = status === 'streaming'

  const handleSubmit = async (
    event?: { preventDefault?: () => void },
    options?: { attachments?: FileList }
  ) => {
    event?.preventDefault?.()

    if (!input.trim()) return

    await sendMessage({
      text: input,
      files: options?.attachments,
    })

    setInput('')
  }

  return (
    <div className="flex flex-col h-full w-full min-h-0">
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <Chat
          className="flex-1 min-h-0"
          messages={messages}
          input={input}
          handleInputChange={(e) => setInput(e.target.value)}
          handleSubmit={handleSubmit}
          isGenerating={isGenerating}
          stop={stop}
        />

        {error && (
          <div className="text-xs text-red-500 text-center mt-1">
            Error: {error.message}
          </div>
        )}

        <div className="text-xs mt-1 w-full text-center text-muted-foreground">
          Nexata's Chat ®
        </div>
      </div>
    </div>
  )
}

