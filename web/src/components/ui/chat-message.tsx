import React from "react"
import type { UIMessage } from "@ai-sdk/react"
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "framer-motion"
import {
  Loader2,
  Check,
  X,
  Ban,
  Globe,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { FilePreview } from "@/components/ui/file-preview"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { DINAMIC_DATA_SOURCES, STORAGE_DATA_SOURCES } from "@/lib/available-sources"
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
} from '@/paraglide/messages.js';

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
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  showTimeStamp = false,
  animation = "scale",
  actions,
  disableTypingAnimation,
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
            console.log(part);
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

// Agregar estos imports a los paraglide existentes:
// 'tools.gmail.search_success', 'tools.gmail.search_error', etc.
// (ver lista completa abajo en el JSON)

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
                {visibleEmails.map((email) => (
                  <span key={email} className="text-xs opacity-60 truncate">
                    {email}
                  </span>
                ))}
                {extraCount > 0 && (
                  <span className="text-xs opacity-40">+{extraCount}</span>
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
/*                             Helper functions                                */
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
