import React from "react"
import { useState } from "react"
import type { UIMessage, useChat } from "@ai-sdk/react"
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "framer-motion"
import {
  Loader2,
  X,
  Ban,
  Globe,
  Sparkles,
  Hash,
  Send,
  Check,
  Calendar
} from "lucide-react"
import { cn } from "@/lib/utils"
import { FilePreview } from "@/components/ui/file-preview"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import {
  'components.reasoning_block.title' as components_reasoning_block_title,
  'components.reasoning_block.description' as components_reasoning_block_description,
  'tools.gmail.search' as tools_gmail_search,
  'tools.gmail.read' as tools_gmail_read,
  'tools.drive.search' as tools_drive_search,
  'tools.drive.list' as tools_drive_list,
  'tools.outlook.search' as tools_outlook_search,
  'tools.outlook.read' as tools_outlook_read,
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
  'tools.drive.search_success' as tools_drive_search_success,
  'tools.drive.search_error' as tools_drive_search_error,
  'tools.drive.list_success' as tools_drive_list_success,
  'tools.drive.list_error' as tools_drive_list_error,
  'tools.outlook.search_success' as tools_outlook_search_success,
  'tools.outlook.search_error' as tools_outlook_search_error,
  'tools.outlook.read_success' as tools_outlook_read_success,
  'tools.outlook.read_error' as tools_outlook_read_error,
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
} from '@/paraglide/messages.js';
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarPicker } from "@/components/ui/calendar"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"

/* -------------------------------------------------------------------------- */
/*                                   Styles                                    */
/* -------------------------------------------------------------------------- */

