import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useBillingUsage } from "@/lib/admin";
import { useMe } from "@/lib/user";
import { cn } from "@/lib/utils";
import type { SourceConfig } from "@/lib/available-sources";
import {
  Folder,
  File,
  FileText,
  FileArchive,
  FileSpreadsheet,
  FileImage,
  FileCode,
  FileAudio,
  FileVideo,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Inbox
} from "lucide-react";
import {
  "components.file_tree.disclaimer_title" as components_file_tree_disclaimer_title,
  "components.file_tree.disclaimer_title_description" as components_file_tree_disclaimer_description,
  "components.file_tree.header_description" as components_file_tree_header_description,
  "components.file_tree.root" as components_file_tree_root,
  "components.file_tree.select_all" as components_file_tree_select_all,
  "components.file_tree.empty_title" as components_file_tree_empty_title,
  "components.file_tree.empty_description" as components_file_tree_empty_description,
  "components.file_tree.updated" as components_file_tree_updated,
  "components.file_tree.selected" as components_file_tree_selected,
  "components.file_tree.remaining" as components_file_tree_remaining,
  "components.file_tree.storage_exceeded" as components_file_tree_storage_exceeded,
  "components.file_tree.reduce_selection" as components_file_tree_reduce_selection,
  "components.file_tree.toast_loading_title" as components_file_tree_toast_loading_title,
  "components.file_tree.toast_loading_description" as components_file_tree_toast_loading_description,
  "components.file_tree.toast_success_title" as components_file_tree_toast_success_title,
  "components.file_tree.toast_success_ok" as components_file_tree_toast_success_ok,
  "components.file_tree.toast_success_unmodified" as components_file_tree_toast_success_unmodified,
  "components.file_tree.toast_success_failed" as components_file_tree_toast_success_failed,
  "components.file_tree.toast_error_title" as components_file_tree_toast_error_title,
  "components.file_tree.toast_error_all_failed" as components_file_tree_toast_error_all_failed,
  "components.file_tree.unsupported_extension" as components_file_tree_unsupported_extension,
  "common.cancel" as common_cancel,
  "common.confirm" as common_confirm
} from "@/paraglide/messages.js";
import { infoToast } from "../info-toast/info-toast";
import { extractErrorText } from "@/lib/error";
import { AsyncConfirmButton } from "../async-confirm-button/async-confirm-button";
import { useDeleteFiles } from "@/lib/file";

/* =========================
   TYPES
========================= */

type Props = {
  credentialId: string;
  source: SourceConfig;
};

type Entry = {
  id: string;
  name: string;
  url: string;
  ext: string;
  updatedAt: string;
  size?: number;
  nexataId?: string | null | undefined;
};

type Crumb = { id: string; name: string };

/* =========================
   SUPPORTED EXTENSIONS
========================= */

const SUPPORTED_EXTENSIONS = new Set([
  "md", "txt", "csv", "tsv", "html", "htm", "xml", "yaml", "yml",
  "json", "pdf", "xlsx", "xls", "docx", "doc", "rtf", "odt", "ods",
  "odp", "pptx", "ppt", "png", "jpg", "jpeg", "gif", "webp", "svg",
  "py", "rs", "go", "rb", "java", "kt", "swift", "c", "cpp", "h",
  "hpp", "cs", "ts", "js", "tsx", "jsx", "vue", "svelte", "sql",
  "sh", "bash", "zsh", "ps1", "toml", "ini", "cfg", "env", "log",
  "css", "scss", "less", "graphql",
]);

function isExtSupported(ext: string): boolean {
  if (ext === "dir") return true;
  return SUPPORTED_EXTENSIONS.has(ext?.toLowerCase());
}

/* =========================
   SKELETON
========================= */

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between px-3 py-2 min-h-11.5">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* checkbox */}
        <div className="h-4.5 w-4.5 rounded border bg-muted animate-pulse shrink-0" />
        {/* icon */}
        <div className="h-4.5 w-4.5 rounded bg-muted animate-pulse shrink-0" />
        {/* text block */}
        <div className="flex flex-col justify-center gap-1 min-w-0 flex-1">
          <div className="h-3 w-40 bg-muted rounded animate-pulse" />
          <div className="h-2.5 w-26 bg-muted/70 rounded animate-pulse" />
        </div>
      </div>
      {/* size */}
      <div className="h-3 w-12 bg-muted rounded animate-pulse shrink-0" />
    </div>
  );
}

/* =========================
   COMPONENT
========================= */

