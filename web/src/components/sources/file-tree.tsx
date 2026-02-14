import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import type { SourceConfig } from "@/lib/available-sources";

type Props = {
  credentialId: string;
  source: SourceConfig;
};

export function StorageFileTree({
  credentialId,
  source,
}: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["file-tree", source.id, credentialId],
    queryFn: () => {
      if (!source.getFileTree) throw new Error("Source does not support file listing");
      return source.getFileTree(credentialId);
    },
    enabled: !!credentialId && !!source.getFileTree,
  });

  return (
    <div className="border rounded-md w-full h-70">
      <ScrollArea className="h-full p-3 space-y-2">
        <p className="text-sm font-medium">
          {source.name}
        </p>

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

        {data && (
          <pre className="text-xs whitespace-pre-wrap">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </ScrollArea>
    </div>
  );
}
