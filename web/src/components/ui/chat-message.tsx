import React from "react"
import { useState, useCallback } from "react"
import type { UIMessage, useChat } from "@ai-sdk/react"
import { cva, type VariantProps } from "class-variance-authority"
import { motion, AnimatePresence } from "framer-motion"
import {
  Loader2,
  X,
  Ban,
  Globe,
  Search,
  Code,
  Sparkles,
  Hash,
  Send,
  Check,
  Calendar,
  Pencil,
  GitBranch,
  RotateCcw,
  Paperclip,
  FolderOpen,
  Brain,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { FilePreview, type RemoteFile } from "@/components/ui/file-preview"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { CopyButton } from "@/components/ui/copy-button"
import { useChatUIStore } from "@/lib/chat.store"
import { useToolDetailStore } from "@/lib/tool-detail.store"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  'components.reasoning_block.title' as components_reasoning_block_title,
  'components.reasoning_block.description' as components_reasoning_block_description,
  'tools.web_search.search' as tools_web_search_search,
  'tools.web_search.search_success' as tools_web_search_search_success,
  'tools.web_search.search_error' as tools_web_search_search_error,
  'tools.code_execution.execute' as tools_code_execution_execute,
  'tools.code_execution.execute_success' as tools_code_execution_execute_success,
  'tools.code_execution.execute_error' as tools_code_execution_execute_error,
  'tools.gmail.search' as tools_gmail_search,
  'tools.gmail.read' as tools_gmail_read,
  'tools.gmail.ingest_attachments' as tools_gmail_ingest_attachments,
  'tools.drive.search' as tools_drive_search,
  'tools.drive.list' as tools_drive_list,
  'tools.outlook.search' as tools_outlook_search,
  'tools.outlook.read' as tools_outlook_read,
  'tools.outlook.ingest_attachments' as tools_outlook_ingest_attachments,
  'tools.microsoft_calendar.list' as tools_microsoft_calendar_list,
  'tools.microsoft_calendar.events' as tools_microsoft_calendar_events,
  'tools.microsoft_calendar.read' as tools_microsoft_calendar_read,
  'tools.one_drive.search' as tools_one_drive_search,
  'tools.one_drive.list' as tools_one_drive_list,
  'tools.dropbox.search' as tools_dropbox_search,
  'tools.dropbox.list' as tools_dropbox_list,
  'tools.calendar.list' as tools_calendar_list,
  'tools.calendar.events' as tools_calendar_events,
  'tools.calendar.read' as tools_calendar_read,
  'tools.nexata.list_credentials' as tools_nexata_list_credentials,
  'tools.nexata.list_users' as tools_nexata_list_users,
  'tools.nexata.file_search' as tools_nexata_file_search,
  'tools.nexata.file_read' as tools_nexata_file_read,
  'tools.nexata.feedback_list' as tools_nexata_feedback_list,
  'tools.nexata.feedback_create' as tools_nexata_feedback_create,
  'tools.nexata.list_files_on_thread' as tools_nexata_list_files_on_thread,
  'tools.nexata.list_files_on_message' as tools_nexata_list_files_on_message,
  'tools.nexata.reingest' as tools_nexata_reingest,
  'tools.nexata.ask_questions' as tools_nexata_ask_questions,
  'tools.gmail.search_success' as tools_gmail_search_success,
  'tools.gmail.search_error' as tools_gmail_search_error,
  'tools.gmail.read_success' as tools_gmail_read_success,
  'tools.gmail.read_error' as tools_gmail_read_error,
  'tools.gmail.ingest_attachments_success' as tools_gmail_ingest_attachments_success,
  'tools.gmail.ingest_attachments_error' as tools_gmail_ingest_attachments_error,
  'tools.drive.search_success' as tools_drive_search_success,
  'tools.drive.search_error' as tools_drive_search_error,
  'tools.drive.list_success' as tools_drive_list_success,
  'tools.drive.list_error' as tools_drive_list_error,
  'tools.outlook.search_success' as tools_outlook_search_success,
  'tools.outlook.search_error' as tools_outlook_search_error,
  'tools.outlook.read_success' as tools_outlook_read_success,
  'tools.outlook.read_error' as tools_outlook_read_error,
  'tools.outlook.ingest_attachments_success' as tools_outlook_ingest_attachments_success,
  'tools.outlook.ingest_attachments_error' as tools_outlook_ingest_attachments_error,
  'tools.microsoft_calendar.list_success' as tools_microsoft_calendar_list_success,
  'tools.microsoft_calendar.list_error' as tools_microsoft_calendar_list_error,
  'tools.microsoft_calendar.events_success' as tools_microsoft_calendar_events_success,
  'tools.microsoft_calendar.events_error' as tools_microsoft_calendar_events_error,
  'tools.microsoft_calendar.read_success' as tools_microsoft_calendar_read_success,
  'tools.microsoft_calendar.read_error' as tools_microsoft_calendar_read_error,
  'tools.one_drive.search_success' as tools_one_drive_search_success,
  'tools.one_drive.search_error' as tools_one_drive_search_error,
  'tools.one_drive.list_success' as tools_one_drive_list_success,
  'tools.one_drive.list_error' as tools_one_drive_list_error,
  'tools.dropbox.search_success' as tools_dropbox_search_success,
  'tools.dropbox.search_error' as tools_dropbox_search_error,
  'tools.dropbox.list_success' as tools_dropbox_list_success,
  'tools.dropbox.list_error' as tools_dropbox_list_error,
  'tools.drive.ingest' as tools_drive_ingest,
  'tools.drive.ingest_success' as tools_drive_ingest_success,
  'tools.drive.ingest_error' as tools_drive_ingest_error,
  'tools.one_drive.ingest' as tools_one_drive_ingest,
  'tools.one_drive.ingest_success' as tools_one_drive_ingest_success,
  'tools.one_drive.ingest_error' as tools_one_drive_ingest_error,
  'tools.dropbox.ingest' as tools_dropbox_ingest,
  'tools.dropbox.ingest_success' as tools_dropbox_ingest_success,
  'tools.dropbox.ingest_error' as tools_dropbox_ingest_error,
  'tools.calendar.list_success' as tools_calendar_list_success,
  'tools.calendar.list_error' as tools_calendar_list_error,
  'tools.calendar.events_success' as tools_calendar_events_success,
  'tools.calendar.events_error' as tools_calendar_events_error,
  'tools.calendar.read_success' as tools_calendar_read_success,
  'tools.calendar.read_error' as tools_calendar_read_error,
  'tools.nexata.list_credentials_success' as tools_nexata_list_credentials_success,
  'tools.nexata.list_credentials_error' as tools_nexata_list_credentials_error,
  'tools.nexata.list_users_success' as tools_nexata_list_users_success,
  'tools.nexata.list_users_error' as tools_nexata_list_users_error,
  'tools.nexata.file_search_success' as tools_nexata_file_search_success,
  'tools.nexata.file_search_error' as tools_nexata_file_search_error,
  'tools.nexata.file_read_success' as tools_nexata_file_read_success,
  'tools.nexata.file_read_error' as tools_nexata_file_read_error,
  'tools.nexata.feedback_list_success' as tools_nexata_feedback_list_success,
  'tools.nexata.feedback_list_error' as tools_nexata_feedback_list_error,
  'tools.nexata.feedback_create_success' as tools_nexata_feedback_create_success,
  'tools.nexata.feedback_create_error' as tools_nexata_feedback_create_error,
  'tools.nexata.list_files_on_thread_success' as tools_nexata_list_files_on_thread_success,
  'tools.nexata.list_files_on_thread_error' as tools_nexata_list_files_on_thread_error,
  'tools.nexata.list_files_on_message_success' as tools_nexata_list_files_on_message_success,
  'tools.nexata.list_files_on_message_error' as tools_nexata_list_files_on_message_error,
  'tools.nexata.reingest_success' as tools_nexata_reingest_success,
  'tools.nexata.reingest_error' as tools_nexata_reingest_error,
  'tools.nexata.ask_questions_success' as tools_nexata_ask_questions_success,
  'tools.nexata.ask_questions_error' as tools_nexata_ask_questions_error,
  'components.ask_questions.status.answering' as components_ask_questions_status_answering,
  'components.ask_questions.status.submitted' as components_ask_questions_status_submitted,
  'components.ask_questions.label.yes' as components_ask_questions_label_yes,
  'components.ask_questions.label.no' as components_ask_questions_label_no,
  'components.ask_questions.label.recommended' as components_ask_questions_label_recommended,
  'components.ask_questions.label.select_date' as components_ask_questions_label_select_date,
  'components.ask_questions.label.question_singular' as components_ask_questions_label_question_singular,
  'components.ask_questions.label.question_plural' as components_ask_questions_label_question_plural,
  'components.ask_questions.label.answers_sent' as components_ask_questions_label_answers_sent,
  'components.ask_questions.label.answered_count' as components_ask_questions_label_answered_count,
  'components.ask_questions.button.submit' as components_ask_questions_button_submit,
  'components.ask_questions.label.custom' as components_ask_questions_label_custom,
  'components.ask_questions.placeholder.custom' as components_ask_questions_placeholder_custom,
  'components.reingest_approval.title' as components_reingest_approval_title,
  'components.reingest_approval.description' as components_reingest_approval_description,
  'components.reingest_approval.approve' as components_reingest_approval_approve,
  'components.reingest_approval.deny' as components_reingest_approval_deny,
  'components.reingest_approval.approved' as components_reingest_approval_approved,
  'components.reingest_approval.denied' as components_reingest_approval_denied,
  'components.gmail_ingest_approval.title' as components_gmail_ingest_approval_title,
  'components.gmail_ingest_approval.description' as components_gmail_ingest_approval_description,
  'components.gmail_ingest_approval.approve' as components_gmail_ingest_approval_approve,
  'components.gmail_ingest_approval.deny' as components_gmail_ingest_approval_deny,
  'components.gmail_ingest_approval.approved' as components_gmail_ingest_approval_approved,
  'components.gmail_ingest_approval.denied' as components_gmail_ingest_approval_denied,
  'components.outlook_ingest_approval.title' as components_outlook_ingest_approval_title,
  'components.outlook_ingest_approval.description' as components_outlook_ingest_approval_description,
  'components.outlook_ingest_approval.approve' as components_outlook_ingest_approval_approve,
  'components.outlook_ingest_approval.deny' as components_outlook_ingest_approval_deny,
  'components.outlook_ingest_approval.approved' as components_outlook_ingest_approval_approved,
  'components.outlook_ingest_approval.denied' as components_outlook_ingest_approval_denied,
  'components.drive_ingest_approval.title' as components_drive_ingest_approval_title,
  'components.drive_ingest_approval.description' as components_drive_ingest_approval_description,
  'components.drive_ingest_approval.approve' as components_drive_ingest_approval_approve,
  'components.drive_ingest_approval.deny' as components_drive_ingest_approval_deny,
  'components.drive_ingest_approval.approved' as components_drive_ingest_approval_approved,
  'components.drive_ingest_approval.denied' as components_drive_ingest_approval_denied,
  'components.dropbox_ingest_approval.title' as components_dropbox_ingest_approval_title,
  'components.dropbox_ingest_approval.description' as components_dropbox_ingest_approval_description,
  'components.dropbox_ingest_approval.approve' as components_dropbox_ingest_approval_approve,
  'components.dropbox_ingest_approval.deny' as components_dropbox_ingest_approval_deny,
  'components.dropbox_ingest_approval.approved' as components_dropbox_ingest_approval_approved,
  'components.dropbox_ingest_approval.denied' as components_dropbox_ingest_approval_denied,
  'components.onedrive_ingest_approval.title' as components_onedrive_ingest_approval_title,
  'components.onedrive_ingest_approval.description' as components_onedrive_ingest_approval_description,
  'components.onedrive_ingest_approval.approve' as components_onedrive_ingest_approval_approve,
  'components.onedrive_ingest_approval.deny' as components_onedrive_ingest_approval_deny,
  'components.onedrive_ingest_approval.approved' as components_onedrive_ingest_approval_approved,
  'components.onedrive_ingest_approval.denied' as components_onedrive_ingest_approval_denied,
  'components.ingest_approval.item_count' as components_ingest_approval_item_count,
  'components.ingest_approval.attachment_count' as components_ingest_approval_attachment_count,
  'chat.edit.button' as chat_edit_button,
  'chat.edit.save' as chat_edit_save,
  'chat.edit.cancel' as chat_edit_cancel,
  'chat.edit.confirm_description' as chat_edit_confirm_description,
  'chat.edit.confirm_action' as chat_edit_confirm_action,
  'chat.edit.dont_show_again' as chat_edit_dont_show_again,
  'chat.branch_off.button' as chat_branch_off_button,
  'chat.retry.button' as chat_retry_button,
  'chat.tool_detail.view_details' as td_view_details,
  'chat.tool_detail.hide_details' as td_hide_details,
  'common.brain' as common_brain,
} from '@/paraglide/messages.js';
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarPicker } from "@/components/ui/calendar"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"

