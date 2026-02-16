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
} from "@/paraglide/messages.js";

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
};

type Crumb = { id: string; name: string };

/* =========================
   SKELETON
========================= */

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between px-3 py-2 min-h-[46px]">

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

  const [history, setHistory] = useState<Crumb[]>([{ id: "root", name: "Root" }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ingesting, setIngesting] = useState(false);

  const current = history[historyIndex];

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

        const res = await source.getFileTree(
          credentialId,
          input as any
        );

        all = [...all, ...(res.entries ?? [])];
        cursor = res.cursor ?? null;
      } while (cursor);

      setEntries(all);
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

  const goBack = () =>
    historyIndex > 0 && setHistoryIndex(historyIndex - 1);

  const goForward = () =>
    historyIndex < history.length - 1 &&
    setHistoryIndex(historyIndex + 1);

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

    return (
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
    );
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

  const selectedSize = selectedFiles.reduce(
    (s, f) => s + (f.size ?? 0),
    0
  );

  const remaining = storageLimit - (storageUsed + selectedSize);

  const formatMB = (n: number) => `${n.toFixed(2)} MB`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString();

  async function handleConfirm() {
  	if (!source.ingest || selectedFiles.length === 0) return;

  	setIngesting(true);

  	try {
  		await source.ingest({
  			credentialId,
  			selection: selectedFiles.map(file => ({
  				id: file.id,
  				isDir: file.ext === "dir",
  			})),
  		});
  	} catch (err) {
  		console.error("Ingest failed:", err);
  	} finally {
  		setIngesting(false);
  	}
  }

  /* UI */

  return (
    <div className="pt-4 border-t space-y-3">
      {/* HEADER */}
      <div>
        <h4 className="text-sm font-medium">{source.name}</h4>
        <p className="text-xs text-muted-foreground">
          Select files to embed and track storage usage.
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
                      i === historyIndex
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
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
            <span className="text-muted-foreground">Select all</span>
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
                  This folder is empty
                </p>

                <p className="text-xs">
                  No files or folders found here.
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
                          Updated {formatDate(file.updatedAt)}
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
              selected
            </span>

            <Separator orientation="vertical" />

            <span>{formatMB(selectedSize)}</span>

            <Separator orientation="vertical" />

            <span className={cn(remaining < 0 && "text-destructive font-medium")}>
              {formatMB(Math.max(remaining, 0))} remaining
            </span>
            {remaining < 0 && (
              <span className="text-destructive text-xs font-medium">
                Storage limit exceeded
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
              Cancel
            </Button>

            <div className="flex flex-col items-end">
              <Button
               	size="sm"
               	onClick={handleConfirm}
               	disabled={selected.size === 0 || remaining < 0 ||
                		ingesting
               	}
              >
               	{ingesting ? "Processing…" : "Confirm"}
              </Button>

              {remaining < 0 && (
                <span className="text-[10px] text-destructive mt-1">
                  Reduce selection to continue
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* DISCLAIMER — storage approximation */}
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg border px-3 py-2 w-fit",
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
