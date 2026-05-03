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
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md overflow-hidden border border-border/70 bg-popover p-0 shadow-2xl ring-1 ring-foreground/10">
        <div className="px-5 pt-6 pb-5 sm:px-6">
          <DialogHeader className="items-center text-center">
            {/* Animated success icon */}
            <div className="mb-2 flex items-center justify-center">
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 320, damping: 20, delay: 0.05 }}
                >
                  <Check className="h-7 w-7 text-primary" strokeWidth={2.5} />
                </motion.div>
                <motion.div
                  className="absolute inset-0 rounded-2xl ring-2 ring-primary/20"
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.35, delay: 0.1 }}
                />
              </div>
            </div>

            <DialogTitle className="text-lg font-semibold text-foreground">
              {copy.title}
            </DialogTitle>
            <DialogDescription className="mx-auto max-w-sm text-sm leading-5 text-muted-foreground">
              {copy.description}
            </DialogDescription>
          </DialogHeader>

        <div className="mt-5 flex flex-col gap-3">
          {/* Status badges */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.22 }}
            className="grid gap-2 sm:grid-cols-2"
          >
            <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <Globe className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="min-w-0 text-sm font-medium leading-4 text-foreground">
                {copy.publicLabel}
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <Check className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="min-w-0 text-sm font-medium leading-4 text-foreground">
                {copy.clipboardLabel}
              </span>
            </div>
          </motion.div>

          {/* Link field */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.22 }}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3"
          >
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Link className="h-3.5 w-3.5" />
              {copy.linkLabel}
            </span>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2">
                <p className="truncate font-mono text-xs text-muted-foreground select-all">
                  {shareUrl}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 shrink-0 gap-1.5 sm:h-8"
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
              className="mt-1 w-full"
              onClick={onClose}
            >
              {copy.done}
            </Button>
          </motion.div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
