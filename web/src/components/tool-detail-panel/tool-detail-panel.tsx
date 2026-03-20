import React from "react";
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

const PANEL_WIDTH = 380;

type StatusConfig = {
  label: () => string;
  Icon: React.ElementType;
  pill: string;
  accent: string;
};

function getStatusConfig(state: string): StatusConfig {
  switch (state) {
    case "output-available":
      return {
        label: td_success,
        Icon: Check,
        pill: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        accent: "bg-emerald-500",
      };
    case "output-error":
      return {
        label: td_error,
        Icon: X,
        pill: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
        accent: "bg-red-500",
      };
    case "output-denied":
      return {
        label: td_denied,
        Icon: Ban,
        pill: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        accent: "bg-amber-500",
      };
    default:
      return {
        label: td_running,
        Icon: Loader2,
        pill: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        accent: "bg-blue-500",
      };
  }
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border/60" />
      <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.15em]">
        {title}
      </span>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            Input parameters view                            */
/* -------------------------------------------------------------------------- */

function InputSection({ input }: { input: unknown }) {
  if (!input || (typeof input === "object" && Object.keys(input as object).length === 0)) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionDivider title={td_input()} />
      <div className="rounded-lg border bg-muted/20 divide-y divide-border/50 overflow-hidden">
        {typeof input === "object" ? (
          Object.entries(input as Record<string, unknown>).map(([key, value]) => (
            <div key={key} className="flex flex-col gap-0.5 px-3 py-2.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                {key}
              </span>
              <span className="text-sm text-foreground break-words font-mono leading-relaxed">
                {typeof value === "string" ? value : JSON.stringify(value)}
              </span>
            </div>
          ))
        ) : (
          <pre className="text-xs p-3 whitespace-pre-wrap break-words font-mono">
            {JSON.stringify(input, null, 2)}
          </pre>
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
  const cfg = getStatusConfig(tool.state);
  const StatusIcon = cfg.Icon;
  const isRunning = tool.state !== "output-available" && tool.state !== "output-error" && tool.state !== "output-denied";

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0.6 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 38 }}
      style={{ width: PANEL_WIDTH }}
      className="flex h-full flex-col bg-background border-l"
    >
      {/* Status accent bar */}
      <div className={cn("h-[3px] w-full shrink-0", cfg.accent)} />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b bg-muted/15">
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            {td_title()}
          </span>
          <span className="text-sm font-semibold text-foreground truncate">
            {tool.toolName}
          </span>
        </div>

        {/* Status pill */}
        <div
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium shrink-0",
            cfg.pill,
          )}
        >
          <StatusIcon className={cn("h-3 w-3", isRunning && "animate-spin")} />
          {cfg.label()}
        </div>

        {/* Close */}
        <button
          onClick={close}
          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-5 flex flex-col gap-6">
        {/* Input parameters */}
        <InputSection input={tool.input} />

        {/* Output */}
        <div className="flex flex-col gap-3">
          <SectionDivider title={td_output()} />
          {tool.output ? (
            <ToolOutputRenderer toolName={tool.toolName} output={tool.output} />
          ) : (
            <p className="text-sm text-muted-foreground italic px-1">{td_no_output()}</p>
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
    <AnimatePresence>
      {isOpen && selectedTool && (
        <motion.div
          key="panel-outer"
          initial={{ width: 0 }}
          animate={{ width: PANEL_WIDTH }}
          exit={{ width: 0 }}
          transition={{ type: "tween", duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="overflow-hidden shrink-0 h-full"
        >
          <AnimatePresence mode="wait">
            <ToolDetailContent key={selectedTool.toolCallId} tool={selectedTool} />
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
