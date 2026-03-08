import { AnimatePresence, motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CredentialPermissions } from "@/components/credentials/credential-permissions"
import type { CredentialItem } from "@/lib/credential"
import type { SourceConfig } from "@/lib/available-sources"
import { StorageFileTree } from "@/components/sources/file-tree"
import { useEffect, useState } from "react"
import {
  "common.delete" as common_delete,
  "common.created_at" as common_created_at,
  "components.sources.view_files" as components_sources_view_files,
  "components.sources.collapse_files" as components_sources_collapse_files,
  "components.credentials.permissions.view_credentials" as components_credentials_permissions_view_credentials,
  "components.credentials.permissions.hide_credentials" as components_credentials_permissions_hide_credentials
} from "@/paraglide/messages.js"
import { AccessLevelBadge } from "./access-level-badge"

type Props = {
  credential: CredentialItem
  expanded: boolean
  onToggle: () => void
  canManage: boolean
  onDelete: (id: string) => void
  onCredentialsUpdate: React.Dispatch<React.SetStateAction<CredentialItem[] | null>>
  source: SourceConfig
}

export function CredentialDetailsRow({
  credential,
  expanded,
  onToggle,
  canManage,
  onDelete,
  onCredentialsUpdate,
  source,
}: Props) {
  const [mode, setMode] = useState<"details" | "files">("details")

  // Reset mode when collapsing
  useEffect(() => {
    if (!expanded) setMode("details")
  }, [expanded])

  // Utility to generate avatar color
  function stringToColor(str: string) {
    let hash = 0
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)

    return `hsl(${Math.abs(hash) % 360}, 65%, 55%)`
  }

  const createdDate = new Date(credential.createdAt).toLocaleDateString()

  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      {/* Row */}
      <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors gap-2">
        {/* Owner */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Avatar */}
          {credential.ownedBy.pfpUrl ? (
            <img
              src={credential.ownedBy.pfpUrl}
              alt={credential.ownedBy.displayName ?? credential.ownedBy.email}
              className="h-8 w-8 rounded-full object-cover shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
              style={{
                backgroundColor: stringToColor(
                  credential.ownedBy.displayName ?? credential.ownedBy.email
                ),
              }}
            >
              {(credential.ownedBy.displayName ??
                credential.ownedBy.email)[0]?.toUpperCase()}
            </div>
          )}

          {/* Text block */}
          <div className="flex flex-col min-w-0">
            {/* Row 1 — name + badge */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium truncate">
                {credential.ownedBy.displayName ?? credential.ownedBy.email}
              </span>

              <span className="shrink-0">
                <AccessLevelBadge level={credential.accessLevel} />
              </span>
            </div>

            {/* Row 2 — email + created */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
              <span className="truncate">{credential.email}</span>

              <span className="opacity-60 shrink-0">•</span>

              <span className="shrink-0">
                {common_created_at()} {createdDate}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Details button */}
          <Button
            size="sm"
            variant={expanded && mode === "details" ? "outline" : "ghost"}
            className="cursor-pointer"
            onClick={() => {
              if (!expanded) {
                setMode("details")
                onToggle()
                return
              }

              if (mode === "details") onToggle()
              else setMode("details")

            }}
          >
            {expanded && mode === "details" ? components_credentials_permissions_hide_credentials() : components_credentials_permissions_view_credentials()}
          </Button>

          {/* Files button */}
          {source.kind === "storage" && (
            <Button
              size="sm"
              variant={expanded && mode === "files" ? "outline" : "ghost"}
              className="cursor-pointer"
              onClick={() => {
                if (!expanded) {
                  setMode("files")
                  onToggle()
                  return
                }

                if (mode === "files") onToggle()
                else setMode("files")
              }}
            >
              {expanded && mode === "files" ? components_sources_collapse_files() : components_sources_view_files()}
            </Button>
          )}

          {/* Delete */}
          <Button
            size="sm"
            variant="destructive"
            disabled={!canManage}
            className={cn(
              "cursor-pointer",
              !canManage && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => {
              if (!canManage) return
              onDelete(credential.id)
            }}
          >
            {common_delete()}
          </Button>
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 pb-4 overflow-hidden"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 text-sm"
              >
                {mode === "details" && (
                    <CredentialPermissions
                      credential={credential}
                      canManage={canManage}
                      onCredentialsUpdate={onCredentialsUpdate}
                    />
                )}

                {mode === "files" &&
                  source.kind === "storage" && (
                    <StorageFileTree
                      credentialId={credential.id}
                      source={source}
                    />
                  )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
