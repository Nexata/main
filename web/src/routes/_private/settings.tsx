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

// --------------------------- Data Sources Section -------------------------------
type DataSourcesSectionProps = {
  credentials: DisplayCredential[]
}

export function DataSourcesSection({ credentials, loading }: DataSourcesSectionProps & { loading: boolean }) {
  const [openSource, setOpenSource] = useState<string | null>(null)

  type SourceConfig = {
    id: string
    name: string
    icon: string
    scope: GoogleScope
  }

  const sources: SourceConfig[] = [
    {
      id: "gmail",
      name: "Gmail",
      icon: "/datasource_icons/gmail.png",
      scope: "gmail",
    },
    {
      id: "gcalendar",
      name: "Google Calendar",
      icon: "/datasource_icons/gcalendar.png",
      scope: "calendar",
    },
  ]

  const credentialsByScope = (scope: GoogleScope) =>
    credentials.filter(
      (c) =>
        c.provider === "google" &&
        c.scopes?.[0] === scope
    )

  return (
    <Card className="bg-[var(--sidebar)]">
      <CardContent className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">
            {m["settings.sources.title"]()}
          </h2>
          <p className="text-sm text-muted-foreground">
            {m["settings.sources.description"]()}
          </p>
        </div>

        <Separator />

        <div className="space-y-3">
          {sources.map((source) => {
            const accounts = credentialsByScope(source.scope)
            const open = openSource === source.id
            const accountCount = accounts.length

            return (
              <div
                key={source.id}
                className="rounded-xl border p-3 space-y-3 flex flex-col"
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img src={source.icon} className="h-6 w-6" />
                    <span className="font-medium">{source.name}</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      className="text-sm text-muted-foreground hover:underline cursor-pointer"
                      onClick={() =>
                        setOpenSource(open ? null : source.id)
                      }
                    >
                      {loading
                        ? "Loading..."
                        : accountCount === 0
                        ? m["settings.sources.no_accounts"]()
                        : `${accountCount} account${
                            accountCount > 1 ? "s" : ""
                          } · View details`}
                    </button>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loading}
                      className="cursor-pointer"
                      onClick={() => {
                        window.location.href =
                          getGoogleCredentialUrl(source.scope)
                      }}
                    >
                      {m["settings.sources.connect"]()}
                    </Button>
                  </div>
                </div>

                {/* Loading placeholder */}
                {loading && (
                  <div className="mt-2 h-6 w-full animate-pulse bg-muted rounded" />
                )}

                {/* Accounts detail */}
                <AnimatePresence>
                  {!loading && open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="pl-9 space-y-2"
                    >
                      {accountCount === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {m["settings.sources.no_accounts"]()}
                        </p>
                      ) : (
                        accounts.map((acc) => (
                          <div
                            key={acc.id}
                            className="flex items-center justify-between w-full rounded-md border border-border p-2 text-sm bg-[var(--card)]"
                          >
                            <span className="font-medium truncate">
                              {acc.email}
                            </span>
                            <span className="text-muted-foreground truncate">
                              {acc.ownedBy.displayName ?? acc.ownedBy.email}
                            </span>
                            <span className="text-muted-foreground whitespace-nowrap">
                              {new Date(acc.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        ))
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

// ------------------------------- Drive Section ----------------------------------
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


