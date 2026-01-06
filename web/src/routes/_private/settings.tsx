import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  Settings as SettingsIcon,
  ArrowLeft,
  AlertTriangle
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
import { deleteCredentialById, deleteCredentialPermission, listCredentials, updateCredentialPermission } from "@/lib/credential"
import type { DisplayCredential } from "@api/utils/credential"
import { getDropboxCredentialUrl, getGoogleCredentialUrl, type GoogleScope } from "@/lib/oauth"
import { getIsAdmin, getUserId } from "@/lib/auth"
import { cn } from "@/lib/utils"
import UserInput from "@/components/user-input/user-input"
import { AsyncConfirmButton } from "@/components/async-confirm-button/async-confirm-button"
import { infoToast } from "@/components/info-toast/info-toast"

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

        <DataSourcesSection
          credentials={credentials ?? []}
          loading={loading}
          onCredentialsUpdate={setCredentials}
        />

        <StorageSection
          credentials={credentials ?? []}
          loading={loading}
          onCredentialsUpdate={setCredentials}
        />

      </motion.div>
    </>
  )
}

// --------------------------------------------------------------------------------
// --------------------------- Data Sources Section -------------------------------
// --------------------------------------------------------------------------------

type SectionProps = {
  credentials: DisplayCredential[]
  loading: boolean,
  onCredentialsUpdate: React.Dispatch<
    React.SetStateAction<DisplayCredential[] | null>
  >
}

type SourceConfig = {
  id: string
  name: string
  icon: string
  scope: GoogleScope
}

