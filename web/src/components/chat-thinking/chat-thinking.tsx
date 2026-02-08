import { Sparkles } from "lucide-react"
import { "chat.meta.thinking" as chat_meta_thinking } from '@/paraglide/messages.js';

export function ChatThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground animate-in fade-in">
      <Sparkles className="h-4 w-4 animate-pulse" />
      <span className="relative">
        {chat_meta_thinking()}
        <span className="ml-1 inline-flex">
          <span className="animate-bounce">.</span>
          <span className="animate-bounce [animation-delay:150ms]">.</span>
          <span className="animate-bounce [animation-delay:300ms]">.</span>
        </span>
      </span>
    </div>
  )
}
