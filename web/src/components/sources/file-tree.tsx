import { useEffect, useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useBillingUsage } from "@/lib/admin";
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
  "components.file_tree.toast_success_description" as components_file_tree_toast_success_description,
  "components.file_tree.toast_error_title" as components_file_tree_toast_error_title,
  "components.file_tree.toast_error_description" as components_file_tree_toast_error_description,
  "common.cancel" as common_cancel,
  "common.confirm" as common_confirm
} from "@/paraglide/messages.js";
import { infoToast } from "../info-toast/info-toast";
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
  const [initialIngested, setInitialIngested] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Crumb[]>([{ id: "root", name: components_file_tree_root() }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const current = history[historyIndex];

  const deleteMutation = useDeleteFiles();
  const { data: usage } = useBillingUsage();
  const storageUsed = usage?.storage?.used ?? 0;
  const storageLimit = usage?.storage?.limit ?? 1;

  /* FETCH */
  async function fetchDir(folderId?: string) {
    if (!folderId) return;
    if (!source.getFileTree || !credentialId) return;

    setLoading(true);

    try {
      let cursor: string | null = null;
      let all: Entry[] = [];

      do {
        const input = cursor ? { pageToken: cursor } : folderId === "root" ? {} : { path: folderId };
        const res = await source.getFileTree(credentialId, input as any);

        all = [...all, ...(res.entries ?? [])];
        cursor = res.cursor ?? null;
      } while (cursor);

      setEntries(all);

      const initiallySelected = new Set(all.filter(e => e.nexataId).map(e => e.id));
      setSelected(initiallySelected);
      setInitialIngested(initiallySelected);
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

    return (<Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />);
  }

  /* SELECTION */
  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    selected.size === entries.length
      ? setSelected(new Set())
      : setSelected(new Set(entries.map(e => e.id)));
  }

  /* STORAGE */
  const selectedFiles = useMemo(
    () => entries.filter(e => selected.has(e.id)),
    [entries, selected]
  );

  const selectedSize = selectedFiles.reduce((s, f) => s + (f.size ?? 0), 0);
  const remaining = storageLimit - (storageUsed + selectedSize);

  const formatMB = (n: number) => `${n.toFixed(2)} MB`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString();

  /* SAVE SELECTION */
  async function handleConfirm() {
    if (!source.ingest) return;

    const currentlySelected = new Set(selected);

    const toIngest = entries.filter(e => currentlySelected.has(e.id) && !initialIngested.has(e.id));
    const toDelete = entries.filter(e => initialIngested.has(e.id) && !currentlySelected.has(e.id));

    if (toIngest.length === 0 && toDelete.length === 0) return;

    const toastId = infoToast.loading({
      title: components_file_tree_toast_loading_title(),
      description: components_file_tree_toast_loading_description({count: toIngest.length}),
    });

    try {
      if (toIngest.length > 0) {
        await source.ingest({
          credentialId,
          selection: toIngest.map(file => ({
            id: file.id,
            isDir: file.ext === "dir",
          })),
        });
      }

      if (toDelete.length > 0) {
        await deleteMutation.mutateAsync({
          ids: toDelete
            .map(f => f.nexataId)
            .filter((id): id is string => !!id),
        });
      }

      infoToast.success(toastId, {
        title: components_file_tree_toast_success_title(),
        description: components_file_tree_toast_success_description(),
      });

      setSelected(new Set());
      fetchDir(current?.id);
    } catch (err) {
      console.error(err);

      infoToast.error(toastId, {
        title: components_file_tree_toast_error_title(),
        description: components_file_tree_toast_error_description(),
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
        <div className="flex items-center justify-between px-3 h-11 bg-muted border-b">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={goBack}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={goForward}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1 text-[11px] truncate">
              {history.map((crumb, i) => (
                <div key={crumb.id} className="flex items-center gap-1">
                  {i > 0 && <span>/</span>}
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

          <div className="flex items-center gap-2 text-[11px]">
            <Checkbox
              checked={selected.size === entries.length && entries.length > 0}
              onCheckedChange={toggleAll}
            />
            <span className="text-muted-foreground">{components_file_tree_select_all()}</span>
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

              return (
                <div key={file.id}>
                  <div
                    className={cn(
                      "group flex items-center justify-between px-3 py-1.5 text-[11px] hover:bg-muted/40",
                      isDir && "cursor-pointer"
                    )}
                    onDoubleClick={() => isDir && enterFolder(file)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Checkbox
                        checked={selected.has(file.id)}
                        onCheckedChange={() => toggle(file.id)}
                      />

                      {getIcon(file.ext)}

                      <div className="flex flex-col min-w-0">
                        <Button variant="link" className="p-0 h-auto justify-start text-foreground">
                          <a
                            href={file.url}
                            target="_blank"
                            onClick={e => e.stopPropagation()}
                            className="truncate flex gap-1"
                          >
                            {file.name}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>

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
        <div className="flex items-center justify-between px-3 py-2 bg-muted text-[11px]">
          <div className="flex items-center gap-3 text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">
                {selectedFiles.length}
              </span>{" "}
              {components_file_tree_selected()}
            </span>

            <Separator orientation="vertical" />

            <span>{formatMB(selectedSize)}</span>

            <Separator orientation="vertical" />

            <span className={cn(remaining < 0 && "text-destructive font-medium")}>
              {formatMB(Math.max(remaining, 0))} {components_file_tree_remaining()}
            </span>
            {remaining < 0 && (
              <span className="text-destructive text-xs font-medium">
                {components_file_tree_storage_exceeded()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setSelected(new Set())}
              disabled={selected.size === 0}
            >
              {common_cancel()}
            </Button>

            <div className="flex flex-col items-end">
              <AsyncConfirmButton
               	size="sm"
               	onClick={handleConfirm}
               	disabled={selected.size === 0 || remaining < 0}
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
