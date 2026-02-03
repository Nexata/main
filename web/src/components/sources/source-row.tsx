import { AnimatePresence, motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import type { CredentialItem } from "@/lib/credential"
import { CredentialDetailsRow } from "@/components/credentials/credential-details-row"
import type { SourceConfig } from "@/lib/available-sources"
import { useEffect, useState } from "react"
import { StorageFileTree } from "./file-tree"
import {
  "settings.sources.loading_accounts" as settings_sources_loading_accounts,
  "settings.sources.no_accounts" as settings_sources_no_accounts,
  "settings.sources.view_details" as settings_sources_view_details,
  "settings.sources.connect" as settings_sources_connect,
  "components.sources.view_files" as components_sources_view_files,
} from "@/paraglide/messages.js"

type Props = {
  source: SourceConfig
  credentials: CredentialItem[]
  loading: boolean
  isOpen: boolean
  onToggle: () => void
  canManageCredential: (cred: CredentialItem) => boolean
  expandedCredentialId: string | null
  onToggleCredential: (id: string) => void
  onDeleteCredential: (id: string) => void
  onCredentialsUpdate: React.Dispatch<
    React.SetStateAction<CredentialItem[] | null>
  >
}

export function SourceRow({
  source,
  credentials,
  loading,
  isOpen,
  onToggle,
  canManageCredential,
  expandedCredentialId,
  onToggleCredential,
  onDeleteCredential,
  onCredentialsUpdate,
}: Props) {
  const count = credentials.length
  const [mode, setMode] = useState<"details" | "files">("details")

  function handleToggle(nextMode: "details" | "files") {
    if (!isOpen) {
      setMode(nextMode)
      onToggle()
      return
    }

    if (mode === nextMode) {
      onToggle()
      return
    }

    setMode(nextMode)
  }

  useEffect(() => {
    if (!isOpen) setMode("details")
  }, [isOpen])

  return (
    <div className="rounded-xl border p-3 space-y-3 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src={source.icon} className="h-6 w-6" />
          <span className="font-medium">{source.name}</span>
        </div>

        <div className="flex items-center gap-4">
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 border-2 border-t-transparent border-primary rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">
                {settings_sources_loading_accounts()}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="cursor-pointer"
                onClick={() => handleToggle("details")}
              >
                {count === 0
                  ? settings_sources_no_accounts()
                  : `${count} · ${settings_sources_view_details()}`}
              </Button>

              {source.kind === "storage" && count > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer text-primary"
                  onClick={() => handleToggle("files")}
                >
                  {components_sources_view_files()}
                </Button>
              )}

              <Button
                size="sm"
                className="cursor-pointer"
                variant="outline"
                onClick={async () => {
                  const url = await source.connect()
                  window.open(url, "_blank", "noopener,noreferrer")
                }}
              >
                {settings_sources_connect()}
              </Button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isOpen && !loading && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-col gap-3 mt-2"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="flex flex-col gap-3"
              >
                {mode === "details" && (
                  <>
                    {credentials.map((cred) => (
                      <div key={cred.id} className="flex flex-col gap-2">
                        <CredentialDetailsRow
                          credential={cred}
                          expanded={expandedCredentialId === cred.id}
                          onToggle={() => onToggleCredential(cred.id)}
                          canManage={canManageCredential(cred)}
                          onDelete={onDeleteCredential}
                          onCredentialsUpdate={onCredentialsUpdate}
                        />
                      </div>
                    ))}
                  </>
                )}

                {mode === "files" && source.kind === "storage" && (
                  <>
                    {credentials.map((cred) => (
                      <StorageFileTree
                        key={cred.id}
                        credentialId={cred.id}
                        sourceName={source.name}
                      />
                    ))}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
