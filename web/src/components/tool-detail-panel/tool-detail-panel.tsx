import { X, Loader2, Check, Ban } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useToolDetailStore, type ToolDetailData } from "@/lib/tool-detail.store";
import { ToolOutputRenderer } from "./tool-renderers";
import { cn } from "@/lib/utils";
import {
  "chat.tool_detail.title" as td_title,
  "chat.tool_detail.input" as td_input,
  "chat.tool_detail.output" as td_output,
  "chat.tool_detail.status" as td_status,
  "chat.tool_detail.running" as td_running,
  "chat.tool_detail.success" as td_success,
  "chat.tool_detail.error" as td_error,
  "chat.tool_detail.denied" as td_denied,
  "chat.tool_detail.no_output" as td_no_output,
} from "@/paraglide/messages.js";

/* -------------------------------------------------------------------------- */
/*                             Status helpers                                  */
/* -------------------------------------------------------------------------- */

function getStatusInfo(state: string) {
  switch (state) {
    case "output-available":
      return {
        label: td_success(),
        icon: <Check className="h-3.5 w-3.5" />,
        className: "bg-green-500/10 text-green-600 border-green-500/20",
      };
    case "output-error":
      return {
        label: td_error(),
        icon: <X className="h-3.5 w-3.5" />,
        className: "bg-red-500/10 text-red-600 border-red-500/20",
      };
    case "output-denied":
      return {
        label: td_denied(),
        icon: <Ban className="h-3.5 w-3.5" />,
        className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
      };
    default:
      return {
        label: td_running(),
        icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
        className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      };
  }
}

/* -------------------------------------------------------------------------- */
/*                            Input parameters view                            */
/* -------------------------------------------------------------------------- */

function InputSection({ input }: { input: unknown }) {
  if (!input || (typeof input === "object" && Object.keys(input as object).length === 0)) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {td_input()}
      </h3>
      <div className="rounded-lg border bg-muted/30 p-3">
        {typeof input === "object" ? (
          <div className="flex flex-col gap-1.5">
            {Object.entries(input as Record<string, unknown>).map(([key, value]) => (
              <div key={key} className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-muted-foreground">{key}</span>
                <span className="text-sm text-foreground break-words">
                  {typeof value === "string" ? value : JSON.stringify(value)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(input, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Panel content                                  */
/* -------------------------------------------------------------------------- */

function ToolDetailContent({ tool }: { tool: ToolDetailData }) {
  const close = useToolDetailStore((s) => s.close);
  const status = getStatusInfo(tool.state);

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex h-full w-[380px] flex-col border-l bg-background"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-semibold truncate">{td_title()}</span>
          <span className="text-xs text-muted-foreground truncate">{tool.toolName}</span>
        </div>
        <button
          onClick={close}
          className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 flex flex-col gap-5">
        {/* Status badge */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {td_status()}
          </h3>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 self-start rounded-md border px-2.5 py-1 text-xs font-medium",
              status.className,
            )}
          >
            {status.icon}
            {status.label}
          </div>
        </div>

        {/* Input parameters */}
        <InputSection input={tool.input} />

        {/* Output */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {td_output()}
          </h3>
          {tool.output ? (
            <ToolOutputRenderer toolName={tool.toolName} output={tool.output} />
          ) : (
            <p className="text-sm text-muted-foreground italic">{td_no_output()}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Exported panel                                 */
/* -------------------------------------------------------------------------- */

export default function ToolDetailPanel() {
  const selectedTool = useToolDetailStore((s) => s.selectedTool);
  const isOpen = useToolDetailStore((s) => s.isOpen);

  return (
    <AnimatePresence mode="wait">
      {isOpen && selectedTool && (
        <ToolDetailContent key={selectedTool.toolCallId} tool={selectedTool} />
      )}
    </AnimatePresence>
  );
}
