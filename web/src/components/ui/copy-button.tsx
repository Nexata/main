"use client"

import { Check, Copy } from "lucide-react"

import { cn } from "@/lib/utils"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  'chat.copy.copy' as chat_copy_copy,
  'chat.copy.copied' as chat_copy_copied,
} from '@/paraglide/messages.js'

type CopyButtonProps = {
  content: string
  copyMessage?: string
}

export function CopyButton({ content, copyMessage }: CopyButtonProps) {
  const { isCopied, handleCopy } = useCopyToClipboard({
    text: content,
    copyMessage,
  })

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-6 w-6"
          aria-label="Copy to clipboard"
          onClick={handleCopy}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <Check
              className={cn(
                "h-4 w-4 transition-transform ease-in-out",
                isCopied ? "scale-100" : "scale-0"
              )}
            />
          </div>

          <Copy
            className={cn(
              "h-4 w-4 transition-transform ease-in-out",
              isCopied ? "scale-0" : "scale-100"
            )}
          />
        </Button>
      </TooltipTrigger>

      <TooltipContent side="bottom" className="text-xs">
        {isCopied ? chat_copy_copied() : chat_copy_copy()}
      </TooltipContent>
    </Tooltip>
  )
}
