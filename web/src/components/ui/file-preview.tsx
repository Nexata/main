import React, { useEffect, useMemo } from "react"
import { motion } from "framer-motion"
import {
  FileIcon,
  ImageIcon,
  FileText,
  FileCode,
  Archive,
  FileSpreadsheet,
  X,
  FileText as PdfIcon,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip" // shadcn tooltip

interface FilePreviewProps {
  file: File
  onRemove?: () => void
}

function truncateFileName(name: string, maxLength = 16) {
  if (name.length <= maxLength) return name

  const extIndex = name.lastIndexOf(".")
  if (extIndex === -1) {
    return name.slice(0, maxLength - 3) + "..."
  }

  const base = name.slice(0, extIndex)
  const ext = name.slice(extIndex)
  if (base.length + ext.length <= maxLength) return name

  const allowedBaseLength = maxLength - ext.length - 3
  if (allowedBaseLength <= 0) {
    return name.slice(0, maxLength - 3) + "..."
  }

  return base.slice(0, allowedBaseLength) + "..." + ext
}

/* ---------------- ICON RESOLVER ---------------- */

function getFileIcon(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase()

  if (file.type.startsWith("image/")) return ImageIcon
  if (file.type.startsWith("text/")) return FileText

  switch (ext) {
    case "doc":
    case "docx":
      return FileText
    case "xls":
    case "xlsx":
      return FileSpreadsheet
    case "pdf":
      return PdfIcon
    case "zip":
    case "rar":
    case "7z":
      return Archive
    case "json":
    case "js":
    case "ts":
    case "tsx":
    case "html":
    case "css":
      return FileCode
    default:
      return FileIcon
  }
}

/* ---------------- ROOT WRAPPER ---------------- */

const BaseCard = ({
  children,
  onRemove,
  ref,
}: {
  children: React.ReactNode
  onRemove?: () => void
  ref?: React.Ref<HTMLDivElement>
}) => (
  <motion.div
    ref={ref}
    layout
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 8 }}
    className="
      group relative flex items-center w-50
      rounded-lg border
      bg-background/80 backdrop-blur
      p-2
      shadow-sm
      transition-all
    "
  >
    {children}

    {onRemove && (
      <button
        onClick={onRemove}
        type="button"
        aria-label="Remove file"
        className="
          absolute right-1 top-1
          flex h-5 w-5 items-center justify-center
          rounded-md
          bg-muted/70
          opacity-0
          transition
          group-hover:opacity-100
          hover:bg-destructive/10
          cursor-pointer
        "
      >
        <X className="h-3 w-3" />
      </button>
    )}
  </motion.div>
)

/* ---------------- IMAGE PREVIEW ---------------- */

const ImageFilePreview = React.forwardRef<HTMLDivElement, FilePreviewProps>(
  ({ file, onRemove }, ref) => {
    const url = useMemo(() => URL.createObjectURL(file), [file])

    return (
      <TooltipProvider>
        <BaseCard ref={ref} onRemove={onRemove}>
          <img
            src={url}
            alt={file.name}
            className="h-10 w-10 shrink-0 rounded-md border object-cover"
          />
          <div className="flex min-w-0 flex-1 flex-col justify-center items-start pl-2">
            <Tooltip>
              <TooltipTrigger>
                <span className="truncate text-sm font-medium">
                  {truncateFileName(file.name, 16)}
                </span>
              </TooltipTrigger>
              <TooltipContent>{file.name}</TooltipContent>
            </Tooltip>
            <span className="truncate text-xs text-muted-foreground">image</span>
          </div>
        </BaseCard>
      </TooltipProvider>
    )
  }
)
ImageFilePreview.displayName = "ImageFilePreview"

/* ---------------- TEXT PREVIEW ---------------- */

const TextFilePreview = React.forwardRef<HTMLDivElement, FilePreviewProps>(
  ({ file, onRemove }, ref) => {
    const [preview, setPreview] = React.useState("")

    useEffect(() => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = (e.target?.result as string) || ""
        setPreview(text.slice(0, 60))
      }
      reader.readAsText(file)
    }, [file])

    return (
      <TooltipProvider>
        <BaseCard ref={ref} onRemove={onRemove}>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 shrink-0 rounded-md border bg-muted p-1 text-[8px] leading-tight overflow-hidden text-muted-foreground">
              {preview || "..."}
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center items-start">
              <Tooltip>
                <TooltipTrigger>
                  <span className="truncate text-sm font-medium">
                    {truncateFileName(file.name, 16)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{file.name}</TooltipContent>
              </Tooltip>
              <span className="truncate text-xs text-muted-foreground">{truncateFileName(preview, 16)}</span>
            </div>
          </div>
        </BaseCard>
      </TooltipProvider>
    )
  }
)
TextFilePreview.displayName = "TextFilePreview"

/* ---------------- GENERIC PREVIEW ---------------- */

const GenericFilePreview = React.forwardRef<HTMLDivElement, FilePreviewProps>(
  ({ file, onRemove }, ref) => {
    const Icon = getFileIcon(file)

    return (
      <TooltipProvider>
        <BaseCard ref={ref} onRemove={onRemove}>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center items-start">
              <Tooltip>
                <TooltipTrigger>
                  <span className="truncate text-sm font-medium">
                    {truncateFileName(file.name, 16)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{file.name}</TooltipContent>
              </Tooltip>
              <span className="truncate text-xs text-muted-foreground">
                {truncateFileName(file.type, 16) || "file"}
              </span>
            </div>
          </div>
        </BaseCard>
      </TooltipProvider>
    )
  }
)
GenericFilePreview.displayName = "GenericFilePreview"

/* ---------------- MAIN SWITCH ---------------- */

export const FilePreview = React.forwardRef<HTMLDivElement, FilePreviewProps>(
  (props, ref) => {
    if (props.file.type.startsWith("image/"))
      return <ImageFilePreview {...props} ref={ref} />

    if (
      props.file.type.startsWith("text/") ||
      props.file.name.endsWith(".txt") ||
      props.file.name.endsWith(".md")
    )
      return <TextFilePreview {...props} ref={ref} />

    return <GenericFilePreview {...props} ref={ref} />
  }
)

FilePreview.displayName = "FilePreview"