export function DataSourcesSection({ credentials, loading, onCredentialsUpdate }: SectionProps) {
  const [openSourceId, setOpenSourceId] = useState<string | null>(null)
  const [expandedCredentialId, setExpandedCredentialId] = useState<string | null>(null)
  const [deleteModal, setDeleteModal] = useState<{ credentialId: string | null }>({ credentialId: null })
  const [selectedUsers, setSelectedUsers] = useState<Record<string, string | undefined>>({})

  // Check if user can admin
  function canManageCredential(cred: DisplayCredential) {
    return getIsAdmin() || cred.canAdmin === true
  }

  // Delete credential handler
  function onDeleteCredential(id: string) {
    const toastId = infoToast.loading({
      title: m["settings.sources.modal.delete.title"](),
      description: m["settings.sources.toast.delete.loading"](),
    });

    deleteCredentialById(id)
      .then(async () => {
        const freshCredentials = await listCredentials();
        onCredentialsUpdate(freshCredentials);

        infoToast.success(toastId, {
          title: m["common.success"]?.() ?? "Listo",
          description: m["settings.sources.toast.delete.success"](),
        });
      })
      .catch((error) => {
        console.error("Error deleting credential", error);

        infoToast.error(toastId, {
          title: m["common.error"]?.() ?? "Error",
          description: m["settings.sources.toast.delete.error"](),
        });
      });
  }

  // Delete permission handler
  async function handleDeletePermission(credentialId: string,userId: string)
  {
    const toastId = infoToast.loading({
      title: m["settings.sources.permissions.remove.toast.loading.title"](),
      description: m["settings.sources.permissions.remove.toast.loading.description"](),
    })

    try {
      await deleteCredentialPermission({
        credentialId,
        userId,
      })

      const freshCredentials = await listCredentials()
      onCredentialsUpdate(freshCredentials)

      infoToast.success(toastId, {
        title: m["settings.sources.permissions.remove.toast.success.title"](),
        description:
          m["settings.sources.permissions.remove.toast.success.description"](),
      })
    } catch (error) {
      console.error("Error deleting credential permission", error)

      infoToast.error(toastId, {
        title: m["settings.sources.permissions.remove.toast.error.title"](),
        description:
          m["settings.sources.permissions.remove.toast.error.description"](),
      })
    }
  }

  // Selected user handlers
  function setSelectedUser(credentialId: string, userId?: string) {
    setSelectedUsers((prev) => ({
      ...prev,
      [credentialId]: userId,
    }))
  }

  function getSelectedUser(credentialId: string) {
    return selectedUsers[credentialId]
  }

  // Check if user is already in credential
  function isUserAlreadyInCredential(
    cred: DisplayCredential,
    userId?: string
  ) {
    if (!userId) return false
    if (cred.ownedBy.id === userId) return true
    if (getUserId() === userId) return true

    return cred.permissions.some((p) => p.id === userId)
  }

  // Add permission handler 
  async function handleAddPermission(cred: DisplayCredential) {
    const userId = getSelectedUser(cred.id)
    if (!userId) return

    await updateCredentialPermission({
      credentialId: cred.id,
      userId,
      isAdmin: false,
    })

    const freshCredentials = await listCredentials()
    onCredentialsUpdate(freshCredentials)
    setSelectedUser(cred.id, undefined)
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
            const [selectedUserId, setSelectedUserId] = useState<string | undefined>()

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
                                        variant="destructive"
                                        disabled={!canManageCredential(cred)}
                                        className={cn(
                                          "cursor-pointer",
                                          !canManageCredential(cred) &&
                                            "opacity-50 cursor-not-allowed"
                                        )}
                                        onClick={() => {
                                          if (!canManageCredential(cred)) return
                                          setDeleteModal({ credentialId: cred.id })
                                        }}
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
                                      <div className="space-y-4 text-sm">
                                        {/* Basic info */}
                                        <div className="divide-y divide-border">
                                          <DetailItem
                                            label="Cuenta"
                                            value={cred.email}
                                          />
                                          <DetailItem
                                            label="Fecha de creación"
                                            value={new Date(cred.createdAt).toLocaleDateString()}
                                          />
                                        </div>

                                        {/* Permissions section */}
                                        {canManageCredential(cred) && (
                                          <div className="pt-4 border-t space-y-3">
                                            <div>
                                              <h4 className="text-sm font-medium">
                                                Permisos de la credencial
                                              </h4>
                                              <p className="text-xs text-muted-foreground">
                                                Administrá qué usuarios pueden acceder y utilizar esta credencial.
                                              </p>
                                            </div>

                                            {/* Add permission */}
                                            <div className="flex items-center gap-2">
                                              <div className="flex-1">
                                                <UserInput
                                                  value={getSelectedUser(cred.id)}
                                                  onChange={(id) => setSelectedUser(cred.id, id)}
                                                />
                                              </div>

                                              <AsyncConfirmButton
                                                size="sm"
                                                variant="outline"
                                                className={cn(
                                                  "cursor-pointer",
                                                  ( !getSelectedUser(cred.id) ||
                                                    isUserAlreadyInCredential(cred, getSelectedUser(cred.id)) ) &&
                                                    "opacity-50 cursor-not-allowed pointer-events-none"
                                                )}
                                                onClick={async () => {
                                                  if (
                                                    !getSelectedUser(cred.id) ||
                                                    isUserAlreadyInCredential(cred, getSelectedUser(cred.id))
                                                  ) {
                                                    return
                                                  }

                                                  await handleAddPermission(cred)
                                                }}
                                              >
                                                Agregar
                                              </AsyncConfirmButton>
                                            </div>

                                            {/* Permissions list */}
                                            <div className="space-y-2">
                                              {cred.permissions.map((user) => (
                                                <div
                                                  key={user.id}
                                                  className="flex items-center justify-between rounded-md border px-3 py-2"
                                                >
                                                  <div className="flex items-center gap-3 min-w-0">
                                                    {user.pfpUrl ? (
                                                      <img
                                                        src={user.pfpUrl}
                                                        alt={user.displayName ?? user.email}
                                                        className="h-7 w-7 rounded-full object-cover"
                                                      />
                                                    ) : (
                                                      <div
                                                        className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium text-white"
                                                        style={{
                                                          backgroundColor: stringToColor(
                                                            user.displayName ?? user.email
                                                          ),
                                                        }}
                                                      >
                                                        {(user.displayName ?? user.email)[0]?.toUpperCase()}
                                                      </div>
                                                    )}

                                                    <div className="flex flex-col min-w-0">
                                                      <span className="text-sm truncate">
                                                        {user.displayName ?? user.email}
                                                      </span>
                                                      <span className="text-xs text-muted-foreground truncate">
                                                        {user.email}
                                                      </span>
                                                    </div>
                                                  </div>

                                                  <div className="flex items-center gap-2">
                                                    {user.isAdminOfCredential && (
                                                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                                        Admin
                                                      </span>
                                                    )}

                                                    <Button
                                                      size="sm"
                                                      variant="destructive"
                                                      disabled={!canManageCredential(cred)}
                                                      className={cn(
                                                        "cursor-pointer",
                                                        !canManageCredential(cred) &&
                                                          "opacity-50 cursor-not-allowed pointer-events-none"
                                                      )}
                                                      onClick={() =>
                                                        handleDeletePermission(cred.id, user.id)
                                                      }
                                                    >
                                                      {m["common.delete"]()}
                                                    </Button>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
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
// ------------------------------- Storage Section ----------------------------------
// --------------------------------------------------------------------------------

type StorageProviderConfig = {
  id: "gdrive" | "dropbox" | "onedrive"
  name: string
  icon: string
  connect: () => string
}

const STORAGE_PROVIDERS: StorageProviderConfig[] = [
  {
    id: "gdrive",
    name: "Google Drive",
    icon: "/datasource_icons/gdrive.png",
    connect: () => getGoogleCredentialUrl("drive"),
  },
  {
    id: "dropbox",
    name: "Dropbox",
    icon: "/datasource_icons/dropbox.png",
    connect: () => getDropboxCredentialUrl(),
  },
  {
    id: "onedrive",
    name: "OneDrive",
    icon: "/datasource_icons/onedrive.png",
    connect: () => "#", // future
  },
]

function credentialsByProvider(
  providerId: string,
  credentials: DisplayCredential[]
) {
  switch (providerId) {
    case "gdrive":
      return credentials.filter(
        (c) =>
          c.provider === "google" &&
          c.scopes?.[0] === "drive"
      )

    case "dropbox":
      return credentials.filter(
        (c) => c.provider === "dropbox"
      )

    default:
      return []
  }
}


function StorageSection({
  credentials,
  loading,
  onCredentialsUpdate
}: SectionProps) {
  const [openProviderId, setOpenProviderId] = useState<string | null>(null)
  const [expandedCredentialId, setExpandedCredentialId] = useState<string | null>(null)
  const [deleteModal, setDeleteModal] = useState<{ credentialId: string | null }>({ credentialId: null })

  // Check if user can admin
  function canManageCredential(cred: DisplayCredential) {
    return getIsAdmin() || cred.canAdmin === true
  }

  // Delete credential handler
  function onDeleteCredential(id: string) {
    const toastId = infoToast.loading({
      title: m["settings.sources.modal.delete.title"](),
      description: m["settings.sources.toast.delete.loading"](),
    });

    deleteCredentialById(id)
      .then(async () => {
        const freshCredentials = await listCredentials();
        onCredentialsUpdate(freshCredentials);

        infoToast.success(toastId, {
          title: m["common.success"]?.() ?? "Listo",
          description: m["settings.sources.toast.delete.success"](),
        });
      })
      .catch((error) => {
        console.error("Error deleting credential", error);

        infoToast.error(toastId, {
          title: m["common.error"]?.() ?? "Error",
          description: m["settings.sources.toast.delete.error"](),
        });
      });
  }

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
          <h2 className="text-lg font-semibold">
            {m["settings.storage.title"]()}
          </h2>
          <p className="text-sm text-muted-foreground">
            {m["settings.storage.description"]()}
          </p>
        </div>

        <Separator />

        <div className="space-y-3">
          {STORAGE_PROVIDERS.map((provider) => {
            const providerCredentials = credentialsByProvider(
              provider.id,
              credentials
            )

            const open = openProviderId === provider.id
            const count = providerCredentials.length

            return (
              <div
                key={provider.id}
                className="rounded-xl border p-3 space-y-3"
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={provider.icon}
                      className="h-6 w-6"
                    />
                    <span className="font-medium">
                      {provider.name}
                    </span>
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
                          onClick={() =>
                            setOpenProviderId(open ? null : provider.id)
                          }
                        >
                          {count === 0
                            ? m["settings.sources.no_accounts"]()
                            : `${count} account${count > 1 ? "s" : ""} · ${m["settings.sources.view_details"]()}`}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() =>
                            (window.location.href = provider.connect())
                          }
                        >
                          {m["settings.sources.connect"]()}
                        </Button>
                      </>
                    )}
                  </div>

                </div>

                {/* Credentials */}
                <AnimatePresence>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-2"
                    >
                      {count === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {m["settings.sources.no_accounts"]()}
                        </p>
                      ) : (
                        providerCredentials.map((cred) => {
                          const expanded =
                            expandedCredentialId === cred.id

                          return (
                            <div
                              key={cred.id}
                              className="rounded-md border overflow-hidden"
                            >
                              {/* Credential row */}
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
                                      style={{
                                        backgroundColor: stringToColor(
                                          cred.ownedBy.displayName ?? cred.ownedBy.email
                                        ),
                                      }}
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
                                    onClick={() =>
                                      setExpandedCredentialId(expanded ? null : cred.id)
                                    }
                                  >
                                    {expanded
                                      ? m["admin.users.collapse"]()
                                      : m["admin.users.expand"]()}
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={!canManageCredential(cred)}
                                    className={cn(
                                      "cursor-pointer",
                                      !canManageCredential(cred) &&
                                        "opacity-50 cursor-not-allowed"
                                    )}
                                    onClick={() => {
                                      if (!canManageCredential(cred)) return
                                      setDeleteModal({ credentialId: cred.id })
                                    }}
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


                              {/* Tree area */}
                              <AnimatePresence>
                                {expanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{
                                      height: 280,
                                      opacity: 1,
                                    }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="border-t bg-muted/30"
                                  >
                                    <ScrollArea className="h-[280px] p-3">
                                      <StorageTree
                                        provider={provider.id}
                                        credential={cred}
                                      />
                                    </ScrollArea>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )
                        })
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


function StorageTree({
  provider,
  credential,
}: {
  provider: string
  credential: DisplayCredential
}) {
  switch (provider) {
    // case "gdrive":
    //   return <GoogleDriveTree credential={credential} />

    // case "dropbox":
    //   return <DropboxTree credential={credential} />

    default:
      return (
        <div className="text-sm text-muted-foreground">
          Tree not implemented
        </div>
      )
  }
}


