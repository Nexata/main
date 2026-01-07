import { ScrollArea } from "@/components/ui/scroll-area"

type Props = {
  credentialId: string
  sourceName: string
}

export function StorageFileTree({ credentialId, sourceName }: Props) {
  return (
    <div className="border rounded-md w-[320px] h-[280px]">
      <ScrollArea className="h-full p-3">
        <p className="text-sm text-muted-foreground">
          File tree for <strong>{sourceName}</strong>
        </p>
        <p className="text-xs mt-2">
          Credential ID: {credentialId}
        </p>
      </ScrollArea>
    </div>
  )
}