/* -------------------------------------------------------------------------- */
/*                                   Styles                                    */
/* -------------------------------------------------------------------------- */

const chatBubbleVariants = cva(
  "relative break-words rounded-xl p-3 text-md max-w-[85%]",
  {
    variants: {
      isUser: {
        true: "bg-card text-foreground border border-border/60 chat-float",
        false: "bg-transparent text-foreground",
      },
      animation: {
        none: "",
        slide: "duration-300 animate-in fade-in-0",
        scale: "duration-300 animate-in fade-in-0 zoom-in-75",
        fade: "duration-500 animate-in fade-in-0",
      },
    },
  }
)

type Animation = VariantProps<typeof chatBubbleVariants>["animation"]

/* -------------------------------------------------------------------------- */
/*                                ChatMessage                                  */
/* -------------------------------------------------------------------------- */

export interface ChatMessageProps {
  message: UIMessage
  showTimeStamp?: boolean
  animation?: Animation
  actions?: React.ReactNode
  disableTypingAnimation?: boolean
  addToolOutput?: ReturnType<typeof useChat>['addToolOutput']
  addToolApprovalResponse?: ReturnType<typeof useChat>['addToolApprovalResponse']
  onEdit?: (messageId: string, newText: string) => void
  onBranchOff?: (messageId: string) => void
  onRetry?: (messageId: string) => void
  isStreaming?: boolean
  isSyncing?: boolean
  isLastInGroup?: boolean
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  showTimeStamp = false,
  addToolOutput,
  addToolApprovalResponse,
  onEdit,
  onBranchOff,
  onRetry,
  isStreaming = false,
  isSyncing = false,
  isLastInGroup = true,
}) => {
  const isUser = message.role === "user"
  const editingMessageId = useChatUIStore((s) => s.editingMessageId)
  const editingMessageText = useChatUIStore((s) => s.editingMessageText)
  const startEditing = useChatUIStore((s) => s.startEditing)
  const cancelEditing = useChatUIStore((s) => s.cancelEditing)
  const openTool = useToolDetailStore((s) => s.openTool)
  const isEditing = editingMessageId === message.id
  const [editText, setEditText] = useState("")
  const [confirmVisible, setConfirmVisible] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)

  const handleStartEdit = useCallback(() => {
    const text = message.parts
      .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
      .map((p) => p.text)
      .join("")
    startEditing(message.id, text)
    setEditText(text)
  }, [message, startEditing])

  const handleCancelEdit = useCallback(() => {
    cancelEditing()
    setEditText("")
    setConfirmVisible(false)
    setDontShowAgain(false)
  }, [cancelEditing])

  const handleSaveEdit = useCallback(() => {
    if (!editText.trim()) return
    if (localStorage.getItem('chat.edit.skip_confirm') === 'true') {
      onEdit?.(message.id, editText.trim())
      return
    }
    setConfirmVisible(true)
  }, [message.id, editText, onEdit])

  const handleConfirmEdit = useCallback(() => {
    if (dontShowAgain) {
      localStorage.setItem('chat.edit.skip_confirm', 'true')
    }
    setConfirmVisible(false)
    setDontShowAgain(false)
    onEdit?.(message.id, editText.trim())
  }, [dontShowAgain, message.id, editText, onEdit])

  const meta = typeof message.metadata === "object" && message.metadata
    ? (message.metadata as Record<string, unknown>)
    : undefined

  const createdAt =
    message.createdAt instanceof Date
      ? message.createdAt
      : typeof message.createdAt === "string"
        ? new Date(message.createdAt)
        : meta?.createdAt
          ? new Date(meta.createdAt as string)
          : undefined

  const extraReason = !!meta?.extraReason

  const formattedTime = createdAt?.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })

  // Helper para FilePreview
  function filePartToPreviewData(part: Record<string, unknown>): File | RemoteFile {
    const url = part.url as string | undefined
    const name = (part.filename as string) ?? "Unknown"
    const mediaType = (part.mediaType as string) ?? "application/octet-stream"

    // Remote HTTP URL — return descriptor directly
    if (url && !url.startsWith("data:")) {
      return { name, type: mediaType, url }
    }

    // No URL — return empty File
    if (!url) {
      return new File([], name, { type: mediaType })
    }

    // Base64 data URI — decode into browser File
    const base64 = url.split(",")[1]
    const bytes = atob(base64 ?? "")
    const array = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i)

    return new File(
      [array],
      name,
      { type: mediaType }
    )
  }

  // Get plain text for copy button
  const messageText = message.parts
    .filter((p): p is Extract<typeof p, { type: "text" | "reasoning" }> => p.type === "text" || p.type === "reasoning")
    .map((p) => p.text ?? "")
    .join("")

  return (
    <div
      className={cn(
        "group/message relative flex flex-col gap-3 w-full",
        isUser ? "items-end" : "items-start"
      )}
    >
      {/* Inline Edit Mode */}
      {isUser && isEditing && onEdit ? (
        <div className="w-full sm:max-w-[85%] flex flex-col gap-2.5">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={Math.min(Math.max(editText.split("\n").length, 2), 10)}
            className="w-full rounded-xl border border-primary/30 bg-card p-3 text-md text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 chat-float transition-all duration-200"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") handleCancelEdit()
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSaveEdit()
              }
            }}
          />

          <AnimatePresence mode="wait">
            {confirmVisible ? (
              <motion.div
                key="confirm-panel"
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.97 }}
                transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="rounded-xl border border-primary/20 bg-primary/[0.04] dark:bg-primary/[0.06] overflow-hidden"
              >
                {/* Warning row */}
                <div className="px-3.5 pt-3 pb-2.5 flex items-start gap-3">
                  <div className="mt-0.5 shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-primary/15">
                    <RotateCcw className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <p className="text-[13px] leading-relaxed text-foreground/75">
                    {chat_edit_confirm_description()}
                  </p>
                </div>

                {/* Divider */}
                <div className="mx-3.5 h-px bg-border/50" />

                {/* Footer */}
                <div className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  {/* Toggle */}
                  <label className="flex items-center gap-2.5 cursor-pointer group/toggle select-none">
                    <Switch
                      size="sm"
                      checked={dontShowAgain}
                      onCheckedChange={setDontShowAgain}
                    />
                    <span className="text-xs text-muted-foreground group-hover/toggle:text-foreground transition-colors duration-150">
                      {chat_edit_dont_show_again()}
                    </span>
                  </label>

                  {/* Buttons */}
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmVisible(false)}
                      className="h-7 px-3 text-xs"
                    >
                      {chat_edit_cancel()}
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={handleConfirmEdit}
                      className="h-7 px-3 text-xs gap-1.5"
                    >
                      <Send className="h-3 w-3" />
                      {chat_edit_confirm_action()}
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="actions-row"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="flex items-center justify-between"
              >
                {/* Keyboard hints — desktop only */}
                <div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground/50 select-none">
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-border/60 bg-muted px-1 py-0.5 font-mono text-[10px] leading-none">Esc</kbd>
                    {chat_edit_cancel()}
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-border/60 bg-muted px-1 py-0.5 font-mono text-[10px] leading-none">↵</kbd>
                    {chat_edit_save()}
                  </span>
                </div>

                <div className="flex gap-2 ml-auto">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    className="h-7 px-3 text-xs"
                  >
                    {chat_edit_cancel()}
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleSaveEdit}
                    disabled={!editText.trim()}
                    className="h-7 px-3 text-xs gap-1.5"
                  >
                    <Send className="h-3 w-3" />
                    {chat_edit_save()}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <>
          {/* Message Content */}
          {(() => {
            const blocks: React.ReactNode[] = []
            let buffer: { part: Record<string, unknown>; globalIndex: number }[] = []
            const renderedToolCallIds = new Set<string>()

            const flushBuffer = () => {
              if (!buffer.length) return

              const firstIndex = buffer[0]?.globalIndex
              const lastIndex = buffer[buffer.length - 1]?.globalIndex
              const bubbleKey = `bubble-${firstIndex}-${lastIndex}`

              const textBuffer = buffer.filter(b => (b.part as { type: string }).type === "text")
              const fileBuffer = buffer.filter(b => (b.part as { type: string }).type === "file")

              blocks.push(
                <motion.div
                  key={bubbleKey}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  className={cn(chatBubbleVariants({ isUser, animation: "none" }))}
                >
                  {/* TEXT */}
                  {textBuffer.map(({ part }, i) => {
                    return (
                      <div key={`text-${i}`}>
                        <MarkdownRenderer>{(part as { text: string }).text}</MarkdownRenderer>
                      </div>
                    )
                  })}

                  {/* FILES */}
                  {fileBuffer.map(({ part }, i) => {
                    const previewData = filePartToPreviewData(part)

                    return (
                      <div
                        key={`file-${i}`}
                        className="mt-3 scale-90 origin-left"
                      >
                        <FilePreview file={previewData} />
                      </div>
                    )
                  })}
                </motion.div>
              )

              buffer = []
            }

            message.parts.forEach((part, index) => {
              if (part.type === "text" || part.type === "file") {
                buffer.push({ part: part as unknown as Record<string, unknown>, globalIndex: index })
                return
              }

              // flush bubble before special block
              flushBuffer()

              if (part.type === "reasoning") {
                blocks.push(
                  <ReasoningBlock
                    key={`reasoning-${index}`}
                    reasoning={part.text}
                    streaming={part.state === "streaming"}
                  />
                )
                return
              }

              if (isToolPart(part)) {
                // Deduplicate tool parts by toolCallId — during auto-submit
                // streams the SDK may hold two copies of the same tool call.
                const tcId = (part as { toolCallId?: string }).toolCallId
                if (tcId && renderedToolCallIds.has(tcId)) return
                if (tcId) renderedToolCallIds.add(tcId)
                const rawName = part.type === "dynamic-tool"
                  ? part.toolName
                  : part.type.replace("tool-", "")

                if (rawName === "NexataAskQuestions") {
                  blocks.push(
                    <AskQuestionsRenderer
                      key={`ask-${index}`}
                      part={part}
                      isSyncing={isSyncing}
                      onSubmit={addToolOutput ? (toolCallId, answers) => {
                        addToolOutput({
                          toolCallId,
                          tool: rawName,
                          output: answers,
                        })
                      } : undefined}
                    />
                  )
                  return
                }

                if (
                  rawName === "NexataReingest" &&
                  ((part as any).state === "approval-requested" || (part as any).state === "approval-responded")
                ) {
                  blocks.push(
                    <ReingestApprovalRenderer
                      key={`reingest-approval-${index}`}
                      part={part}
                      isSyncing={isSyncing}
                      onRespond={(approvalId: string, approved: boolean) => {
                        addToolApprovalResponse?.({ id: approvalId, approved })
                      }}
                    />
                  )
                  return
                }

                if (
                  rawName === "GmailIngestAttachments" &&
                  ((part as any).state === "approval-requested" || (part as any).state === "approval-responded")
                ) {
                  blocks.push(
                    <GmailIngestApprovalRenderer
                      key={`gmail-ingest-approval-${index}`}
                      part={part}
                      isSyncing={isSyncing}
                      onRespond={(approvalId: string, approved: boolean) => {
                        addToolApprovalResponse?.({ id: approvalId, approved })
                      }}
                    />
                  )
                  return
                }

                if (
                  rawName === "OutlookIngestAttachments" &&
                  ((part as any).state === "approval-requested" || (part as any).state === "approval-responded")
                ) {
                  blocks.push(
                    <OutlookIngestApprovalRenderer
                      key={`outlook-ingest-approval-${index}`}
                      part={part}
                      isSyncing={isSyncing}
                      onRespond={(approvalId: string, approved: boolean) => {
                        addToolApprovalResponse?.({ id: approvalId, approved })
                      }}
                    />
                  )
                  return
                }

                if (
                  (rawName === "DriveIngest" || rawName === "DropboxIngest" || rawName === "OneDriveIngest") &&
                  ((part as any).state === "approval-requested" || (part as any).state === "approval-responded")
                ) {
                  const cfg = PROVIDER_INGEST_I18N[rawName as keyof typeof PROVIDER_INGEST_I18N]
                  blocks.push(
                    <ProviderIngestApprovalRenderer
                      key={`${rawName}-approval-${index}`}
                      part={part}
                      isSyncing={isSyncing}
                      icon={TOOL_ICON_MAP[rawName]!}
                      iconAlt={cfg.alt}
                      i18n={cfg}
                      onRespond={(approvalId: string, approved: boolean) => {
                        addToolApprovalResponse?.({ id: approvalId, approved })
                      }}
                    />
                  )
                  return
                }

                blocks.push(
                  <ToolRenderer
                    key={`tool-${index}`}
                    part={part}
                  />
                )
              }
            })

            // flush final bubble
            flushBuffer()

            return blocks
          })()}

          {/* Message Actions Toolbar */}
          {!isEditing && !isStreaming && isLastInGroup && (
            <div
              className={cn(
                "flex items-center gap-0.5 rounded-lg border bg-background/95 backdrop-blur-sm px-1 py-0.5 shadow-sm",
                isUser ? "self-end" : "self-start"
              )}
            >
              {/* Copy button (for assistant messages with text) */}
              {!isUser && messageText && (
                <CopyButton content={messageText} />
              )}

              {/* Edit button (for user messages) */}
              {isUser && onEdit && (
                <Tooltip>
                  <TooltipTrigger>
                    <button
                      onClick={handleStartEdit}
                      className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>

                  <TooltipContent side="bottom">
                    {chat_edit_button()}
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Retry button (for user messages) */}
              {isUser && onRetry && (
                <Tooltip>
                  <TooltipTrigger>
                    <button
                      onClick={() => onRetry(message.id)}
                      className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>

                  <TooltipContent side="bottom">
                    {chat_retry_button()}
                  </TooltipContent>
                </Tooltip>
              )}

              {!isUser && onBranchOff && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <button
                        onClick={() => onBranchOff(message.id)}
                        className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors"
                      >
                        <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </TooltipTrigger>

                    <TooltipContent side="bottom">
                      {chat_branch_off_button()}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )}
        </>
      )}

      {(showTimeStamp && createdAt || extraReason) && (
        <div className={cn(
          "flex items-center gap-1.5 text-xs text-muted-foreground/60 select-none",
          isUser ? "justify-end" : "justify-start"
        )}>
          {extraReason && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 rounded-full bg-pink-500/10 border border-pink-500/20 px-1.5 py-0.5 text-[11px] text-pink-500 dark:text-pink-400">
                  <Brain className="h-3 w-3" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {common_brain()}
              </TooltipContent>
            </Tooltip>
          )}
          {showTimeStamp && createdAt && (
            <time>{formattedTime}</time>
          )}
        </div>
      )}
    </div>
  )
}
/* -------------------------------------------------------------------------- */
/*                               ReasoningBlock                                */
/* -------------------------------------------------------------------------- */

