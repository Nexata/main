import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  Settings as SettingsIcon,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import * as m from "@/paraglide/messages.js"
import { listCredentials } from "@/lib/credential"
import type { DisplayCredential } from "@api/utils/credential"
import { getGoogleCredentialUrl, type GoogleScope } from "@/lib/oauth"

export const Route = createFileRoute("/_private/settings")({
  component: SettingsPage,
})

// ------------------------------- Settings Page ----------------------------------
function SettingsPage() {

  // Window title
  useEffect(() => {
  document.title = m["settings.meta.title"]()
  }, [])

  // Navigation
  const navigate = useNavigate()

  // Credentials state
  const [credentials, setCredentials] = useState<DisplayCredential[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadCredentials() {
      try {
        setLoading(true)
        const data = await listCredentials()
        console.log(data)
        if (mounted) setCredentials(data)
      } catch (err) {
        console.error(err)
        if (mounted) setError("Failed to load credentials")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadCredentials()

    return () => { mounted = false }
  }, [])

  return (
    <>
        <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="flex flex-col gap-6 px-3 py-4 w-full max-w-screen-2xl mx-auto"
        >

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {m["settings.title"]()}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {m["settings.subtitle"]()}
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="destructive"
              onClick={() => navigate({ to: "/adminsettings" })}
              className="gap-2 cursor-pointer"
            >
              <SettingsIcon className="h-4 w-4" />
              {m["settings.actions.admin_panel"]()}
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate({ to: "/chat" })}
              className="gap-2 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              {m["settings.actions.back_to_chat"]()}
            </Button>
          </div>
        </div>

        {/* Separador */}
        <div className="h-px w-full bg-border" />

        <DataSourcesSection credentials={credentials ?? []} loading={loading} />

        <StorageSection />

      </motion.div>
    </>
  )
}

// --------------------------------------------------------------------------------
// --------------------------- Data Sources Section -------------------------------
// --------------------------------------------------------------------------------

type DataSourcesSectionProps = {
  credentials: DisplayCredential[]
  loading: boolean
}

type SourceConfig = {
  id: string
  name: string
  icon: string
  scope: GoogleScope
}

