import { useEffect, useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
  Loader2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

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

export function StorageFileTree({ credentialId, source }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);

  const [history, setHistory] = useState<Crumb[]>([
    { id: "root", name: "Root" },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const current = history[historyIndex];

  const { data: usage } = useBillingUsage();
  const storageUsed = usage?.storage?.used ?? 0;
  const storageLimit = usage?.storage?.limit ?? 1;

  /* ---------------- FETCH DIRECTORY ---------------- */

  async function fetchDir(path: string) {
    if (!source.getFileTree || !credentialId) return;

    setLoading(true);

    try {
      let cursor: string | null = null;
      let all: Entry[] = [];

      do {
        const res = await source.getFileTree(
          credentialId,
          cursor ? { pageToken: cursor } : { path }
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
    fetchDir(current.id);
  }, [current.id]);

  /* ---------------- NAVIGATION ---------------- */

  function enterFolder(entry: Entry) {
    const nextHistory = history.slice(0, historyIndex + 1);

    nextHistory.push({ id: entry.id, name: entry.name });

    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  }

  function goBack() {
    if (historyIndex > 0) setHistoryIndex(historyIndex - 1);
  }

  function goForward() {
    if (historyIndex < history.length - 1)
      setHistoryIndex(historyIndex + 1);
  }

  function jumpTo(index: number) {
    setHistoryIndex(index);
  }

  /* ---------------- ICONS ---------------- */

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
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
    );
  }

  /* ---------------- SELECTION ---------------- */

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === entries.length)
      setSelected(new Set());
    else
      setSelected(new Set(entries.map((e) => e.id)));
  }

  /* ---------------- STORAGE COMPUTE ---------------- */

  const selectedFiles = useMemo(
    () => entries.filter((e) => selected.has(e.id)),
    [entries, selected]
  );

  const selectedSize = selectedFiles.reduce(
    (s, f) => s + (f.size ?? 0),
    0
  );

  const remaining =
    storageLimit - (storageUsed + selectedSize);

  const formatMB = (n: number) => `${n.toFixed(2)} MB`;
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString();

  /* ---------------- UI ---------------- */

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
      <div className="border rounded-md">
        {/* NAV HEADER */}
        <div className="flex items-center justify-between px-3 py-2 text-xs">
          <div className="flex items-center gap-1 min-w-0">
            <button
              onClick={goBack}
              disabled={historyIndex === 0}
              className="opacity-70 hover:opacity-100 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              onClick={goForward}
              disabled={
                historyIndex === history.length - 1
              }
              className="opacity-70 hover:opacity-100 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1 truncate">
              {history.map((crumb, i) => (
                <div
                  key={crumb.id}
                  className="flex items-center gap-1"
                >
                  {i > 0 && <span>/</span>}
                  <button
                    onClick={() => jumpTo(i)}
                    className={cn(
                      "truncate hover:underline",
                      i === historyIndex &&
                        "font-medium"
                    )}
                  >
                    {crumb.name}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={
                selected.size === entries.length &&
                entries.length > 0
              }
              onCheckedChange={toggleAll}
            />
            <span className="text-muted-foreground">
              Select all
            </span>
          </div>
        </div>

        <Separator />

        {/* FILE LIST */}
        <ScrollArea className="h-72">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          )}

          {!loading &&
            entries.map((file, i) => (
              <div key={file.id}>
                <div
                  className="flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/40 cursor-pointer"
                  onDoubleClick={() =>
                    file.ext === "dir" &&
                    enterFolder(file)
                  }
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Checkbox
                      checked={selected.has(file.id)}
                      onCheckedChange={() =>
                        toggle(file.id)
                      }
                    />

                    {getIcon(file.ext)}

                    <div className="flex flex-col min-w-0">
                      <a
                        href={file.url}
                        target="_blank"
                        className="truncate hover:underline flex gap-1"
                        onClick={(e) =>
                          e.stopPropagation()
                        }
                      >
                        {file.name}
                        <ExternalLink className="h-3 w-3" />
                      </a>

                      <span className="text-muted-foreground">
                        Updated {formatDate(file.updatedAt)}
                      </span>
                    </div>
                  </div>

                  <span className="text-muted-foreground">
                    {file.size
                      ? formatMB(file.size)
                      : "—"}
                  </span>
                </div>

                {i !== entries.length - 1 && (
                  <Separator />
                )}
              </div>
            ))}
        </ScrollArea>
      </div>

      {/* FOOTER */}
      <div className="text-xs space-y-1">
        <div className="flex justify-between">
          <span>Selected files</span>
          <span>{selectedFiles.length}</span>
        </div>

        <div className="flex justify-between">
          <span>Total size</span>
          <span>{formatMB(selectedSize)}</span>
        </div>

        <div
          className={cn(
            "flex justify-between",
            remaining < 0
              ? "text-destructive"
              : "text-muted-foreground"
          )}
        >
          <span>Remaining storage</span>
          <span>
            {formatMB(Math.max(remaining, 0))}
          </span>
        </div>
      </div>
    </div>
  );
}