const ReasoningBlock = ({
  streaming,
}: {
  reasoning: string
  streaming?: boolean
}) => {
  if (!streaming) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: -4 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative flex items-center gap-3 w-full sm:max-w-[85%] rounded-xl border border-violet-500/30 bg-violet-500/5 px-4 py-3 overflow-hidden chat-float"
    >
      <motion.div
        className="absolute inset-0 bg-linear-to-r from-transparent via-violet-400/10 to-transparent"
        animate={{ x: ["-100%", "100%"] }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      />

      <div className="relative shrink-0">
        <motion.div
          className="absolute inset-0 rounded-full bg-violet-500/30 blur-sm"
          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <Sparkles className="relative h-4 w-4 text-violet-400" />
      </div>

      <div className="relative flex flex-col min-w-0">
        <span className="text-sm font-semibold text-violet-400">
          {components_reasoning_block_title()}
        </span>
        <span className="text-xs text-violet-400/60">
          {components_reasoning_block_description()}
        </span>
      </div>

      <div className="relative flex items-center gap-1 ml-auto shrink-0">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="block h-1.5 w-1.5 rounded-full bg-violet-400/70"
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              delay: i * 0.25,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                ToolRenderer                                 */
/* -------------------------------------------------------------------------- */

const TOOL_LABEL_MAP: Record<string, { pending: () => string; success: () => string; error: () => string }> = {
  webSearch:                { pending: tools_web_search_search,                success: tools_web_search_search_success,               error: tools_web_search_search_error },
  codeExecution:            { pending: tools_code_execution_execute,           success: tools_code_execution_execute_success,           error: tools_code_execution_execute_error },
  GmailSearch:              { pending: tools_gmail_search,                    success: tools_gmail_search_success,                    error: tools_gmail_search_error },
  GmailRead:                { pending: tools_gmail_read,                      success: tools_gmail_read_success,                      error: tools_gmail_read_error },
  GmailIngestAttachments:   { pending: tools_gmail_ingest_attachments,        success: tools_gmail_ingest_attachments_success,        error: tools_gmail_ingest_attachments_error },
  DriveSearch:              { pending: tools_drive_search,                    success: tools_drive_search_success,                    error: tools_drive_search_error },
  DriveListDir:             { pending: tools_drive_list,                      success: tools_drive_list_success,                      error: tools_drive_list_error },
  OutlookSearch:            { pending: tools_outlook_search,                  success: tools_outlook_search_success,                  error: tools_outlook_search_error },
  OutlookRead:              { pending: tools_outlook_read,                    success: tools_outlook_read_success,                    error: tools_outlook_read_error },
  OutlookIngestAttachments: { pending: tools_outlook_ingest_attachments,      success: tools_outlook_ingest_attachments_success,      error: tools_outlook_ingest_attachments_error },
  MicrosoftCalendarList:    { pending: tools_microsoft_calendar_list,         success: tools_microsoft_calendar_list_success,         error: tools_microsoft_calendar_list_error },
  MicrosoftCalendarEvents:  { pending: tools_microsoft_calendar_events,       success: tools_microsoft_calendar_events_success,       error: tools_microsoft_calendar_events_error },
  MicrosoftCalendarRead:    { pending: tools_microsoft_calendar_read,         success: tools_microsoft_calendar_read_success,         error: tools_microsoft_calendar_read_error },
  OneDriveSearch:           { pending: tools_one_drive_search,                success: tools_one_drive_search_success,                error: tools_one_drive_search_error },
  OneDriveListDir:          { pending: tools_one_drive_list,                  success: tools_one_drive_list_success,                  error: tools_one_drive_list_error },
  DropboxSearch:            { pending: tools_dropbox_search,                  success: tools_dropbox_search_success,                  error: tools_dropbox_search_error },
  DropboxListDir:           { pending: tools_dropbox_list,                    success: tools_dropbox_list_success,                    error: tools_dropbox_list_error },
  CalendarList:             { pending: tools_calendar_list,                   success: tools_calendar_list_success,                   error: tools_calendar_list_error },
  CalendarEvents:           { pending: tools_calendar_events,                 success: tools_calendar_events_success,                 error: tools_calendar_events_error },
  CalendarRead:             { pending: tools_calendar_read,                   success: tools_calendar_read_success,                   error: tools_calendar_read_error },
  NexataListCredentials:    { pending: tools_nexata_list_credentials,         success: tools_nexata_list_credentials_success,         error: tools_nexata_list_credentials_error },
  NexataListUsers:          { pending: tools_nexata_list_users,               success: tools_nexata_list_users_success,               error: tools_nexata_list_users_error },
  NexataFileSearch:         { pending: tools_nexata_file_search,              success: tools_nexata_file_search_success,              error: tools_nexata_file_search_error },
  NexataFileRead:           { pending: tools_nexata_file_read,                success: tools_nexata_file_read_success,                error: tools_nexata_file_read_error },
  NexataFeedbackList:       { pending: tools_nexata_feedback_list,            success: tools_nexata_feedback_list_success,            error: tools_nexata_feedback_list_error },
  NexataFeedbackCreate:     { pending: tools_nexata_feedback_create,          success: tools_nexata_feedback_create_success,          error: tools_nexata_feedback_create_error },
  NexataListFilesOnThread:  { pending: tools_nexata_list_files_on_thread,     success: tools_nexata_list_files_on_thread_success,     error: tools_nexata_list_files_on_thread_error },
  NexataListFilesOnMessage: { pending: tools_nexata_list_files_on_message,    success: tools_nexata_list_files_on_message_success,    error: tools_nexata_list_files_on_message_error },
  NexataReingest:           { pending: tools_nexata_reingest,                 success: tools_nexata_reingest_success,                 error: tools_nexata_reingest_error },
  NexataAskQuestions:       { pending: tools_nexata_ask_questions,            success: tools_nexata_ask_questions_success,            error: tools_nexata_ask_questions_error },
  DriveIngest:              { pending: tools_drive_ingest,                    success: tools_drive_ingest_success,                    error: tools_drive_ingest_error },
  DropboxIngest:            { pending: tools_dropbox_ingest,                  success: tools_dropbox_ingest_success,                  error: tools_dropbox_ingest_error },
  OneDriveIngest:           { pending: tools_one_drive_ingest,                success: tools_one_drive_ingest_success,                error: tools_one_drive_ingest_error },
}

const NEXATA_TOOLS = new Set([
  'NexataListCredentials',
  'NexataListUsers',
  'NexataFileSearch',
  'NexataFileRead',
  'NexataFeedbackList',
  'NexataFeedbackCreate',
  'NexataListFilesOnThread',
  'NexataListFilesOnMessage',
  'NexataReingest',
  'NexataAskQuestions',
])

// Mapa directo toolName -> icono, usando los ids exactos de available-sources
const TOOL_ICON_MAP: Record<string, string> = {
  GmailSearch:              '/datasource_icons/gmail.png',
  GmailRead:                '/datasource_icons/gmail.png',
  GmailIngestAttachments:   '/datasource_icons/gmail.png',
  DriveSearch:              '/datasource_icons/gdrive.png',
  DriveListDir:             '/datasource_icons/gdrive.png',
  OutlookSearch:            '/datasource_icons/outlook.png',
  OutlookRead:              '/datasource_icons/outlook.png',
  OutlookIngestAttachments: '/datasource_icons/outlook.png',
  MicrosoftCalendarList:    '/datasource_icons/ocalendar.png',
  MicrosoftCalendarEvents:  '/datasource_icons/ocalendar.png',
  MicrosoftCalendarRead:    '/datasource_icons/ocalendar.png',
  OneDriveSearch:           '/datasource_icons/onedrive.png',
  OneDriveListDir:          '/datasource_icons/onedrive.png',
  DropboxSearch:            '/datasource_icons/dropbox.png',
  DropboxListDir:           '/datasource_icons/dropbox.png',
  DriveIngest:              '/datasource_icons/gdrive.png',
  DropboxIngest:            '/datasource_icons/dropbox.png',
  OneDriveIngest:           '/datasource_icons/onedrive.png',
  CalendarList:             '/datasource_icons/gcalendar.png',
  CalendarEvents:           '/datasource_icons/gcalendar.png',
  CalendarRead:             '/datasource_icons/gcalendar.png',
}

// Tools that use inline lucide icons instead of image files
const TOOL_LUCIDE_MAP: Record<string, React.ElementType> = {
  webSearch: Search,
  codeExecution: Code,
}

function getToolLabel(rawToolName: string, state?: string) {
  const entry = TOOL_LABEL_MAP[rawToolName]
  if (!entry) return rawToolName
  if (state === 'output-available') return entry.success()
  if (state === 'output-error' || state === 'output-denied') return entry.error()
  if (state === 'approval-requested' || state === 'approval-responded') return entry.pending()
  return entry.pending()
}

function getCredentialEmails(part: any): string[] {
  const output = (part as any).output
  if (!output) return []
  if (Array.isArray(output)) {
    const emails = output
      .map((item: any) => item?.credentialEmail)
      .filter(Boolean) as string[]
    // deduplicate
    return [...new Set(emails)]
  }
  return output?.credentialEmail ? [output.credentialEmail] : []
}

function ToolRenderer({ part }: { part: UIMessage["parts"][number] }) {
  const [hovered, setHovered] = useState(false)
  const selectedTool = useToolDetailStore((s) => s.selectedTool)
  const isOpen = useToolDetailStore((s) => s.isOpen)
  const toggleTool = useToolDetailStore((s) => s.toggleTool)

  if (!isToolPart(part)) return null

  const rawToolName =
    part.type === "dynamic-tool"
      ? part.toolName
      : part.type.replace("tool-", "")

  const toolCallId = (part as { toolCallId?: string }).toolCallId ?? ""
  const isThisToolOpen = isOpen && selectedTool?.toolCallId === toolCallId

  const isSuccess = part.state === "output-available"
  const isError   = part.state === "output-error"
  const isDenied  = part.state === "output-denied"
  const isPending = !isSuccess && !isError && !isDenied

  const label      = getToolLabel(rawToolName, part.state)
  const isNexata   = NEXATA_TOOLS.has(rawToolName)
  const icon       = !isNexata ? TOOL_ICON_MAP[rawToolName] : null
  const LucideIcon = !isNexata && !icon ? TOOL_LUCIDE_MAP[rawToolName] : null

  const emails       = getCredentialEmails(part)
  const visibleEmails = emails.slice(0, 2)
  const extraCount   = emails.length - visibleEmails.length

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className={cn(
        "relative w-full sm:max-w-[85%] rounded-xl border cursor-pointer transition-all duration-200 chat-float overflow-hidden",
        isThisToolOpen
          ? "bg-card border-border/60 ring-1 ring-inset ring-primary/20"
          : "bg-card/80 border-border/50 hover:bg-card hover:border-border/70"
      )}
      onClick={() =>
        toggleTool({
          toolName: rawToolName,
          toolCallId,
          state: part.state,
          input: (part as { input?: unknown }).input,
          output: (part as { output?: unknown }).output ?? (part as { errorText?: string }).errorText,
        })
      }
    >
      {/* Top state bar */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-[2px]",
        isSuccess && "bg-green-500/70",
        isError   && "bg-red-500/70",
        isDenied  && "bg-yellow-500/70",
        isPending && "bg-blue-400/60",
      )} />

      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">

          {/* Icon: Nexata > tool icon map > lucide map > fallback */}
          {isNexata ? (
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/50 border border-border/40 shrink-0">
              <img
                src="/nexata_logo.png"
                alt="Nexata"
                className="h-4 w-auto max-w-[28px] object-contain opacity-80"
              />
            </div>
          ) : icon ? (
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/60 border border-border/40 shrink-0">
              <img src={icon} alt={rawToolName} className="h-4 w-4 object-contain" />
            </div>
          ) : LucideIcon ? (
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/60 border border-border/40 shrink-0">
              <LucideIcon className="h-4 w-4 text-muted-foreground" />
            </div>
          ) : (
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/60 border border-border/40 shrink-0">
              <Globe className="h-4 w-4 text-muted-foreground" />
            </div>
          )}

          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold truncate">{label}</span>

            {visibleEmails.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap mt-0.5">
                {visibleEmails.map((email, i) => (
                  <React.Fragment key={email}>
                    <span className="text-xs text-muted-foreground truncate">{email}</span>
                    {i < visibleEmails.length - 1 && (
                      <span className="text-xs text-border">·</span>
                    )}
                  </React.Fragment>
                ))}
                {extraCount > 0 && (
                  <>
                    <span className="text-xs text-border">·</span>
                    <span className="text-xs text-muted-foreground">+{extraCount}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <AnimatePresence>
            {hovered && (
              <motion.span
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                transition={{ duration: 0.15 }}
                className="text-xs text-muted-foreground/70 whitespace-nowrap"
              >
                {isThisToolOpen ? td_hide_details() : td_view_details()}
              </motion.span>
            )}
          </AnimatePresence>

          {/* Circular status badge */}
          <div className={cn(
            "flex items-center justify-center h-6 w-6 rounded-full border transition-all duration-200",
            isSuccess && "bg-green-500/10 border-green-500/25",
            isError   && "bg-red-500/10   border-red-500/25",
            isDenied  && "bg-yellow-500/10 border-yellow-500/25",
            isPending && "bg-blue-500/10  border-blue-500/20",
          )}>
            {isSuccess && <Check    className="h-3 w-3 text-green-600 dark:text-green-400" />}
            {isError   && <X        className="h-3 w-3 text-red-600   dark:text-red-400" />}
            {isDenied  && <Ban      className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />}
            {isPending && <Loader2  className="h-3 w-3 animate-spin text-blue-500" />}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/*                             AskQuestionsRenderer                            */
/* -------------------------------------------------------------------------- */

// ── Types ──────────────────────────────────────────────────────────────────

type SelectOption = { value: string; recommended?: boolean }

type QuestionBase = {
  question: string
  recommendation?: string
}
type TextQuestion         = QuestionBase & { type: "text";            data?: { placeholder?: string } }
type BooleanQuestion      = QuestionBase & { type: "boolean" }
type MultiSelectQuestion  = QuestionBase & { type: "multi_select";    data: SelectOption[] }
type SingleSelectQuestion = QuestionBase & { type: "multiple_choice"; data: SelectOption[] }
type NumberQuestion       = QuestionBase & { type: "number";          data?: { min?: number; max?: number } }
type DateQuestion         = QuestionBase & { type: "date" }

type AskQuestion =
  | TextQuestion
  | BooleanQuestion
  | MultiSelectQuestion
  | SingleSelectQuestion
  | NumberQuestion
  | DateQuestion

interface AskQuestionsInput {
  questions: AskQuestion[]
}

type AnswerValue = string | boolean | string[] | number

// ── Skeleton ───────────────────────────────────────────────────────────────

function AskQuestionsSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full sm:max-w-[85%] rounded-xl border border-border/50 bg-card overflow-hidden chat-float"
    >
      {/* Header skeleton */}
      <div className="px-4 sm:px-5 pt-4 pb-3 flex items-center gap-3 border-b border-border/40 bg-muted/30">
        <div className="h-9 w-9 rounded-lg bg-muted animate-pulse" />
        <div className="flex flex-col gap-1.5 flex-1">
          <div className="h-3.5 w-32 rounded bg-muted animate-pulse" />
          <div className="h-2.5 w-20 rounded bg-muted animate-pulse" />
        </div>
      </div>

      {/* Progress bar skeleton */}
      <div className="px-4 sm:px-5 pb-3">
        <div className="h-1 w-full rounded-full bg-muted animate-pulse" />
      </div>

      {/* Questions skeleton */}
      <div className="px-4 sm:px-5 py-3 flex flex-col gap-4">
        {[
          { labelW: "w-3/4", inputH: "h-9" },
          { labelW: "w-1/2", inputH: "h-9" },
        ].map((item, i) => (
          <div key={i} className="flex flex-col gap-2.5 rounded-lg bg-muted/40 p-3">
            <div className={cn("h-3.5 rounded bg-muted-foreground/10 animate-pulse", item.labelW)} />
            <div className={cn("w-full rounded-md bg-muted-foreground/8 animate-pulse", item.inputH)} />
          </div>
        ))}
      </div>

      {/* Footer skeleton */}
      <div className="px-4 sm:px-5 py-3 border-t border-border/40 flex justify-end">
        <div className="h-8 w-24 rounded-lg bg-muted animate-pulse" />
      </div>
    </motion.div>
  )
}

// ── Individual question fields ─────────────────────────────────────────────

function QuestionField({
  q,
  index,
  answer,
  disabled,
  onChange,
}: {
  q: AskQuestion
  index: number
  answer: AnswerValue | undefined
  disabled: boolean
  onChange: (i: number, value: AnswerValue) => void
}) {
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customValue, setCustomValue] = useState("")
  const [multiCustomInput, setMultiCustomInput] = useState("")

  if (q.type === "text") {
    return (
      <Textarea
        disabled={disabled}
        placeholder={q.data?.placeholder ?? ""}
        value={(answer as string) ?? ""}
        onChange={(e) => {
          const el = e.target
          el.style.height = "0px"
          el.style.height = `${el.scrollHeight}px`
          onChange(index, e.target.value)
        }}
        rows={2}
        className="text-sm bg-background/60 resize-none overflow-y-hidden rounded-lg"
        style={{ minHeight: "3.5rem" }}
      />
    )
  }

  if (q.type === "boolean") {
    const isCustomMode = showCustomInput || typeof answer === "string"
    return (
      <div className="flex flex-col gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {([
            { label: components_ask_questions_label_yes(), value: true },
            { label: components_ask_questions_label_no(), value: false },
          ] as const).map(({ label, value }) => {
            const isSelected = !isCustomMode && answer === value
            return (
              <button
                key={label}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setShowCustomInput(false)
                  onChange(index, value)
                }}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150 cursor-pointer",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background/60 text-foreground border-border hover:bg-muted hover:border-muted-foreground/30",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                {label}
              </button>
            )
          })}
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setShowCustomInput(true)
              if (customValue) onChange(index, customValue)
            }}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150 cursor-pointer",
              isCustomMode
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-background/60 text-foreground border-border hover:bg-muted hover:border-muted-foreground/30",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {components_ask_questions_label_custom()}
          </button>
        </div>
        <AnimatePresence>
          {isCustomMode && (
            <motion.div
              key="custom-textarea"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <Textarea
                disabled={disabled}
                autoFocus={!disabled}
                value={typeof answer === "string" ? (answer as string) : customValue}
                onChange={(e) => {
                  const el = e.target
                  el.style.height = "0px"
                  el.style.height = `${el.scrollHeight}px`
                  setCustomValue(e.target.value)
                  onChange(index, e.target.value)
                }}
                placeholder={components_ask_questions_placeholder_custom()}
                rows={2}
                className="text-sm bg-background/60 resize-none overflow-y-hidden rounded-lg"
                style={{ minHeight: "3.5rem" }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  if (q.type === "multi_select") {
    const selected = (answer as string[]) ?? []
    const predefinedValues = new Set(q.data.map((d) => d.value))
    const customSelectedValues = selected.filter((v) => !predefinedValues.has(v))
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {q.data.map((opt) => {
            const isSelected = selected.includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => {
                  const next = isSelected
                    ? selected.filter((v) => v !== opt.value)
                    : [...selected, opt.value]
                  onChange(index, next)
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all duration-150 cursor-pointer",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background/60 text-foreground border-border hover:bg-muted hover:border-muted-foreground/30",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                {opt.recommended && !isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/70 shrink-0" />
                )}
                {opt.value}
              </button>
            )
          })}

          {customSelectedValues.map((v) => (
            <button
              key={v}
              type="button"
              disabled={disabled}
              onClick={() => onChange(index, selected.filter((s) => s !== v))}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all duration-150 cursor-pointer bg-primary text-primary-foreground border-primary shadow-sm",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {v}
              {!disabled && <X className="h-3 w-3 ml-0.5 shrink-0" />}
            </button>
          ))}

          {!disabled && (
            <button
              type="button"
              onClick={() => setShowCustomInput(!showCustomInput)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all duration-150 cursor-pointer",
                showCustomInput
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background/60 text-foreground border-border hover:bg-muted hover:border-muted-foreground/30"
              )}
            >
              + {components_ask_questions_label_custom()}
            </button>
          )}
        </div>

        {q.data.some((o) => o.recommended) && (
          <p className="w-full text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70 inline-block" />
            {components_ask_questions_label_recommended()}
          </p>
        )}

        <AnimatePresence>
          {showCustomInput && (
            <motion.div
              key="custom-input"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="flex gap-2">
                <Input
                  autoFocus
                  value={multiCustomInput}
                  onChange={(e) => setMultiCustomInput(e.target.value)}
                  placeholder={components_ask_questions_placeholder_custom()}
                  className="text-sm bg-background/60"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && multiCustomInput.trim()) {
                      e.preventDefault()
                      onChange(index, [...selected, multiCustomInput.trim()])
                      setMultiCustomInput("")
                      setShowCustomInput(false)
                    }
                    if (e.key === "Escape") {
                      setShowCustomInput(false)
                      setMultiCustomInput("")
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={!multiCustomInput.trim()}
                  onClick={() => {
                    if (multiCustomInput.trim()) {
                      onChange(index, [...selected, multiCustomInput.trim()])
                      setMultiCustomInput("")
                      setShowCustomInput(false)
                    }
                  }}
                  className={cn(
                    "inline-flex items-center justify-center h-9 w-9 rounded-lg border transition-colors shrink-0",
                    multiCustomInput.trim()
                      ? "bg-primary text-primary-foreground border-primary cursor-pointer hover:bg-primary/90"
                      : "bg-muted text-muted-foreground border-border cursor-not-allowed"
                  )}
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  if (q.type === "multiple_choice") {
    const selected = (answer as string) ?? ""
    const isCustomSelected = selected !== "" && !q.data.some((opt) => opt.value === selected)
    const isOtherActive = showCustomInput || isCustomSelected
    return (
      <div className="flex flex-col gap-1.5">
        {q.data.map((opt) => {
          const isSelected = selected === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => {
                setShowCustomInput(false)
                onChange(index, opt.value)
              }}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm border text-left transition-all duration-150 cursor-pointer",
                isSelected
                  ? "bg-primary/10 text-foreground border-primary/50 ring-1 ring-primary/20"
                  : "bg-background/60 text-foreground border-border hover:bg-muted hover:border-muted-foreground/30",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <span className={cn(
                "w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors",
                isSelected ? "border-primary" : "border-muted-foreground/40"
              )}>
                {isSelected && <span className="w-2 h-2 rounded-full bg-primary" />}
              </span>

              <span className="flex-1">{opt.value}</span>

              {opt.recommended && !isSelected && (
                <span className="text-xs text-primary font-medium shrink-0">
                  {components_ask_questions_label_recommended()}
                </span>
              )}
            </button>
          )
        })}

        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setShowCustomInput(true)
            onChange(index, customValue)
          }}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm border text-left transition-all duration-150 cursor-pointer",
            isOtherActive
              ? "bg-primary/10 text-foreground border-primary/50 ring-1 ring-primary/20"
              : "bg-background/60 text-foreground border-border hover:bg-muted hover:border-muted-foreground/30",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className={cn(
            "w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors",
            isOtherActive ? "border-primary" : "border-muted-foreground/40"
          )}>
            {isOtherActive && <span className="w-2 h-2 rounded-full bg-primary" />}
          </span>
          <span className="flex-1">{components_ask_questions_label_custom()}</span>
        </button>

        <AnimatePresence>
          {isOtherActive && (
            <motion.div
              key="custom-textarea"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <Textarea
                disabled={disabled}
                autoFocus={!disabled && showCustomInput}
                value={isCustomSelected ? selected : customValue}
                onChange={(e) => {
                  const el = e.target
                  el.style.height = "0px"
                  el.style.height = `${el.scrollHeight}px`
                  setCustomValue(e.target.value)
                  onChange(index, e.target.value)
                }}
                placeholder={components_ask_questions_placeholder_custom()}
                rows={2}
                className="text-sm bg-background/60 resize-none overflow-y-hidden rounded-lg"
                style={{ minHeight: "3.5rem" }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  if (q.type === "number") {
    return (
      <div className="flex flex-col gap-1">
        <div className="relative flex items-center">
          <Hash className="absolute left-3 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="number"
            disabled={disabled}
            min={q.data?.min}
            max={q.data?.max}
            value={(answer as number) ?? ""}
            onChange={(e) => onChange(index, Number(e.target.value))}
            className="pl-8 text-sm bg-background/60"
            placeholder={
              q.data?.min !== undefined && q.data?.max !== undefined
                ? `${q.data.min} – ${q.data.max}`
                : ""
            }
          />
        </div>
        {(q.data?.min !== undefined || q.data?.max !== undefined) && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {q.data?.min !== undefined && q.data?.max !== undefined
              ? `Entre ${q.data.min} y ${q.data.max}`
              : q.data?.min !== undefined
              ? `Mínimo ${q.data.min}`
              : `Máximo ${q.data?.max}`}
          </p>
        )}
      </div>
    )
  }

  if (q.type === "date") {
    const toLocalDate = (iso: string): Date => {
      const [y, m, d] = iso.split("-").map(Number)
      return new Date(y, m - 1, d)
    }

    const dateValue = answer ? toLocalDate(answer as string) : undefined

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal bg-background/60",
              !answer && "text-muted-foreground"
            )}
          >
            <Calendar className="mr-2 h-4 w-4 shrink-0" />
            {answer
              ? format(toLocalDate(answer as string), "PPP")
              : <span>{components_ask_questions_label_select_date()}</span>
            }
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarPicker
            mode="single"
            selected={dateValue}
            onSelect={(date) => {
              if (date) {
                const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
                onChange(index, iso)
              }
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    )
  }

  return null
}

// Module-level set to track submitted tool calls across re-renders / duplicate parts
const submittedToolCalls = new Set<string>()

// Module-level set to track responded reingest approval calls
const respondedApprovals = new Set<string>()

// ── ReingestApprovalRenderer ────────────────────────────────────────────────

function ReingestApprovalRenderer({
  part,
  onRespond,
  isSyncing = false,
}: {
  part: any
  onRespond?: (approvalId: string, approved: boolean) => void
  isSyncing?: boolean
}) {
  const approvalId: string | undefined = part.approval?.id
  const state: string | undefined = part.state

  const isResponded =
    state === "approval-responded" ||
    state === "output-available" ||
    state === "output-error" ||
    state === "output-denied" ||
    respondedApprovals.has(approvalId ?? "")

  const wasApproved = isResponded
    ? part.approval?.approved ?? respondedApprovals.has(`approved:${approvalId}`)
    : false

  function handleApprove() {
    if (!approvalId || isResponded) return
    respondedApprovals.add(approvalId)
    respondedApprovals.add(`approved:${approvalId}`)
    onRespond?.(approvalId, true)
  }

  function handleDeny() {
    if (!approvalId || isResponded) return
    respondedApprovals.add(approvalId)
    onRespond?.(approvalId, false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full sm:max-w-[85%] rounded-xl border border-border/50 bg-card overflow-hidden chat-float"
    >
      {/* Header */}
      <div className="relative px-4 sm:px-5 pt-4 pb-3 flex items-center gap-3 border-b border-border/40 bg-muted/30">
        {/* top state bar */}
        <div className={cn(
          "absolute top-0 left-0 right-0 h-[2px]",
          isResponded
            ? wasApproved ? "bg-green-500/70" : "bg-red-500/70"
            : "bg-amber-400/60"
        )} />
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted/50 border border-border/40 shrink-0">
          <img
            src="/nexata_logo.png"
            alt="Nexata"
            className="h-4.5 w-auto max-w-[30px] object-contain opacity-80"
          />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-semibold text-foreground leading-tight">
            {components_reingest_approval_title()}
          </span>
          <span className="text-xs text-muted-foreground leading-tight mt-0.5">
            {components_reingest_approval_description()}
          </span>
        </div>
        {isResponded && (
          <div className="flex items-center gap-1.5 shrink-0">
            <div className={cn(
              "flex items-center justify-center h-6 w-6 rounded-full border",
              wasApproved
                ? "bg-green-500/15 border-green-500/25"
                : "bg-red-500/15 border-red-500/25"
            )}>
              {wasApproved
                ? <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                : <X className="h-3 w-3 text-red-600 dark:text-red-400" />
              }
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 sm:px-5 py-3 border-t border-border/40 bg-muted/20 flex items-center justify-between gap-3">
        {isResponded && (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            {wasApproved
              ? components_reingest_approval_approved()
              : components_reingest_approval_denied()
            }
          </span>
        )}

        {!isResponded && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleDeny}
              disabled={isSyncing}
              className="gap-1.5 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              {components_reingest_approval_deny()}
            </Button>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={isSyncing}
              className="gap-1.5 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              {components_reingest_approval_approve()}
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── GmailIngestApprovalRenderer ─────────────────────────────────────────────

function GmailIngestApprovalRenderer({
  part,
  onRespond,
  isSyncing = false,
}: {
  part: any
  onRespond?: (approvalId: string, approved: boolean) => void
  isSyncing?: boolean
}) {
  const input = part.input as { messageId?: string; attachmentIds?: string[] } | undefined
  const approvalId: string | undefined = part.approval?.id
  const state: string | undefined = part.state

  const isResponded =
    state === "approval-responded" ||
    state === "output-available" ||
    state === "output-error" ||
    state === "output-denied" ||
    respondedApprovals.has(approvalId ?? "")

  const wasApproved = isResponded
    ? part.approval?.approved ?? respondedApprovals.has(`approved:${approvalId}`)
    : false

  function handleApprove() {
    if (!approvalId || isResponded) return
    respondedApprovals.add(approvalId)
    respondedApprovals.add(`approved:${approvalId}`)
    onRespond?.(approvalId, true)
  }

  function handleDeny() {
    if (!approvalId || isResponded) return
    respondedApprovals.add(approvalId)
    onRespond?.(approvalId, false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full sm:max-w-[85%] rounded-xl border border-border/50 bg-card overflow-hidden chat-float"
    >
      {/* Header */}
      <div className="relative px-4 sm:px-5 pt-4 pb-3 flex items-center gap-3 border-b border-border/40 bg-muted/30">
        {/* top state bar */}
        <div className={cn(
          "absolute top-0 left-0 right-0 h-[2px]",
          isResponded
            ? wasApproved ? "bg-green-500/70" : "bg-red-500/70"
            : "bg-amber-400/60"
        )} />
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted/50 border border-border/40 shrink-0">
          <img
            src="/datasource_icons/gmail.png"
            alt="Gmail"
            className="h-4.5 w-auto max-w-[30px] object-contain opacity-80"
          />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-semibold text-foreground leading-tight">
            {components_gmail_ingest_approval_title()}
          </span>
          <span className="text-xs text-muted-foreground leading-tight mt-0.5">
            {components_gmail_ingest_approval_description()}
          </span>
        </div>
        {isResponded && (
          <div className="flex items-center gap-1.5 shrink-0">
            <div className={cn(
              "flex items-center justify-center h-6 w-6 rounded-full border",
              wasApproved
                ? "bg-green-500/15 border-green-500/25"
                : "bg-red-500/15 border-red-500/25"
            )}>
              {wasApproved
                ? <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                : <X className="h-3 w-3 text-red-600 dark:text-red-400" />
              }
            </div>
          </div>
        )}
      </div>

      {/* Attachment count */}
      {input?.attachmentIds && input.attachmentIds.length > 0 && (
        <div className="px-4 sm:px-5 py-3 flex items-center gap-2.5">
          <div className={cn(
            "flex items-center gap-2 rounded-lg border p-3 flex-1 transition-all duration-200",
            isResponded
              ? "border-border/30 bg-muted/20"
              : "border-border/40 bg-background/40"
          )}>
            <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-foreground">
              {components_ingest_approval_attachment_count({ count: input.attachmentIds.length })}
            </span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 sm:px-5 py-3 border-t border-border/40 bg-muted/20 flex items-center justify-between gap-3">
        {isResponded && (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            {wasApproved
              ? components_gmail_ingest_approval_approved()
              : components_gmail_ingest_approval_denied()
            }
          </span>
        )}

        {!isResponded && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleDeny}
              disabled={isSyncing}
              className="gap-1.5 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              {components_gmail_ingest_approval_deny()}
            </Button>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={isSyncing}
              className="gap-1.5 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              {components_gmail_ingest_approval_approve()}
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── OutlookIngestApprovalRenderer ───────────────────────────────────────────

function OutlookIngestApprovalRenderer({
  part,
  onRespond,
  isSyncing = false,
}: {
  part: any
  onRespond?: (approvalId: string, approved: boolean) => void
  isSyncing?: boolean
}) {
  const input = part.input as { messageId?: string; attachmentIds?: string[] } | undefined
  const approvalId: string | undefined = part.approval?.id
  const state: string | undefined = part.state

  const isResponded =
    state === "approval-responded" ||
    state === "output-available" ||
    state === "output-error" ||
    state === "output-denied" ||
    respondedApprovals.has(approvalId ?? "")

  const wasApproved = isResponded
    ? part.approval?.approved ?? respondedApprovals.has(`approved:${approvalId}`)
    : false

  function handleApprove() {
    if (!approvalId || isResponded) return
    respondedApprovals.add(approvalId)
    respondedApprovals.add(`approved:${approvalId}`)
    onRespond?.(approvalId, true)
  }

  function handleDeny() {
    if (!approvalId || isResponded) return
    respondedApprovals.add(approvalId)
    onRespond?.(approvalId, false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full sm:max-w-[85%] rounded-xl border border-border/50 bg-card overflow-hidden chat-float"
    >
      {/* Header */}
      <div className="relative px-4 sm:px-5 pt-4 pb-3 flex items-center gap-3 border-b border-border/40 bg-muted/30">
        {/* top state bar */}
        <div className={cn(
          "absolute top-0 left-0 right-0 h-[2px]",
          isResponded
            ? wasApproved ? "bg-green-500/70" : "bg-red-500/70"
            : "bg-amber-400/60"
        )} />
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted/50 border border-border/40 shrink-0">
          <img
            src="/datasource_icons/outlook.png"
            alt="Outlook"
            className="h-4.5 w-auto max-w-[30px] object-contain opacity-80"
          />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-semibold text-foreground leading-tight">
            {components_outlook_ingest_approval_title()}
          </span>
          <span className="text-xs text-muted-foreground leading-tight mt-0.5">
            {components_outlook_ingest_approval_description()}
          </span>
        </div>
        {isResponded && (
          <div className="flex items-center gap-1.5 shrink-0">
            <div className={cn(
              "flex items-center justify-center h-6 w-6 rounded-full border",
              wasApproved
                ? "bg-green-500/15 border-green-500/25"
                : "bg-red-500/15 border-red-500/25"
            )}>
              {wasApproved
                ? <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                : <X className="h-3 w-3 text-red-600 dark:text-red-400" />
              }
            </div>
          </div>
        )}
      </div>

      {/* Attachment count */}
      {input?.attachmentIds && input.attachmentIds.length > 0 && (
        <div className="px-4 sm:px-5 py-3 flex items-center gap-2.5">
          <div className={cn(
            "flex items-center gap-2 rounded-lg border p-3 flex-1 transition-all duration-200",
            isResponded
              ? "border-border/30 bg-muted/20"
              : "border-border/40 bg-background/40"
          )}>
            <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-foreground">
              {components_ingest_approval_attachment_count({ count: input.attachmentIds.length })}
            </span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 sm:px-5 py-3 border-t border-border/40 bg-muted/20 flex items-center justify-between gap-3">
        {isResponded && (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            {wasApproved
              ? components_outlook_ingest_approval_approved()
              : components_outlook_ingest_approval_denied()
            }
          </span>
        )}

        {!isResponded && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleDeny}
              disabled={isSyncing}
              className="gap-1.5 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              {components_outlook_ingest_approval_deny()}
            </Button>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={isSyncing}
              className="gap-1.5 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              {components_outlook_ingest_approval_approve()}
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── ProviderIngestApprovalRenderer (shared for Drive/Dropbox/OneDrive) ───────

type ProviderIngestI18n = {
  alt: string
  title: () => string
  description: () => string
  approve: () => string
  deny: () => string
  approved: () => string
  denied: () => string
}

const PROVIDER_INGEST_I18N = {
  DriveIngest: {
    alt: "Google Drive",
    title: components_drive_ingest_approval_title,
    description: components_drive_ingest_approval_description,
    approve: components_drive_ingest_approval_approve,
    deny: components_drive_ingest_approval_deny,
    approved: components_drive_ingest_approval_approved,
    denied: components_drive_ingest_approval_denied,
  },
  DropboxIngest: {
    alt: "Dropbox",
    title: components_dropbox_ingest_approval_title,
    description: components_dropbox_ingest_approval_description,
    approve: components_dropbox_ingest_approval_approve,
    deny: components_dropbox_ingest_approval_deny,
    approved: components_dropbox_ingest_approval_approved,
    denied: components_dropbox_ingest_approval_denied,
  },
  OneDriveIngest: {
    alt: "OneDrive",
    title: components_onedrive_ingest_approval_title,
    description: components_onedrive_ingest_approval_description,
    approve: components_onedrive_ingest_approval_approve,
    deny: components_onedrive_ingest_approval_deny,
    approved: components_onedrive_ingest_approval_approved,
    denied: components_onedrive_ingest_approval_denied,
  },
} as const satisfies Record<string, ProviderIngestI18n>

function ProviderIngestApprovalRenderer({
  part,
  onRespond,
  isSyncing = false,
  icon,
  iconAlt,
  i18n,
}: {
  part: any
  onRespond?: (approvalId: string, approved: boolean) => void
  isSyncing?: boolean
  icon: string
  iconAlt: string
  i18n: ProviderIngestI18n
}) {
  const input = part.input as { selection?: { id: string; isDir: boolean }[] } | undefined
  const approvalId: string | undefined = part.approval?.id
  const state: string | undefined = part.state

  const isResponded =
    state === "approval-responded" ||
    state === "output-available" ||
    state === "output-error" ||
    state === "output-denied" ||
    respondedApprovals.has(approvalId ?? "")

  const wasApproved = isResponded
    ? part.approval?.approved ?? respondedApprovals.has(`approved:${approvalId}`)
    : false

  function handleApprove() {
    if (!approvalId || isResponded) return
    respondedApprovals.add(approvalId)
    respondedApprovals.add(`approved:${approvalId}`)
    onRespond?.(approvalId, true)
  }

  function handleDeny() {
    if (!approvalId || isResponded) return
    respondedApprovals.add(approvalId)
    onRespond?.(approvalId, false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full sm:max-w-[85%] rounded-xl border border-border/50 bg-card overflow-hidden chat-float"
    >
      {/* Header */}
      <div className="relative px-4 sm:px-5 pt-4 pb-3 flex items-center gap-3 border-b border-border/40 bg-muted/30">
        {/* top state bar */}
        <div className={cn(
          "absolute top-0 left-0 right-0 h-[2px]",
          isResponded
            ? wasApproved ? "bg-green-500/70" : "bg-red-500/70"
            : "bg-amber-400/60"
        )} />
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted/50 border border-border/40 shrink-0">
          <img
            src={icon}
            alt={iconAlt}
            className="h-4.5 w-auto max-w-[30px] object-contain opacity-80"
          />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-semibold text-foreground leading-tight">
            {i18n.title()}
          </span>
          <span className="text-xs text-muted-foreground leading-tight mt-0.5">
            {i18n.description()}
          </span>
        </div>
        {isResponded && (
          <div className="flex items-center gap-1.5 shrink-0">
            <div className={cn(
              "flex items-center justify-center h-6 w-6 rounded-full border",
              wasApproved
                ? "bg-green-500/15 border-green-500/25"
                : "bg-red-500/15 border-red-500/25"
            )}>
              {wasApproved
                ? <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                : <X className="h-3 w-3 text-red-600 dark:text-red-400" />
              }
            </div>
          </div>
        )}
      </div>

      {/* Item count */}
      {input?.selection && input.selection.length > 0 && (
        <div className="px-4 sm:px-5 py-3 flex items-center gap-2.5">
          <div className={cn(
            "flex items-center gap-2 rounded-lg border p-3 flex-1 transition-all duration-200",
            isResponded
              ? "border-border/30 bg-muted/20"
              : "border-border/40 bg-background/40"
          )}>
            <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-foreground">
              {components_ingest_approval_item_count({ count: input.selection.length })}
            </span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 sm:px-5 py-3 border-t border-border/40 bg-muted/20 flex items-center justify-between gap-3">
        {isResponded && (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            {wasApproved
              ? i18n.approved()
              : i18n.denied()
            }
          </span>
        )}

        {!isResponded && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleDeny}
              disabled={isSyncing}
              className="gap-1.5 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              {i18n.deny()}
            </Button>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={isSyncing}
              className="gap-1.5 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              {i18n.approve()}
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export function AskQuestionsRenderer({
  part,
  onSubmit,
  isSyncing = false,
}: {
  part: any
  onSubmit?: (toolCallId: string, answers: Record<number, AnswerValue>) => void
  isSyncing?: boolean
}) {
  const input = part.input as AskQuestionsInput | undefined
  const isStreaming = part.state === "input-streaming"
  const isError = part.state === "output-error"
  const isDone = part.state === "output-available" || submittedToolCalls.has(part.toolCallId ?? "")

  // Failed tool calls (validation errors, etc.) should not render at all —
  // avoids stuck skeleton loaders when the LLM sends malformed input.
  if (isError) return null

  const questions = input?.questions ?? []

  const [answers, setAnswers] = useState<Record<number, AnswerValue>>(() => {
    if (isDone && part.output && typeof part.output === "object" && !Array.isArray(part.output)) {
      // Skip toon-encoded wrapper objects from old persisted messages
      if ("type" in part.output && "value" in part.output) return {}
      return part.output as Record<number, AnswerValue>
    }
    return {}
  })
  const [submitted, setSubmitted] = useState(isDone)

  const answeredCount = questions.filter((_: AskQuestion, i: number) => {
    const a = answers[i]
    if (a === undefined || a === "") return false
    if (Array.isArray(a)) return a.length > 0
    return true
  }).length

  function handleChange(i: number, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [i]: value }))
  }

  function handleSubmit() {
    submittedToolCalls.add(part.toolCallId ?? "")
    setSubmitted(true)
    onSubmit?.(part.toolCallId, answers)
  }

  if (isStreaming || (!isDone && !submitted && questions.length === 0)) {
    return <AskQuestionsSkeleton />
  }

  if (questions.length === 0) return null

  const isDisabled = submitted || isDone
  const progressPercent = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0

  const headerTitle = isDisabled
    ? components_ask_questions_status_submitted()
    : components_ask_questions_status_answering()

  const questionCountLabel = questions.length === 1
    ? `1 ${components_ask_questions_label_question_singular()}`
    : `${questions.length} ${components_ask_questions_label_question_plural()}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full sm:max-w-[85%] rounded-xl border border-border/50 bg-card overflow-hidden chat-float"
    >
      {/* Header */}
      <div className="relative px-4 sm:px-5 pt-4 pb-3 flex items-center gap-3 border-b border-border/40 bg-muted/30">
        {/* top state bar */}
        <div className={cn(
          "absolute top-0 left-0 right-0 h-[2px]",
          isDisabled ? "bg-green-500/70" : "bg-blue-400/60"
        )} />
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted/50 border border-border/40 shrink-0">
          <img
            src="/nexata_logo.png"
            alt="Nexata"
            className="h-4.5 w-auto max-w-[30px] object-contain opacity-80"
          />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-semibold text-foreground leading-tight">
            {headerTitle}
          </span>
          <span className="text-xs text-muted-foreground leading-tight mt-0.5">
            {questionCountLabel}
          </span>
        </div>
        {isDisabled && (
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-green-500/15 border border-green-500/25">
              <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {!isDisabled && (
        <div className="px-4 sm:px-5 pt-3 pb-1">
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="px-4 sm:px-5 py-3 flex flex-col gap-2">
        {questions.map((q: AskQuestion, i: number) => {
          const isAnswered = (() => {
            const a = answers[i]
            if (a === undefined || a === "") return false
            if (Array.isArray(a)) return a.length > 0
            return true
          })()

          return (
            <div
              key={i}
              className={cn(
                "flex flex-col gap-2.5 rounded-lg border p-3 transition-all duration-200",
                isDisabled
                  ? "border-border/30 bg-muted/20"
                  : isAnswered
                  ? "border-primary/20 bg-primary/[0.03]"
                  : "border-border/40 bg-background/40"
              )}
            >
              {/* Question header */}
              <div className="flex items-start gap-2.5">
                <div className={cn(
                  "flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold shrink-0 mt-0.5 transition-colors",
                  isAnswered
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                )}>
                  {isDisabled && isAnswered ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-medium text-foreground leading-snug">
                    {q.question}
                  </span>
                  {q.recommendation && (
                    <span className="text-xs text-muted-foreground leading-snug">
                      {q.recommendation}
                    </span>
                  )}
                </div>
              </div>

              {/* Question field */}
              <div className="pl-[30px]">
                <QuestionField
                  q={q}
                  index={i}
                  answer={answers[i]}
                  disabled={isDisabled}
                  onChange={handleChange}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-4 sm:px-5 py-3 border-t border-border/40 bg-muted/20 flex items-center justify-between gap-3">
        {isDisabled ? (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            {components_ask_questions_label_answers_sent()}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground tabular-nums">
            {components_ask_questions_label_answered_count({
              answered: answeredCount,
              total: questions.length,
            })}
          </span>
        )}

        {!isDisabled && (
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSyncing || !onSubmit}
            className="gap-1.5 cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
            {components_ask_questions_button_submit()}
          </Button>
        )}
      </div>
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/*                             Helper functions                               */
/* -------------------------------------------------------------------------- */

function getStatusIcon(state?: string) {
  if (state === "output-available") return () => <Check className="h-4 w-4 text-green-500" />
  if (state === "output-error") return () => <X className="h-4 w-4 text-red-500" />
  if (state === "output-denied") return () => <Ban className="h-4 w-4 text-yellow-500" />

  return () => (<Loader2 className="h-4 w-4 animate-spin text-blue-500" />)
}

function isToolPart(
  part: UIMessage["parts"][number]
): part is Extract<UIMessage["parts"][number], { state: string }> {
  return (
    part.type === "dynamic-tool" ||
    (part.type.startsWith("tool-") && part.type !== "tool-result")
  )
}
