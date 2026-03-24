"use client"

import React, { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowUp, Info, Loader2, Paperclip, Square, Brain, X  } from "lucide-react"
import { omit } from "remeda"
import { cn } from "@/lib/utils"
import { useAudioRecording } from "@/hooks/use-audio-recording"
import { useAutosizeTextArea } from "@/hooks/use-autosize-textarea"
import { AudioVisualizer } from "@/components/ui/audio-visualizer"
import { Button } from "@/components/ui/button"
import { FilePreview } from "@/components/ui/file-preview"
import { InterruptPrompt } from "@/components/ui/interrupt-prompt"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  "common.ask_nexy" as common_ask_nexy,
  "common.brain" as common_brain,
  "common.attachment" as common_attachment,
  "common.brain_description" as common_brain_description,
  "chat.drop_files" as chat_drop_files
} from "@/paraglide/messages.js";


interface MessageInputBaseProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string
  submitOnEnter?: boolean
  stop?: () => void
  isGenerating: boolean
  enableInterrupt?: boolean
  transcribeAudio?: (blob: Blob) => Promise<string>
  setExtraReason?: (value: boolean) => void
}

interface MessageInputWithoutAttachmentProps extends MessageInputBaseProps {
  allowAttachments?: false
}

interface MessageInputWithAttachmentsProps extends MessageInputBaseProps {
  allowAttachments: true
  files: File[] | null
  setFiles: React.Dispatch<React.SetStateAction<File[] | null>>
}

type MessageInputProps =
  | MessageInputWithoutAttachmentProps
  | MessageInputWithAttachmentsProps

