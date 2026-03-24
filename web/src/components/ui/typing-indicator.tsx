"use client"

import { Loader2 } from "lucide-react"
import { "chat.meta.thinking" as chat_meta_thinking } from "@/paraglide/messages.js"

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">{chat_meta_thinking()}...</span>
    </div>
  )
}