const chatBubbleVariants = cva(
  "relative break-words rounded-lg p-3 text-md max-w-[85%]",
  {
    variants: {
      isUser: {
        true: "bg-muted text-foreground",
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
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  showTimeStamp = false,
  animation = "scale",
  actions,
  disableTypingAnimation,
  addToolOutput
}) => {
  const isUser = message.role === "user"

  const createdAt =
    typeof message.metadata === "object" &&
    message.metadata &&
    "createdAt" in message.metadata
      ? new Date((message.metadata as any).createdAt)
      : undefined

  const formattedTime = createdAt?.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })

  // Helper para FilePreview
  function filePartToBrowserFile(part: any): File {
    if (!part.url) {
      return new File(
        [],
        part.filename ?? "Unknown",
        { type: part.mediaType ?? "application/octet-stream" }
      )
    }

    const base64 = part.url.split(",")[1]
    const bytes = atob(base64)
    const array = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i)

    return new File(
      [array],
      part.filename ?? "Unknown",
      { type: part.mediaType ?? "application/octet-stream" }
    )
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 w-full",
        isUser ? "items-end" : "items-start"
      )}
    >
      {(() => {
        const blocks: React.ReactNode[] = []

        // guardamos part + índice global
        let buffer: { part: any; globalIndex: number }[] = []

        const flushBuffer = () => {
          if (!buffer.length) return

          const firstIndex = buffer[0]?.globalIndex
          const lastIndex = buffer[buffer.length - 1]?.globalIndex
          const bubbleKey = `bubble-${firstIndex}-${lastIndex}`


          const textBuffer = buffer.filter(b => b.part.type === "text")
          const fileBuffer = buffer.filter(b => b.part.type === "file")

          blocks.push(
            <motion.div
              key={bubbleKey}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={cn(chatBubbleVariants({ isUser, animation: "none" }))}
            >
              {/* TEXT */}
              {textBuffer.map(({ part, globalIndex }, i) => {
                return (
                  <div key={`text-${i}`}>
                    <MarkdownRenderer>{part.text}</MarkdownRenderer>
                  </div>
                )
              })}

              {/* FILES */}
              {fileBuffer.map(({ part }, i) => {
                const browserFile = filePartToBrowserFile(part)

                return (
                  <div
                    key={`file-${i}`}
                    className="mt-3 scale-90 origin-left"
                  >
                    <FilePreview file={browserFile} />
                  </div>
                )
              })}
            </motion.div>
          )

          buffer = []
        }

        message.parts.forEach((part, index) => {
          if (part.type === "text" || part.type === "file") {
            buffer.push({ part, globalIndex: index })
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
            const rawName = part.type === "dynamic-tool"
              ? part.toolName
              : part.type.replace("tool-", "")

            if (rawName === "NexataAskQuestions") {
              blocks.push(
                <AskQuestionsRenderer
                  key={`ask-${index}`}
                  part={part}
                  onSubmit={(toolCallId, answers) => {
                    addToolOutput?.({
                      toolCallId,
                      tool: rawName,
                      output: answers,
                    })
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

      {showTimeStamp && createdAt && (
        <time className="text-xs opacity-50">
          {formattedTime}
        </time>
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
      initial={{ opacity: 0, scale: 0.98, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: -4 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative flex items-center gap-3 w-full sm:max-w-[85%] rounded-xl border border-violet-500/30 bg-violet-500/5 px-4 py-3 overflow-hidden"
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
  GmailSearch:              { pending: tools_gmail_search,                    success: tools_gmail_search_success,                    error: tools_gmail_search_error },
  GmailRead:                { pending: tools_gmail_read,                      success: tools_gmail_read_success,                      error: tools_gmail_read_error },
  DriveSearch:              { pending: tools_drive_search,                    success: tools_drive_search_success,                    error: tools_drive_search_error },
  DriveListDir:             { pending: tools_drive_list,                      success: tools_drive_list_success,                      error: tools_drive_list_error },
  OutlookSearch:            { pending: tools_outlook_search,                  success: tools_outlook_search_success,                  error: tools_outlook_search_error },
  OutlookRead:              { pending: tools_outlook_read,                    success: tools_outlook_read_success,                    error: tools_outlook_read_error },
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
  DriveSearch:              '/datasource_icons/gdrive.png',
  DriveListDir:             '/datasource_icons/gdrive.png',
  OutlookSearch:            '/datasource_icons/outlook.png',
  OutlookRead:              '/datasource_icons/outlook.png',
  MicrosoftCalendarList:    '/datasource_icons/ocalendar.png',
  MicrosoftCalendarEvents:  '/datasource_icons/ocalendar.png',
  MicrosoftCalendarRead:    '/datasource_icons/ocalendar.png',
  OneDriveSearch:           '/datasource_icons/onedrive.png',
  OneDriveListDir:          '/datasource_icons/onedrive.png',
  DropboxSearch:            '/datasource_icons/dropbox.png',
  DropboxListDir:           '/datasource_icons/dropbox.png',
  CalendarList:             '/datasource_icons/gcalendar.png',
  CalendarEvents:           '/datasource_icons/gcalendar.png',
  CalendarRead:             '/datasource_icons/gcalendar.png',
}

function getToolLabel(rawToolName: string, state?: string) {
  const entry = TOOL_LABEL_MAP[rawToolName]
  if (!entry) return rawToolName
  if (state === 'output-available') return entry.success()
  if (state === 'output-error' || state === 'output-denied') return entry.error()
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
  if (!isToolPart(part)) return null

  const rawToolName =
    part.type === "dynamic-tool"
      ? part.toolName
      : part.type.replace("tool-", "")

  const label = getToolLabel(rawToolName, part.state)
  const isNexata = NEXATA_TOOLS.has(rawToolName)
  const icon = !isNexata ? TOOL_ICON_MAP[rawToolName] : null
  const StatusIcon = getStatusIcon(part.state)

  const emails = getCredentialEmails(part)
  const visibleEmails = emails.slice(0, 2)
  const extraCount = emails.length - visibleEmails.length

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="w-full sm:max-w-[85%] rounded-lg border bg-muted/40 px-4 py-3"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">

          {/* Icon: Nexata > tool icon map > fallback */}
          {isNexata ? (
            <img
              src="/nexata_logo.png"
              alt="Nexata"
              className="h-5 w-auto max-w-15 shrink-0 object-contain"
            />
          ) : icon ? (
            <img src={icon} alt={rawToolName} className="h-5 w-5 shrink-0 object-contain" />
          ) : (
            <Globe className="h-5 w-5 shrink-0 text-muted-foreground" />
          )}

          <div className="flex flex-col min-w-0">
            <span className="text-md font-medium truncate">{label}</span>

            {visibleEmails.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {visibleEmails.map((email, i) => (
                  <React.Fragment key={email}>
                    <span className="text-xs opacity-60 truncate">{email}</span>
                    {i < visibleEmails.length - 1 && (
                      <span className="text-xs opacity-30">|</span>
                    )}
                  </React.Fragment>
                ))}
                {extraCount > 0 && (
                  <>
                    <span className="text-xs opacity-30">|</span>
                    <span className="text-xs opacity-40">+{extraCount}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <StatusIcon />
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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full sm:max-w-[85%] rounded-xl border bg-muted/40 overflow-hidden"
    >
      <div className="px-5 pt-4 pb-3 border-b border-border/50 flex items-center gap-2.5">
        <div className="h-4 w-[48px] rounded bg-muted-foreground/20 animate-pulse" />
        <div className="h-3 w-36 rounded bg-muted-foreground/15 animate-pulse" />
      </div>
      <div className="px-5 py-4 flex flex-col gap-5">
        {[
          { labelW: "w-3/4", inputH: "h-9" },
          { labelW: "w-1/2", inputH: "h-9" },
          { labelW: "w-2/3", inputH: "h-9" },
        ].map((item, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className={cn("h-3.5 rounded bg-muted-foreground/15 animate-pulse", item.labelW)} />
            <div className={cn("w-full rounded-md bg-muted-foreground/10 animate-pulse", item.inputH)} />
          </div>
        ))}
      </div>
      <div className="px-5 pb-4 flex justify-end">
        <div className="h-8 w-24 rounded-md bg-muted-foreground/10 animate-pulse" />
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
  if (q.type === "text") {
    return (
      <Textarea
        disabled={disabled}
        placeholder={q.data?.placeholder ?? ""}
        value={(answer as string) ?? ""}
        onChange={(e) => onChange(index, e.target.value)}
        rows={2}
        className="text-sm bg-background resize-none"
      />
    )
  }

  if (q.type === "boolean") {
    return (
      <div className="flex gap-2">
        {([
          { label: components_ask_questions_label_yes(), value: true },
          { label: components_ask_questions_label_no(), value: false },
        ] as const).map(({ label, value }) => {
          const isSelected = answer === value
          return (
            <button
              key={label}
              type="button"
              disabled={disabled}
              onClick={() => onChange(index, value)}
              className={cn(
                "px-5 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150 cursor-pointer",
                isSelected
                  ? "bg-foreground text-background border-foreground shadow-sm"
                  : "bg-background text-foreground border-border hover:bg-muted hover:border-muted-foreground/30",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {label}
            </button>
          )
        })}
      </div>
    )
  }

  if (q.type === "multi_select") {
    const selected = (answer as string[]) ?? []
    return (
      <div className="flex flex-wrap gap-2">
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
                  ? "bg-foreground text-background border-foreground shadow-sm"
                  : "bg-background text-foreground border-border hover:bg-muted hover:border-muted-foreground/30",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {opt.recommended && !isSelected && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
              )}
              {opt.value}
            </button>
          )
        })}
        {q.data.some((o) => o.recommended) && (
          <p className="w-full text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
            {components_ask_questions_label_recommended()}
          </p>
        )}
      </div>
    )
  }

  if (q.type === "multiple_choice") {
    const selected = (answer as string) ?? ""
    return (
      <div className="flex flex-col gap-1.5">
        {q.data.map((opt) => {
          const isSelected = selected === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(index, opt.value)}
              className={cn(
                "flex items-center gap-3 w-full px-3.5 py-2.5 rounded-lg text-sm border text-left transition-all duration-150 cursor-pointer",
                isSelected
                  ? "bg-foreground text-background border-foreground shadow-sm"
                  : "bg-background text-foreground border-border hover:bg-muted hover:border-muted-foreground/30",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {/* Radio button — filled solid circle when selected */}
              <span className={cn(
                "w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors",
                isSelected ? "border-background bg-background" : "border-muted-foreground/40 bg-transparent"
              )} />

              <span className="flex-1">{opt.value}</span>

              {opt.recommended && !isSelected && (
                <span className="text-xs text-blue-400 font-medium shrink-0">
                  {components_ask_questions_label_recommended()}
                </span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  if (q.type === "number") {
    return (
      <div className="relative">
        {/* Fix: flex centering instead of absolute positioning */}
        <div className="relative flex items-center">
          <Hash className="absolute left-3 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="number"
            disabled={disabled}
            min={q.data?.min}
            max={q.data?.max}
            value={(answer as number) ?? ""}
            onChange={(e) => onChange(index, Number(e.target.value))}
            className="pl-8 text-sm bg-background"
            placeholder={
              q.data?.min !== undefined && q.data?.max !== undefined
                ? `${q.data.min} – ${q.data.max}`
                : ""
            }
          />
        </div>
        {(q.data?.min !== undefined || q.data?.max !== undefined) && (
          <p className="text-xs text-muted-foreground mt-1">
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
    // FIX: new Date("2025-03-08") se interpreta como UTC midnight,
    // lo que en UTC-3 (Argentina) cae en el día anterior.
    // Parseamos manualmente para forzar interpretación local.
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
              "w-full justify-start text-left font-normal bg-background",
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
                // Construimos el string manualmente para evitar reinterpretación UTC
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

// ── Main component ──────────────────────────────────────────────────────────

export function AskQuestionsRenderer({
  part,
  onSubmit,
}: {
  part: any
  onSubmit?: (toolCallId: string, answers: Record<number, AnswerValue>) => void
}) {
  const input = part.input as AskQuestionsInput | undefined
  const isStreaming = part.state === "input-streaming"
  const isDone = part.state === "output-available"

  const questions = input?.questions ?? []

  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({})
  const [submitted, setSubmitted] = useState(false)

  const allAnswered = questions.length > 0 && questions.every((q, i) => {
    const a = answers[i]
    if (a === undefined || a === "") return false
    if (Array.isArray(a)) return a.length > 0
    return true
  })

  function handleChange(i: number, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [i]: value }))
  }

  function handleSubmit() {
    if (!allAnswered) return
    setSubmitted(true)
    onSubmit?.(part.toolCallId, answers)
  }

  if (isStreaming || (!isDone && !submitted && questions.length === 0)) {
    return <AskQuestionsSkeleton />
  }

  if (questions.length === 0) return null

  const isDisabled = submitted || isDone

  // Header dinámico según estado
  const headerTitle = isDisabled
    ? components_ask_questions_status_submitted()
    : components_ask_questions_status_answering()

  const questionCountLabel = questions.length === 1
    ? `1 ${components_ask_questions_label_question_singular()}`
    : `${questions.length} ${components_ask_questions_label_question_plural()}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full sm:max-w-[85%] rounded-xl border bg-muted/40 overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img
            src="/nexata_logo.png"
            alt="Nexata"
            className="h-4 w-auto max-w-[48px] object-contain"
          />
          <span className="text-sm font-semibold text-foreground">
            {headerTitle}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {questionCountLabel}
        </span>
      </div>

      {/* Questions */}
      <div className="px-5 py-4 flex flex-col gap-5">
        {questions.map((q, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold text-muted-foreground mt-0.5 shrink-0 tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
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
            <div className="pl-6">
              <QuestionField
                q={q}
                index={i}
                answer={answers[i]}
                disabled={isDisabled}
                onChange={handleChange}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 pb-4 flex items-center justify-between">
        {isDisabled ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-green-500" />
            <span>{components_ask_questions_label_answers_sent()}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            {components_ask_questions_label_answered_count({
              answered: Object.keys(answers).length,
              total: questions.length,
            })}
          </span>
        )}

        {!isDisabled && (
          <Button
            size="sm"
            disabled={!allAnswered}
            onClick={handleSubmit}
            variant="secondary"
            className="gap-2 transition-all cursor-pointer"
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
    part.type.startsWith("tool-")
  )
}
