import { useState } from "react";
import { Check, Copy, Globe, Link } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  "chat.share_modal.title" as chat_share_modal_title,
  "chat.share_modal.description" as chat_share_modal_description,
  "chat.share_modal.public_label" as chat_share_modal_public_label,
  "chat.share_modal.clipboard_label" as chat_share_modal_clipboard_label,
  "chat.share_modal.link_label" as chat_share_modal_link_label,
  "chat.share_modal.copy_link" as chat_share_modal_copy_link,
  "chat.share_modal.link_copied" as chat_share_modal_link_copied,
  "chat.share_modal.done" as chat_share_modal_done,
} from "@/paraglide/messages.js";

interface ShareSuccessModalProps {
  open: boolean;
  onClose: () => void;
  shareUrl: string;
}

export function ShareSuccessModal({ open, onClose, shareUrl }: ShareSuccessModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="items-center text-center">
          {/* Animated success icon */}
          <div className="mb-3 flex items-center justify-center">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60">
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 20, delay: 0.05 }}
              >
                <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
              </motion.div>
              <motion.div
                className="absolute inset-0 rounded-full ring-2 ring-emerald-500/30"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.35, delay: 0.1 }}
              />
            </div>
          </div>

          <DialogTitle className="text-lg font-semibold">
            {chat_share_modal_title()}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {chat_share_modal_description()}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex flex-col gap-2.5">
          {/* Status badges */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.22 }}
            className="flex flex-col gap-1.5"
          >
            <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/25 bg-emerald-50 px-3 py-2 dark:bg-emerald-950/30">
              <Globe className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {chat_share_modal_public_label()}
              </span>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border border-blue-500/25 bg-blue-50 px-3 py-2 dark:bg-blue-950/30">
              <Check className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {chat_share_modal_clipboard_label()}
              </span>
            </div>
          </motion.div>

          {/* Link field */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.22 }}
            className="flex flex-col gap-1.5"
          >
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Link className="h-3.5 w-3.5" />
              {chat_share_modal_link_label()}
            </span>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 rounded-lg border border-border bg-muted/50 px-3 py-1.5">
                <p className="truncate text-xs text-muted-foreground font-mono select-all">
                  {shareUrl}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5 h-8"
                onClick={handleCopy}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {copied ? (
                    <motion.span
                      key="check"
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      transition={{ duration: 0.14 }}
                      className="flex items-center gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-xs">{chat_share_modal_link_copied()}</span>
                    </motion.span>
                  ) : (
                    <motion.span
                      key="copy"
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      transition={{ duration: 0.14 }}
                      className="flex items-center gap-1.5"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span className="text-xs">{chat_share_modal_copy_link()}</span>
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </div>
          </motion.div>

          {/* Done button */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.22 }}
          >
            <Button
              type="button"
              className="w-full mt-1"
              onClick={onClose}
            >
              {chat_share_modal_done()}
            </Button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