export function DataSourcesSection({ credentials, loading }: DataSourcesSectionProps) {
  const [openSourceId, setOpenSourceId] = useState<string | null>(null)
  const [expandedCredentialId, setExpandedCredentialId] = useState<string | null>(null)
  const [deleteModal, setDeleteModal] = useState<{ credentialId: string | null }>({ credentialId: null })

  // Delete credential handler
  function onDeleteCredential(id: string) {
    console.log("Eliminar credencial:", id)
  }

  // Available data sources
  const sources: SourceConfig[] = [
    { id: "gmail", name: "Gmail", icon: "/datasource_icons/gmail.png", scope: "gmail" },
    { id: "gcalendar", name: "Google Calendar", icon: "/datasource_icons/gcalendar.png", scope: "calendar" },
  ]

  
  const credentialsByScope = (scope: GoogleScope) => credentials.filter((c) => c.provider === "google" && c.scopes?.[0] === scope)

  // Utility to generate a color from a string
  function stringToColor(str: string) {
    let hash = 0
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
    return `hsl(${Math.abs(hash) % 360}, 65%, 55%)`
  }

  return (
    <Card className="bg-[var(--sidebar)]">
      <CardContent className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{m["settings.sources.title"]()}</h2>
          <p className="text-sm text-muted-foreground">{m["settings.sources.description"]()}</p>
        </div>

        <Separator />

        <div className="space-y-3">
          {sources.map((source) => {
            const sourceCredentials = credentialsByScope(source.scope)
            const openSource = openSourceId === source.id
            const accountCount = sourceCredentials.length

            return (
              <div key={source.id} className="rounded-xl border p-3 space-y-3 flex flex-col">
                {/* Source header */}
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
                          onClick={() => setOpenSourceId(openSource ? null : source.id)}
                        >
                          {accountCount === 0
                            ? m["settings.sources.no_accounts"]()
                            : `${accountCount} account${accountCount > 1 ? "s" : ""} · ${m["settings.sources.view_details"]()}`}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() => (window.location.href = getGoogleCredentialUrl(source.scope))}
                        >
                          {m["settings.sources.connect"]()}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Credentials list */}
                <AnimatePresence>
                  {openSource && !loading && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="flex flex-col gap-2 mt-2"
                    >
                      {accountCount === 0 ? (
                        <p className="text-sm text-muted-foreground">{m["settings.sources.no_accounts"]()}</p>
                      ) : (
                        <>
                          {sourceCredentials.map((cred) => {
                            const expanded = expandedCredentialId === cred.id
                            return (
                              <div
                                key={cred.id}
                                className="rounded-md border border-border bg-[var(--card)] overflow-hidden"
                              >
                                {/* Row */}
                                <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors gap-2">
                                  {/* Owner info */}
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {cred.ownedBy.pfpUrl ? (
                                      <img
                                        src={cred.ownedBy.pfpUrl}
                                        alt={cred.ownedBy.displayName ?? cred.ownedBy.email}
                                        className="h-6 w-6 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div
                                        className="h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                                        style={{ backgroundColor: stringToColor(cred.ownedBy.displayName ?? cred.ownedBy.email) }}
                                      >
                                        {(cred.ownedBy.displayName ?? cred.ownedBy.email)[0]?.toUpperCase()}
                                      </div>
                                    )}
                                    <span className="text-sm font-medium truncate">
                                      {cred.ownedBy.displayName ?? cred.ownedBy.email}
                                    </span>
                                  </div>

                                  {/* Actions */}
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="cursor-pointer"
                                      onClick={() => setExpandedCredentialId(expanded ? null : cred.id)}
                                    >
                                      {expanded ? m["admin.users.collapse"]() : m["admin.users.expand"]()}
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-destructive cursor-pointer"
                                      onClick={() => setDeleteModal({ credentialId: cred.id })}
                                    >
                                      {m["common.delete"]()}
                                    </Button>

                                      <ConfirmDeleteCredentialModal
                                        modal={deleteModal}
                                        setModal={setDeleteModal}
                                        onDeleteCredential={onDeleteCredential}
                                      />
                                  </div>
                                </div>

                                {/* Expanded details */}
                                <AnimatePresence>
                                  {expanded && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: "auto" }}
                                      exit={{ opacity: 0, height: 0 }}
                                      transition={{ duration: 0.2 }}
                                      className="px-4 pb-4 overflow-hidden"
                                    >
                                      <div className="divide-y divide-border text-sm">
                                        <DetailItem
                                          label={m["settings.sources.account_label"]()}
                                          value={cred.email}
                                        />
                                        <DetailItem
                                          label={m["settings.sources.created_at_label"]()}
                                          value={new Date(cred.createdAt).toLocaleDateString()}
                                        />
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )
                          })}
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}


// Detail item component
function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}

// Confirm Delete Modal
type DeleteModalState = {
  credentialId: string | null
}

function ConfirmDeleteCredentialModal({
  modal,
  setModal,
  onDeleteCredential,
}: {
  modal: DeleteModalState
  setModal: (m: DeleteModalState) => void
  onDeleteCredential: (id: string) => void
}) {
  if (!modal.credentialId) return null

  return (
    <Dialog
      open={!!modal.credentialId}
      onOpenChange={() => setModal({ credentialId: null })}
    >
      <DialogContent>
        <DialogHeader>
          {/* Title with danger icon */}
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </span>
            {m["settings.sources.modal.delete.title"]()}
          </DialogTitle>

          <DialogDescription className="pt-1">
            {m["settings.sources.modal.delete.description"]()}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex justify-end gap-2">
          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={() => setModal({ credentialId: null })}
          >
            {m["common.cancel"]()}
          </Button>

          <Button
            variant="destructive"
            className="cursor-pointer"
            onClick={() => {
              if (modal.credentialId) onDeleteCredential(modal.credentialId)
              setModal({ credentialId: null })
            }}
          >
            {m["common.confirm"]()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --------------------------------------------------------------------------------
// ------------------------------- Drive Section ----------------------------------
// --------------------------------------------------------------------------------
function StorageSection() {
  const [providers, setProviders] = useState([
    {
      id: "gdrive",
      name: "Google Drive",
      icon: "/datasource_icons/gdrive.png"
    },
    {
      id: "onedrive",
      name: "OneDrive",
      icon: "/datasource_icons/onedrive.png"
    },
    {
      id: "dropbox",
      name: "Dropbox",
      icon: "/datasource_icons/dropbox.png"
    }
  ])

  const [openProvider, setOpenProvider] = useState<string | null>(null)

  return (
    <Card className="bg-[var(--sidebar)]">
      <CardContent className="p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">
            {m["settings.storage.title"]()}
          </h2>
          <p className="text-sm text-muted-foreground">
            {m["settings.storage.description"]()}
          </p>
        </div>

        <Separator />

        <div className="space-y-3">
          {providers.map((provider) => {
            const open = openProvider === provider.id

            return (
              <div
                key={provider.id}
                className="rounded-xl border p-3 space-y-3"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={provider.icon}
                      className="h-6 w-6"
                      alt={provider.name}
                    />
                    <span className="font-medium">{provider.name}</span>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setOpenProvider(open ? null : provider.id)
                    }
                  >
                    {open
                      ? m["settings.storage.close"]()
                      : m["settings.storage.configure"]()}
                  </Button>
                </div>

                {/* Content */}
                <AnimatePresence>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                    >
                      <ScrollArea className="h-[280px] rounded-md border p-3">
                        {/* Tree dinámico según provider.id */}
                        <div className="text-sm text-muted-foreground">
                          {provider.name} tree goes here
                        </div>
                      </ScrollArea>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}


