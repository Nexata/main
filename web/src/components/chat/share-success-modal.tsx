import { useState } from "react";
import { Check, Copy, Globe, Link } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getLocale } from "@/paraglide/runtime";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ShareSuccessModalProps = {
  open: boolean;
  onClose: () => void;
  shareUrl: string;
};

function getShareModalCopy() {
  if (getLocale() === "en") {
    return {
      title: "Chat shared",
      description: "The thread is now public and the share URL was copied to your clipboard.",
      publicLabel: "Thread is now public",
      clipboardLabel: "URL copied to clipboard",
      linkLabel: "Share URL",
      copyLink: "Copy URL",
      linkCopied: "Copied",
      done: "Done",
    };
  }

  return {
    title: "Chat compartido",
    description: "El thread ahora es público y la URL para compartir se copió al portapapeles.",
    publicLabel: "El thread ahora es público",
    clipboardLabel: "URL copiada al portapapeles",
    linkLabel: "URL para compartir",
    copyLink: "Copiar URL",
    linkCopied: "Copiada",
    done: "Listo",
  };
}

export function ShareSuccessModal({ open, onClose, shareUrl }: ShareSuccessModalProps) {
  const [copied, setCopied] = useState(false);
  const copy = getShareModalCopy();

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
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
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
            {copy.title}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {copy.description}
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
                {copy.publicLabel}
              </span>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border border-blue-500/25 bg-blue-50 px-3 py-2 dark:bg-blue-950/30">
              <Check className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {copy.clipboardLabel}
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
              {copy.linkLabel}
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
                      <span className="text-xs">{copy.linkCopied}</span>
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
                      <span className="text-xs">{copy.copyLink}</span>
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
              {copy.done}
            </Button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
