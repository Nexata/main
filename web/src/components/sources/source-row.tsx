import { AnimatePresence, motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import * as m from "@/paraglide/messages.js"
import type { DisplayCredential } from "@api/utils/credential"
import { CredentialDetailsRow } from "@/components/credentials/credential-details-row"
import type { SourceConfig } from "@/lib/available-sources"

type Props = {
  source: SourceConfig
  credentials: DisplayCredential[]
  loading: boolean
  isOpen: boolean
  onToggle: () => void
  canManageCredential: (cred: DisplayCredential) => boolean
  expandedCredentialId: string | null
  onToggleCredential: (id: string) => void
  onDeleteCredential: (id: string) => void
  onCredentialsUpdate: React.Dispatch<React.SetStateAction<DisplayCredential[] | null>>
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
                {m["settings.sources.loading_accounts"]()}
              </span>
            </div>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="cursor-pointer"
                onClick={onToggle}
              >
                {count === 0
                  ? m["settings.sources.no_accounts"]()
                  : `${count} account${count > 1 ? "s" : ""} · ${m["settings.sources.view_details"]()}`}
              </Button>

                <Button
                size="sm"
                variant="outline"
                className="cursor-pointer"
                onClick={() => {
                    const url = source.connect()
                    window.open(url, "_blank", "noopener,noreferrer")
                }}
                >
                {m["settings.sources.connect"]()}
                </Button>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isOpen && !loading && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-col gap-2 mt-2"
          >
            {count === 0 ? (
              <p className="text-sm text-muted-foreground">
                {m["settings.sources.no_accounts"]()}
              </p>
            ) : (
              credentials.map((cred) => (
                <CredentialDetailsRow
                  key={cred.id}
                  credential={cred}
                  expanded={expandedCredentialId === cred.id}
                  onToggle={() => onToggleCredential(cred.id)}
                  canManage={canManageCredential(cred)}
                  onDelete={onDeleteCredential}
                  onCredentialsUpdate={onCredentialsUpdate}
                />
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

