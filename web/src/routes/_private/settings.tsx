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

export const Route = createFileRoute("/_private/settings")({
  component: SettingsPage,
})

// ------------------------------- Settings Page ----------------------------------
function SettingsPage() {

    useEffect(() => {
    document.title = m["settings.meta.title"]()
    }, [])

    const navigate = useNavigate()

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
              className="gap-2"
            >
              <SettingsIcon className="h-4 w-4" />
              {m["settings.actions.admin_panel"]()}
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate({ to: "/chat" })}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {m["settings.actions.back_to_chat"]()}
            </Button>
          </div>
        </div>

        {/* Separador */}
        <div className="h-px w-full bg-border" />

        <DataSourcesSection />

        <StorageSection />

      </motion.div>
    </>
  )
}


// --------------------------- Data Sources Section -------------------------------
function DataSourcesSection() {
    const [sources, setSources] = useState([
        { id: "gmail", name: "Gmail", status: "disconnected" },
        { id: "gcalendar", name: "Google Calendar", status: "warning" },
        { id: "outlook", name: "Outlook", status: "connected" },
        { id: "ocalendar", name: "Outlook Calendar", status: "disconnected" }
    ])

    const [modal, setModal] = useState<null | {
        type: "connect" | "disconnect"
        source: typeof sources[number]
    }>(null)

    const statusIcon = (status: string) => {
        switch (status) {
        case "connected":
            return <CheckCircle2 className="text-green-500 h-5 w-5" />
        case "warning":
            return <AlertTriangle className="text-yellow-500 h-5 w-5" />
        default:
            return <XCircle className="text-destructive h-5 w-5" />
        }
    }

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
            {sources.map((s) => (
                <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border p-3"
                >
                <div className="flex items-center gap-3">
                    <img
                    src={`/datasource_icons/${s.id}.png`}
                    className="h-6 w-6"
                    />
                    <span className="font-medium">{s.name}</span>
                </div>

                <div className="flex items-center gap-4">
                    {statusIcon(s.status)}
                    <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                        setModal({
                        type:
                            s.status === "connected"
                            ? "disconnect"
                            : "connect",
                        source: s,
                        })
                    }
                    >
                    {s.status === "connected"
                        ? m["settings.sources.disconnect"]()
                        : m["settings.sources.connect"]()}
                    </Button>
                </div>
                </div>
            ))}
            </div>
        </CardContent>

        <Dialog open={!!modal} onOpenChange={() => setModal(null)}>
            <DialogContent>
            <DialogHeader>
                <DialogTitle>
                {modal?.type === "connect"
                    ? m["settings.sources.modal.connect.title"]({ name: modal.source.name })
                    : m["settings.sources.modal.disconnect.title"]({ name: modal?.source.name ?? "Source" })}
                </DialogTitle>
                <DialogDescription>
                {modal?.type === "connect"
                    ? m["settings.sources.modal.connect.description"]()
                    : m["settings.sources.modal.disconnect.description"]()}
                </DialogDescription>
            </DialogHeader>

            <DialogFooter>
                <Button variant="outline" onClick={() => setModal(null)}>
                    {m["common.cancel"]()}
                </Button>
                <Button
                onClick={() => {
                    if (!modal) return

                    setSources((prev) =>
                    prev.map((s) =>
                        s.id === modal.source.id
                        ? {
                            ...s,
                            status:
                                modal.type === "connect"
                                ? "connected"
                                : "disconnected",
                            }
                        : s
                    )
                    )

                    setModal(null)
                }}
                variant={modal?.type === "disconnect" ? "destructive" : "default"}
                >
                    {m["common.confirm"]()}
                </Button>

            </DialogFooter>
            </DialogContent>
        </Dialog>
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


