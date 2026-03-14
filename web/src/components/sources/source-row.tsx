import { AnimatePresence, motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import type { CredentialItem } from "@/lib/credential"
import { CredentialDetailsRow } from "@/components/credentials/credential-details-row"
import type { SourceConfig } from "@/lib/available-sources"
import {
  "settings.sources.loading_accounts" as settings_sources_loading_accounts,
  "settings.sources.no_accounts" as settings_sources_no_accounts,
  "settings.sources.view_details" as settings_sources_view_details,
  "settings.sources.connect" as settings_sources_connect,
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

  return (
    <div className="rounded-xl border p-3 space-y-3 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-x-4 gap-y-2 flex-wrap">
        <div className="flex items-center gap-3">
          <img src={source.icon} className="h-6 w-6" alt={source.name} />
          <span className="font-medium">{source.name}</span>
        </div>

        <div className="flex items-center gap-4 ml-auto">
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 border-2 border-t-transparent border-primary rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">
                {settings_sources_loading_accounts()}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {count === 0 ? (
                <span className="text-sm text-muted-foreground">
                  {settings_sources_no_accounts()}
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="cursor-pointer"
                  onClick={onToggle}
                >
                  {`${count} · ${settings_sources_view_details()}`}
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer"
                onClick={async () => {
                  const url = await source.connect();
                  window.location.href = url;
                }}
              >
                {settings_sources_connect()}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Credentials */}
      <AnimatePresence>
        {isOpen && !loading && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex flex-col gap-3 mt-2"
          >
            {credentials.map((cred) => (
              <CredentialDetailsRow
                key={cred.id}
                credential={cred}
                expanded={expandedCredentialId === cred.id}
                onToggle={() => onToggleCredential(cred.id)}
                canManage={canManageCredential(cred)}
                onDelete={onDeleteCredential}
                onCredentialsUpdate={onCredentialsUpdate}
                source={source}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