export function StorageFileTree({ credentialId, source }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Crumb[]>([{ id: "root", name: components_file_tree_root() }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [ingestedMap, setIngestedMap] = useState<Map<string, string>>(new Map());
  const [selectedForIngest, setSelectedForIngest] = useState<Map<string, Entry>>(new Map());
  const [markedForDelete, setMarkedForDelete] = useState<Map<string, string>>(new Map());

  const current = history[historyIndex];

  const deleteMutation = useDeleteFiles();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { data: usage } = useBillingUsage(me?.isAdmin);
  const storageUsed = usage?.storage?.used ?? 0;
  const storageLimit = usage?.storage?.limit ?? Infinity;

  /* FETCH */
  async function fetchDir(folderId?: string) {
    if (!folderId || !source.getFileTree || !credentialId) return;

    setLoading(true);

    try {
      let cursor: string | null = null;
      let all: Entry[] = [];

      do {
        const input = cursor
          ? { pageToken: cursor }
          : folderId === "root" ? {} : { path: folderId };
        const res = await source.getFileTree(credentialId, input as any);

        all = [...all, ...(res.entries ?? [])];
        cursor = res.cursor ?? null;
      } while (cursor);

      setEntries(all);

      setIngestedMap(prev => {
        const merged = new Map(prev);
        for (const entry of all) {
          if (entry.nexataId) merged.set(entry.id, entry.nexataId);
        }
        return merged;
      });

      setSelectedForIngest(prev => {
        const ingestedIds = new Set(all.filter(e => e.nexataId).map(e => e.id));
        const hasOverlap = [...ingestedIds].some(id => prev.has(id));
        if (!hasOverlap) return prev;
        const next = new Map(prev);
        for (const id of ingestedIds) next.delete(id);
        return next;
      });

    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDir(current?.id);
  }, [current?.id]);

  /* NAVIGATION */
  function enterFolder(entry: Entry) {
    const next = history.slice(0, historyIndex + 1);
    next.push({ id: entry.id, name: entry.name });

    setHistory(next);
    setHistoryIndex(next.length - 1);
  }

  const goBack = () => historyIndex > 0 && setHistoryIndex(historyIndex - 1);
  const goForward = () => historyIndex < history.length - 1 && setHistoryIndex(historyIndex + 1);
  const jumpTo = (i: number) => setHistoryIndex(i);

  /* ICON */
  function getIcon(ext: string) {
    const map: Record<string, any> = {
      dir: Folder,
      pdf: FileText,
      doc: FileText,
      docx: FileText,
      txt: FileText,
      rar: FileArchive,
      zip: FileArchive,
      csv: FileSpreadsheet,
      png: FileImage,
      jpg: FileImage,
      mp3: FileAudio,
      mp4: FileVideo,
      js: FileCode,
      ts: FileCode,
      json: FileCode,
    };

    const Icon = map[ext?.toLowerCase()] ?? File;
    const isDir = ext?.toLowerCase() === "dir";

    return (
      <Icon className={cn(
        "h-3.5 w-3.5 shrink-0",
        isDir
          ? "text-yellow-400 fill-yellow-400"
          : "text-muted-foreground group-hover:text-foreground"
      )} />
    );
  }

  /* SELECTION */
  function toggle(file: Entry) {
    if (!isExtSupported(file.ext)) return;

    if (ingestedMap.has(file.id)) {
      setMarkedForDelete(prev => {
        const next = new Map(prev);
        markedForDelete.has(file.id)
          ? next.delete(file.id)
          : next.set(file.id, ingestedMap.get(file.id)!);
        return next;
      });
      return;
    }

    setSelectedForIngest(prev => {
      const next = new Map(prev);
      next.has(file.id) ? next.delete(file.id) : next.set(file.id, file);
      return next;
    });
  }

  function toggleAll() {
    const supportedEntries = entries.filter(file => isExtSupported(file.ext));
    if (supportedEntries.length === 0) return;

    const allVisibleSelected = supportedEntries.every(file =>
      ingestedMap.has(file.id)
        ? !markedForDelete.has(file.id)
        : selectedForIngest.has(file.id)
    );

    const nextSelectedForIngest = new Map(selectedForIngest);
    const nextMarkedForDelete = new Map(markedForDelete);

    if (allVisibleSelected) {
      for (const file of supportedEntries) {
        if (ingestedMap.has(file.id)) {
          nextMarkedForDelete.set(file.id, ingestedMap.get(file.id)!);
        } else {
          nextSelectedForIngest.delete(file.id);
        }
      }
    } else {
      for (const file of supportedEntries) {
        if (ingestedMap.has(file.id)) {
          nextMarkedForDelete.delete(file.id);
        } else {
          nextSelectedForIngest.set(file.id, file);
        }
      }
    }

    setSelectedForIngest(nextSelectedForIngest);
    setMarkedForDelete(nextMarkedForDelete);
  }

  /* STORAGE */
  const pendingIngestCount = selectedForIngest.size;
  const pendingIngestSize = useMemo(
    () => Array.from(selectedForIngest.values()).reduce((s, f) => s + (f.size ?? 0), 0),
    [selectedForIngest]
  );
  const remaining = storageLimit - (storageUsed + pendingIngestSize);

  const formatMB = (n: number) => `${n.toFixed(2)} MB`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString();

  /* SAVE SELECTION */
  async function handleConfirm() {
    if (!source.ingest) return;

    const toIngestIds = Array.from(selectedForIngest.keys());
    const toDeleteIds = Array.from(markedForDelete.values());

    if (toIngestIds.length === 0 && toDeleteIds.length === 0) return;

    const toastId = infoToast.loading({
      title: components_file_tree_toast_loading_title(),
      description: components_file_tree_toast_loading_description({
        count: toIngestIds.length,
      }),
    });

    try {
      const [ingestResult] = await Promise.all([
        toIngestIds.length > 0
          ? source.ingest({
              credentialId,
              selection: toIngestIds.map(id => {
                const file = entries.find(e => e.id === id);
                return { id, isDir: file?.ext === "dir"};
              }),
            })
          : Promise.resolve(undefined),

        toDeleteIds.length > 0
          ? deleteMutation.mutateAsync({ ids: toDeleteIds })
          : Promise.resolve(),
      ]);

      if (ingestResult) {
        const { ok, unmodified, failed } = ingestResult;

        if (ok === 0 && failed > 0) {
          // All files failed
          infoToast.error(toastId, {
            title: components_file_tree_toast_error_title(),
            description: components_file_tree_toast_error_all_failed({ count: failed }),
          });
        } else {
          // Full or partial success
          const parts: string[] = [components_file_tree_toast_success_ok({ count: ok })];
          if (unmodified > 0) parts.push(components_file_tree_toast_success_unmodified({ count: unmodified }));
          if (failed > 0) parts.push(components_file_tree_toast_success_failed({ count: failed }));

          infoToast.success(toastId, {
            title: components_file_tree_toast_success_title(),
            description: parts.join(" · "),
          });
        }
      } else {
        // Only deletions were performed
        infoToast.success(toastId, {
          title: components_file_tree_toast_success_title(),
        });
      }

      setSelectedForIngest(new Map());
      setMarkedForDelete(new Map());

      await fetchDir(current?.id);
      await queryClient.invalidateQueries({ queryKey: ["platform-files"] });

    } catch (err) {
      console.error(err);

      infoToast.error(toastId, {
        title: components_file_tree_toast_error_title(),
        description: extractErrorText(err) ?? components_file_tree_toast_error_all_failed({ count: toIngestIds.length }),
      });
    }
  }

  /* UI */
  return (
    <div className="pt-4 border-t space-y-3">
      {/* HEADER */}
      <div>
        <h4 className="text-sm font-medium">{source.name}</h4>
        <p className="text-xs text-muted-foreground">
          {components_file_tree_header_description()}
        </p>
      </div>

      {/* EXPLORER */}
      <div className="border rounded-md overflow-hidden">

        {/* NAV HEADER */}
        <div className="flex items-center justify-between px-3 h-11 bg-muted border-b gap-2">
          {/* Flechas + breadcrumb */}
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={goBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={goForward}>
              <ChevronRight className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1 text-[11px] overflow-x-auto scrollbar-none">
              {history.map((crumb, i) => (
                <div key={crumb.id} className="flex items-center gap-1 shrink-0">
                  {i > 0 && <span className="text-muted-foreground">/</span>}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => jumpTo(i)}
                    className={cn(
                      "px-1 text-[11px]",
                      i === historyIndex ? "font-medium text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {crumb.name}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Select all */}
          <div className="flex items-center gap-2 text-[11px] shrink-0">
            <Checkbox
              checked={
                entries.filter(file => isExtSupported(file.ext)).length > 0 &&
                entries.filter(file => isExtSupported(file.ext)).every(file =>
                  ingestedMap.has(file.id)
                    ? !markedForDelete.has(file.id)
                    : selectedForIngest.has(file.id)
                )
              }
              onCheckedChange={toggleAll}
            />
            <span className="text-muted-foreground hidden sm:inline">{components_file_tree_select_all()}</span>
          </div>
        </div>

        <Separator />

        {/* FILE LIST */}
        <ScrollArea className="h-72">
          {loading &&
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>
                <SkeletonRow />
                {i !== 7 && <Separator />}
              </div>
            ))}

          {/* EMPTY STATE */}
          {!loading && entries.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full py-10 text-center text-muted-foreground gap-3">

              <Inbox className="h-8 w-8 opacity-60" />

              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  {components_file_tree_empty_title()}
                </p>
                <p className="text-xs">
                  {components_file_tree_empty_description()}
                </p>
              </div>

            </div>
          )}

          {!loading &&
            entries.map((file, i) => {
              const isDir = file.ext === "dir";
              const unsupported = !isExtSupported(file.ext);

              return (
                <div key={file.id}>
                  <div
                    className={cn(
                      "group flex items-center justify-between px-3 py-1.5 text-[11px] hover:bg-muted/40",
                      isDir && "cursor-pointer",
                      unsupported && "opacity-50"
                    )}
                    onDoubleClick={() => isDir && enterFolder(file)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                      {unsupported ? (
                        <Tooltip>
                          <TooltipTrigger
                            className="flex items-center"
                            onClick={e => e.preventDefault()}
                          >
                            <Checkbox disabled checked={false} />
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            {components_file_tree_unsupported_extension()}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Checkbox
                          checked={ingestedMap.has(file.id) ? !markedForDelete.has(file.id) : selectedForIngest.has(file.id)}
                          onCheckedChange={() => toggle(file)}
                        />
                      )}

                      {getIcon(file.ext)}

                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="truncate text-foreground">{file.name}</span>
                          <a
                            href={file.url}
                            target="_blank"
                            onClick={e => e.stopPropagation()}
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>

                        <span className="text-muted-foreground">
                          {components_file_tree_updated()} {formatDate(file.updatedAt)}
                        </span>
                      </div>
                    </div>

                    <span className="text-muted-foreground">
                      {file.size ? formatMB(file.size) : "—"}
                    </span>
                  </div>

                  {i !== entries.length - 1 && <Separator />}
                </div>
              );
            })}
        </ScrollArea>

        <Separator />

        {/* FOOTER */}
        <div className="flex flex-col gap-2 px-3 py-2 bg-muted text-[11px] sm:flex-row sm:items-center sm:justify-between">
          {/* Stats row */}
          <div className="flex items-center gap-3 text-muted-foreground flex-wrap">
            <span>
              <span className="font-medium text-foreground">
                {pendingIngestCount}
              </span>{" "}
              {components_file_tree_selected()}
            </span>

            <Separator orientation="vertical" className="hidden sm:block" />

            <span>{formatMB(pendingIngestSize)}</span>

            <Separator orientation="vertical" className="hidden sm:block" />

            <span className={cn(remaining < 0 && "text-destructive font-medium")}>
              {formatMB(Math.max(remaining, 0))} {components_file_tree_remaining()}
            </span>
            {remaining < 0 && (
              <span className="text-destructive text-xs font-medium">
                {components_file_tree_storage_exceeded()}
              </span>
            )}
          </div>

          {/* Actions row */}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setSelectedForIngest(new Map());
                setMarkedForDelete(new Map());
              }}
              disabled={selectedForIngest.size === 0 && markedForDelete.size === 0}
            >
              {common_cancel()}
            </Button>

            <div className="flex flex-col items-end">
              <AsyncConfirmButton
                size="sm"
                onClick={handleConfirm}
                disabled={(selectedForIngest.size === 0 && markedForDelete.size === 0) || remaining < 0}
              >
                {common_confirm()}
              </AsyncConfirmButton>

              {remaining < 0 && (
                <span className="text-[10px] text-destructive mt-1">
                  {components_file_tree_reduce_selection()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* DISCLAIMER — storage approximation */}
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg border px-3 py-2 w-full",
          "border-amber-500/30 bg-amber-500/10",
          "text-amber-700 dark:text-amber-300",
          "text-xs leading-relaxed"
        )}
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 opacity-90" />

        <div className="space-y-1">
          <p>
            <span className="font-medium">
              {components_file_tree_disclaimer_title()}
            </span>
            <br></br>
            {components_file_tree_disclaimer_description()}
          </p>
        </div>
      </div>
    </div>
  );
}
