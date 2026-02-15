import { useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
// import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";

type Props = {
  credentialId: string;
  source: SourceConfig;
};

type Entry = {
  id: string;
  name: string;
  url: string;
  path: string;
  ext: string;
  updatedAt: string;
  size?: number; // assumed MB
};

export function StorageFileTree({ credentialId, source }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useQuery({
    queryKey: ["file-tree", source.id, credentialId],
    queryFn: () => {
      if (!source.getFileTree)
        throw new Error("Source does not support file listing");
      return source.getFileTree(credentialId);
    },
    enabled: !!credentialId && !!source.getFileTree,
  });

  const entries: Entry[] = data?.entries ?? [];

  const { data: usage } = useBillingUsage();

  const storageUsed = usage?.storage?.used ?? 0;
  const storageLimit = usage?.storage?.limit ?? 1;

  /* ---------------- ICON SELECTOR ---------------- */

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
      xls: FileSpreadsheet,
      xlsx: FileSpreadsheet,
      png: FileImage,
      jpg: FileImage,
      jpeg: FileImage,
      gif: FileImage,
      mp3: FileAudio,
      mp4: FileVideo,
      js: FileCode,
      ts: FileCode,
      json: FileCode,
    };

    const Icon = map[ext?.toLowerCase()] ?? File;
    return <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />;
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
    if (selected.size === entries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(entries.map((e) => e.id)));
    }
  }

  /* ---------------- COMPUTED DATA ---------------- */

  const selectedFiles = useMemo(
    () => entries.filter((e) => selected.has(e.id)),
    [entries, selected]
  );

  const selectedSize = selectedFiles.reduce(
    (sum, f) => sum + (f.size ?? 0),
    0
  );

  const projectedStorage = storageUsed + selectedSize;
  const remainingStorage = storageLimit - projectedStorage;
  const usagePercent = Math.min(
    (projectedStorage / storageLimit) * 100,
    100
  );

  /* ---------------- HELPERS ---------------- */

  function formatMB(n: number) {
    return `${n.toFixed(2)} MB`;
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString();
  }

  /* ---------------- UI ---------------- */

  return (
    <div className="border rounded-md w-full">
      <div className="p-4 space-y-2">
        <h4 className="text-sm font-medium">{source.name}</h4>
        <p className="text-xs text-muted-foreground">
          Select files to embed and track storage usage.
        </p>
      </div>

      <Separator />

      {/* HEADER SELECT ALL */}
      <div className="flex items-center gap-2 px-4 py-2">
        <Checkbox
          checked={selected.size === entries.length && entries.length > 0}
          onCheckedChange={toggleAll}
          className="cursor-pointer"
        />
        <span className="text-xs text-muted-foreground">
          Select all files
        </span>
      </div>

      {/* FILE LIST */}
      <ScrollArea className="h-72 px-2">
        <div className="space-y-1 p-2">
          {isLoading && (
            <p className="text-xs text-muted-foreground">
              Loading files…
            </p>
          )}

          {error && (
            <p className="text-xs text-destructive">
              Failed to load files
            </p>
          )}

          {!isLoading &&
            entries.map((file) => {
              const checked = selected.has(file.id);

              return (
                <div
                  key={file.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs transition hover:bg-muted/40",
                    checked && "bg-muted"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(file.id)}
                      className="cursor-pointer"
                    />

                    {getIcon(file.ext)}

                    <div className="flex flex-col min-w-0">
                      <a
                        href={file.url}
                        target="_blank"
                        className="flex items-center gap-1 truncate hover:underline"
                      >
                        {file.name}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>

                      <span className="text-muted-foreground">
                        Updated {formatDate(file.updatedAt)}
                      </span>
                    </div>
                  </div>

                  <span className="text-muted-foreground shrink-0">
                    {file.size ? formatMB(file.size) : "—"}
                  </span>
                </div>
              );
            })}
        </div>
      </ScrollArea>

      <Separator />

      {/* FOOTER SUMMARY */}
      <div className="p-4 space-y-3 text-xs">
        <div className="flex justify-between">
          <span>
            Selected: {selectedFiles.length} files
          </span>

          <span>
            {formatMB(selectedSize)}
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-muted-foreground">
            <span>Storage after import</span>
            <span>
              {formatMB(projectedStorage)} / {formatMB(storageLimit)}
            </span>
          </div>

          {/*<Progress value={usagePercent} />*/}
        </div>

        <div
          className={cn(
            "text-right",
            remainingStorage < 0
              ? "text-destructive"
              : "text-muted-foreground"
          )}
        >
          Remaining: {formatMB(Math.max(remainingStorage, 0))}
        </div>
      </div>
    </div>
  );
}