export function MessageInput({
  placeholder,
  className,
  onKeyDown: onKeyDownProp,
  submitOnEnter = true,
  stop,
  isGenerating,
  enableInterrupt = true,
  transcribeAudio,
  setExtraReason,
  ...props
}: MessageInputProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [showInterruptPrompt, setShowInterruptPrompt] = useState(false)
  const resolvedPlaceholder = placeholder ?? common_ask_nexy()
  const [brainMode, setBrainMode] = useState(false)
  const [dismissedWarning, setDismissedWarning] = useState<boolean>(() => {
    try { return localStorage.getItem('nexata-brain-warning-dismissed') === 'true' } catch { return false }
  })

  const {
    isListening,
    isSpeechSupported,
    isRecording,
    isTranscribing,
    audioStream,
    toggleListening,
    stopRecording,
  } = useAudioRecording({
    transcribeAudio,
    onTranscriptionComplete: (text) => {
      props.onChange?.({ target: { value: text } } as any)
    },
  })

  useEffect(() => {
    if (!isGenerating) {
      setShowInterruptPrompt(false)
    }
  }, [isGenerating])

  const addFiles = (files: File[] | null) => {
    if (props.allowAttachments) {
      props.setFiles((currentFiles) => {
        if (currentFiles === null) {
          return files
        }

        if (files === null) {
          return currentFiles
        }

        return [...currentFiles, ...files]
      })
    }
  }

  const onDragOver = (event: React.DragEvent) => {
    if (props.allowAttachments !== true) return
    event.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = (event: React.DragEvent) => {
    if (props.allowAttachments !== true) return
    event.preventDefault()
    setIsDragging(false)
  }

  const onDrop = (event: React.DragEvent) => {
    setIsDragging(false)
    if (props.allowAttachments !== true) return
    event.preventDefault()
    const dataTransfer = event.dataTransfer
    if (dataTransfer.files.length) {
      addFiles(Array.from(dataTransfer.files))
    }
  }

  const onPaste = (event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items
    if (!items) return

    const text = event.clipboardData.getData("text")
    if (text && text.length > 500 && props.allowAttachments) {
      event.preventDefault()
      const blob = new Blob([text], { type: "text/plain" })
      const file = new File([blob], "Pasted text", {
        type: "text/plain",
        lastModified: Date.now(),
      })
      addFiles([file])
      return
    }

    const files = Array.from(items)
      .map((item) => item.getAsFile())
      .filter((file) => file !== null)

    if (props.allowAttachments && files.length > 0) {
      addFiles(files)
    }
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget
    let caret = el.selectionStart

    if (event.key === "Enter") caret += 1
    caretRef.current = caret

    if (submitOnEnter && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()

      if (isGenerating && stop && enableInterrupt) {
        if (showInterruptPrompt) {
          stop()
          setShowInterruptPrompt(false)
          event.currentTarget.form?.requestSubmit()
        } else if (
          props.value ||
          (props.allowAttachments && props.files?.length)
        ) {
          setShowInterruptPrompt(true)
          return
        }
      }

      event.currentTarget.form?.requestSubmit()
    }

    onKeyDownProp?.(event)
  }

  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const caretRef = useRef<number | null>(null)
  const [textAreaHeight, setTextAreaHeight] = useState<number>(0)

  useEffect(() => {
    if (textAreaRef.current) {
      setTextAreaHeight(textAreaRef.current.offsetHeight)
    }
  }, [props.value])

  const showFileList =
    props.allowAttachments && props.files && props.files.length > 0

  useAutosizeTextArea({
    ref: textAreaRef,
    maxHeight: 240,
    borderWidth: 1,
    dependencies: [props.value, showFileList],
  })

  const hasFiles = props.allowAttachments && props.files && props.files.length > 0
  const hasContent = props.value.length > 0
  const expandedByText = hasContent && textAreaHeight > 40
  const isExpanded = expandedByText || hasFiles

  const prevExpandedRef = useRef(isExpanded)

  useEffect(() => {
    const el = textAreaRef.current
    if (!el) return

    const didChange = prevExpandedRef.current !== isExpanded
    prevExpandedRef.current = isExpanded

    if (!didChange) return

    requestAnimationFrame(() => {
      el.focus()
      const len = el.value.length
      el.setSelectionRange(len, len)
      el.scrollTop = el.scrollHeight
    })
  }, [isExpanded])

  return (
    <div
      className="relative flex w-full flex-col"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {enableInterrupt && (
        <InterruptPrompt
          isOpen={showInterruptPrompt}
          close={() => setShowInterruptPrompt(false)}
        />
      )}

      <RecordingPrompt
        isVisible={isRecording}
        onStopRecording={stopRecording}
      />

      <motion.div
        layout
        animate={{ borderRadius: isExpanded ? 20 : 999 }}
        transition={{
          layout: {
            type: "spring",
            stiffness: 380,
            damping: 32,
          },
          borderRadius: {
            type: "spring",
            stiffness: 260,
            damping: 20,
          },
        }}
        className={cn(
          "relative w-full border bg-muted shadow-sm px-2 py-2",
          isExpanded ? "flex flex-col gap-2" : "flex items-center gap-2"
        )}
      >
        {/* ROW — estado compacto */}
        {!isExpanded && (
          <>
            <Tooltip>
              <TooltipTrigger>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "h-8 w-8 rounded-full cursor-pointer transition-colors",
                    brainMode
                      ? "text-pink-400 bg-pink-100 dark:bg-pink-950/60 ring-1 ring-pink-400/40"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setBrainMode(v => {
                      const next = !v
                      setExtraReason?.(next)
                      return next
                    })
                  }}
                >
                  <Brain className={cn("h-5 w-5", brainMode && "drop-shadow-[0_0_4px_theme(colors.pink.400)]")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{common_brain()}</TooltipContent>
            </Tooltip>

            <textarea
              aria-label="Write your prompt here"
              placeholder={resolvedPlaceholder}
              ref={textAreaRef}
              onPaste={onPaste}
              onKeyDown={onKeyDown}
              className={cn(
                "flex-1 resize-none bg-transparent border-none outline-none",
                "text-sm leading-5",
                "h-9 py-2",
                "overflow-y-auto scrollbar-thin",
                "placeholder:text-muted-foreground",
                className
              )}
              {...(props.allowAttachments
                ? omit(props, ["allowAttachments", "files", "setFiles"])
                : omit(props, ["allowAttachments"]))}
            />

            {/* Right buttons */}
            <div className="flex items-center gap-1">
              {props.allowAttachments && (
                <Tooltip>
                  <TooltipTrigger>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full cursor-pointer"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={async () => {
                        const files = await showFileUploadDialog()
                        addFiles(files)
                      }}
                    >
                      <Paperclip className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{common_attachment()}</TooltipContent>
                </Tooltip>
              )}

              {isGenerating && stop ? (
                <Button
                  type="button"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-foreground text-background cursor-pointer"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={stop}
                >
                  <Square className="h-5 w-5 animate-pulse" fill="currentColor" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-foreground text-background cursor-pointer"
                  disabled={props.value === "" || isGenerating}
                >
                  <ArrowUp className="h-5 w-5" />
                </Button>
              )}
            </div>
          </>
        )}

        {/* EXPANDED MODE */}
        {isExpanded && (
          <>
            <textarea
              aria-label="Write your prompt here"
              placeholder={resolvedPlaceholder}
              ref={textAreaRef}
              onPaste={onPaste}
              onKeyDown={onKeyDown}
              className={cn(
                "w-full resize-none bg-transparent border-none outline-none",
                "text-sm leading-tight",
                "py-2 px-4",
                "min-h-0",
                "overflow-y-auto scrollbar-thin",
                "placeholder:text-muted-foreground",
                className
              )}
              {...(props.allowAttachments
                ? omit(props, ["allowAttachments", "files", "setFiles"])
                : omit(props, ["allowAttachments"]))}
            />

            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "h-8 w-8 rounded-full cursor-pointer transition-colors",
                      brainMode
                        ? "text-pink-400 bg-pink-100 dark:bg-pink-950/60 ring-1 ring-pink-400/40"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setBrainMode(v => {
                        const next = !v
                        setExtraReason?.(next)
                        return next
                      })
                    }}
                  >
                    <Brain className={cn("h-5 w-5", brainMode && "drop-shadow-[0_0_4px_theme(colors.pink.400)]")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{common_brain()}</TooltipContent>
              </Tooltip>

              {props.allowAttachments && props.files?.length && (
                <motion.div
                  layout
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 overflow-hidden"
                >
                  <FilePreviewRow
                    files={props.files}
                    setFiles={props.setFiles}
                  />
                </motion.div>
              )}

              <div className="ml-auto flex items-center gap-1">
                {props.allowAttachments && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full cursor-pointer"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={async () => {
                          const files = await showFileUploadDialog()
                          addFiles(files)
                        }}
                      >
                        <Paperclip className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{common_attachment()}</TooltipContent>
                  </Tooltip>
                )}

                {isGenerating && stop ? (
                  <Button
                    type="button"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-foreground text-background cursor-pointer"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={stop}
                  >
                    <Square className="h-5 w-5 animate-pulse" fill="currentColor" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-foreground text-background cursor-pointer"
                    disabled={props.value === "" || isGenerating}
                  >
                    <ArrowUp className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </motion.div>

      {props.allowAttachments && <FileUploadOverlay isDragging={isDragging} />}

      <RecordingControls
        isRecording={isRecording}
        isTranscribing={isTranscribing}
        audioStream={audioStream}
        textAreaHeight={textAreaHeight}
        onStopRecording={stopRecording}
      />

      <AnimatePresence>
        {brainMode && !dismissedWarning && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 flex justify-center w-full"
          >
            <div
              className={cn(
                "flex items-start gap-3 rounded-lg border px-3 py-2 w-[90%] max-w-full",
                "border-amber-500/40 bg-amber-100 dark:bg-amber-950",
                "text-amber-800 dark:text-amber-200",
                "text-xs leading-relaxed shadow-sm"
              )}
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0 opacity-90" />

              <p className="text-center sm:text-left flex-1">
                {common_brain_description()}
              </p>

              <button
                type="button"
                onClick={() => {
                  try { localStorage.setItem('nexata-brain-warning-dismissed', 'true') } catch {}
                  setDismissedWarning(true)
                }}
                className="ml-1 shrink-0 rounded-md p-0.5 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
MessageInput.displayName = "MessageInput"

interface FileUploadOverlayProps {
  isDragging: boolean
}

function FileUploadOverlay({ isDragging }: FileUploadOverlayProps) {
  return (
    <AnimatePresence>
      {isDragging && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center space-x-2 rounded-xl border border-dashed border-border bg-background text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          aria-hidden
        >
          <Paperclip className="h-4 w-4" />
          <span>{chat_drop_files()}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function showFileUploadDialog() {
  const input = document.createElement("input")

  input.type = "file"
  input.multiple = true
  input.accept = "*/*"
  input.click()

  return new Promise<File[] | null>((resolve) => {
    input.onchange = (e) => {
      const files = (e.currentTarget as HTMLInputElement).files

      if (files) {
        resolve(Array.from(files))
        return
      }

      resolve(null)
    }
  })
}

function TranscribingOverlay() {
  return (
    <motion.div
      className="flex h-full w-full flex-col items-center justify-center rounded-xl bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="relative">
        <Loader2 className="h-9 w-9 animate-spin text-primary" />
        <motion.div
          className="absolute inset-0 h-9 w-9 animate-pulse rounded-full bg-primary/20"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1.2, opacity: 1 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
          }}
        />
      </div>
      <p className="mt-4 text-sm font-medium text-muted-foreground">
        Transcribing audio...
      </p>
    </motion.div>
  )
}

interface RecordingPromptProps {
  isVisible: boolean
  onStopRecording: () => void
}

function RecordingPrompt({ isVisible, onStopRecording }: RecordingPromptProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ top: 0, filter: "blur(5px)" }}
          animate={{
            top: -40,
            filter: "blur(0px)",
            transition: {
              type: "spring",
              filter: { type: "tween" },
            },
          }}
          exit={{ top: 0, filter: "blur(5px)" }}
          className="absolute left-1/2 flex -translate-x-1/2 cursor-pointer overflow-hidden whitespace-nowrap rounded-full border bg-background py-1 text-center text-sm text-muted-foreground"
          onClick={onStopRecording}
        >
          <span className="mx-2.5 flex items-center">
            <Info className="mr-2 h-3 w-3" />
            Click to finish recording
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface RecordingControlsProps {
  isRecording: boolean
  isTranscribing: boolean
  audioStream: MediaStream | null
  textAreaHeight: number
  onStopRecording: () => void
}

function RecordingControls({
  isRecording,
  isTranscribing,
  audioStream,
  textAreaHeight,
  onStopRecording,
}: RecordingControlsProps) {
  if (isRecording) {
    return (
      <div
        className="absolute inset-px z-50 overflow-hidden rounded-xl"
        style={{ height: textAreaHeight - 2 }}
      >
        <AudioVisualizer
          stream={audioStream}
          isRecording={isRecording}
          onClick={onStopRecording}
        />
      </div>
    )
  }

  if (isTranscribing) {
    return (
      <div
        className="absolute inset-px z-50 overflow-hidden rounded-xl"
        style={{ height: textAreaHeight - 2 }}
      >
        <TranscribingOverlay />
      </div>
    )
  }

  return null
}

function FilePreviewRow({
  files,
  setFiles,
}: {
  files: File[]
  setFiles: React.Dispatch<React.SetStateAction<File[] | null>>
}) {
  const MAX_VISIBLE = 3
  const visible = files.slice(0, MAX_VISIBLE)
  const overflow = files.length - MAX_VISIBLE

  return (
    <div className="flex items-center gap-2">
      <AnimatePresence mode="popLayout">
        {visible.map((file) => (
          <FilePreview
            key={file.name + file.lastModified}
            file={file}
            onRemove={() => {
              setFiles((prev) => {
                if (!prev) return null
                const next = prev.filter((f) => f !== file)
                return next.length ? next : null
              })
            }}
          />
        ))}
      </AnimatePresence>

      {overflow > 0 && (
        <motion.div
          layout
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-xs font-medium text-muted-foreground px-2"
        >
          +{overflow}
        </motion.div>
      )}
    </div>
  )
}
