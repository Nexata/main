import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"
import {
  "clipboard.copy_success" as clipboard_copy_success,
  "clipboard.copy_error" as clipboard_copy_error,
} from "@/paraglide/messages.js"

type UseCopyToClipboardProps = {
  text: string
  copyMessage?: string
}

export function useCopyToClipboard({
  text,
  copyMessage,
}: UseCopyToClipboardProps) {
  const [isCopied, setIsCopied] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success(copyMessage ?? clipboard_copy_success())
        setIsCopied(true)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        timeoutRef.current = setTimeout(() => {
          setIsCopied(false)
        }, 2000)
      })
      .catch(() => {
        toast.error(clipboard_copy_error())
      })
  }, [text, copyMessage])

  return { isCopied, handleCopy }
}
