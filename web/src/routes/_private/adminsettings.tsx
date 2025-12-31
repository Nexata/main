import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import * as m from "@/paraglide/messages.js"

import {
  Settings,
  ArrowLeft,
  Trash2,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

export const Route = createFileRoute("/_private/adminsettings")({
  component: AdminSettingsPage,
})

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type DataSourceStatus = "connected" | "disconnected" | "warning"

type DataSource = {
  id: string
  name: string
  status: DataSourceStatus
}

type User = {
  id: string
  email: string
  realTime: boolean
}

type ModalType =
  | "deleteUser"
  | "toggleRealTime"
  | "deleteAccount"
  | null

type ModalState = {
  type: ModalType
  user?: User
  source?: DataSource
}

/* -------------------------------------------------------------------------- */
/*                              Main Page                                     */
/* -------------------------------------------------------------------------- */

function AdminSettingsPage() {
    useEffect(() => {
    document.title = m["admin.meta.title"]()
    }, [])

    const navigate = useNavigate()
    const [modal, setModal] = useState<ModalState>({ type: null })

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col gap-6 px-4 py-6 max-w-screen-2xl mx-auto"
      >
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {m["admin.header.title"]()}
            </h1>
            <p className="text-sm text-muted-foreground">
              {m["admin.header.subtitle"]()}
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary">
              <Settings className="h-4 w-4 mr-2" />
              {m["admin.header.personal_panel"]()}
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate({ to: "/chat" })}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {m["admin.header.back_to_chat"]()}
            </Button>
          </div>
        </header>

        <div className="h-px bg-border" />

        <CompanyOverviewSection />
        <UsageChartSection />
        <IntegrationsSection setModal={setModal} />
        <UsersSection setModal={setModal} />
        <ConfirmDialog modal={modal} setModal={setModal} />
      </motion.div>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*                         CompanyOverviewSection                              */
/* -------------------------------------------------------------------------- */

function CompanyOverviewSection() {
  const used = 81
  const total = 500

  return (
    <Card className="bg-[var(--sidebar)]">
      <CardContent className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">
          {m["admin.company_overview.title"]()}
        </h2>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>{m["admin.company_overview.message_balance"]()}</span>
            <span className="font-medium text-primary">
              {used} / {total}
            </span>
          </div>

          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(used / total) * 100}%` }}
              className="h-full bg-primary"
            />
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm">
            {m["admin.company_overview.current_plan"]()}{" "}
            <strong>Business 500</strong>
          </span>

          <div className="flex gap-2">
            <Button size="sm" variant="outline">
              {m["admin.company_overview.upgrade_plan"]()}
            </Button>
            <Button size="sm">
              {m["admin.company_overview.buy_messages"]()}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*                             UsageChartSection                               */
/* -------------------------------------------------------------------------- */

function UsageChartSection() {
  const [type, setType] = useState<"bars" | "lines">("bars")

  const data = [
    { name: "Juan", mensajes: 120 },
    { name: "María", mensajes: 90 },
    { name: "Pedro", mensajes: 70 },
    { name: "Ana", mensajes: 150 },
  ]

  return (
    <Card className="bg-[var(--sidebar)]">
      <CardContent className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">
            {m["admin.usage.title"]()}
          </h2>

          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="outline" size="sm">
                {type === "bars"
                  ? m["admin.usage.chart_type.bars"]()
                  : m["admin.usage.chart_type.lines"]()}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setType("bars")}>
                {m["admin.usage.chart_type.bars"]()}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setType("lines")}>
                {m["admin.usage.chart_type.lines"]()}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            {type === "bars" ? (
              <BarChart data={data}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="mensajes" fill="hsl(var(--primary))" radius={6} />
              </BarChart>
            ) : (
              <LineChart data={data}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="mensajes"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*                            IntegrationsSection                              */
/* -------------------------------------------------------------------------- */

function IntegrationsSection({
  setModal,
}: {
  setModal: (m: ModalState) => void
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const sources: DataSource[] = [
    { id: "gdrive", name: "Google Drive", status: "connected" },
    { id: "onedrive", name: "OneDrive", status: "connected" },
    { id: "gmail", name: "Gmail", status: "disconnected" },
  ]

  return (
    <Card className="bg-[var(--sidebar)]">
      <CardContent className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">
          {m["admin.integrations.title"]()}
        </h2>

        {sources.map((s) => (
          <div key={s.id} className="border rounded-xl">
            <button
              onClick={() =>
                setExpanded((p) => ({ ...p, [s.id]: !p[s.id] }))
              }
              className="w-full flex justify-between items-center p-3"
            >
              <span className="font-medium">{s.name}</span>
              <span className="text-sm text-muted-foreground">
                {expanded[s.id]
                  ? m["admin.integrations.close"]()
                  : m["admin.integrations.configure"]()}
              </span>
            </button>

            <AnimatePresence>
              {expanded[s.id] && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pb-4"
                >
                  <Separator className="mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {m["admin.integrations.manage_description"]({
                      name: s.name,
                    })}
                  </p>

                  <Button
                    size="sm"
                    variant="destructive"
                    className="mt-3"
                    onClick={() =>
                      setModal({
                        type: "deleteAccount",
                        source: s,
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {m["admin.integrations.delete_account"]()}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*                                UsersSection                                 */
/* -------------------------------------------------------------------------- */

function UsersSection({
  setModal,
}: {
  setModal: (m: ModalState) => void
}) {
  const [users] = useState<User[]>([
    { id: "1", email: "juan@empresa.com", realTime: false },
    { id: "2", email: "maria@empresa.com", realTime: true },
  ])

  return (
    <Card className="bg-[var(--sidebar)]">
      <CardContent className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">
          {m["admin.users.title"]()}
        </h2>

        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between border rounded-xl p-3"
          >
            <span>{u.email}</span>

            <div className="flex items-center gap-3">
              <Switch
                checked={u.realTime}
                onCheckedChange={() =>
                  setModal({ type: "toggleRealTime", user: u })
                }
              />

              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setModal({ type: "deleteUser", user: u })
                }
              >
                {m["admin.users.delete_user"]()}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*                               ConfirmDialog                                 */
/* -------------------------------------------------------------------------- */

function ConfirmDialog({
  modal,
  setModal,
}: {
  modal: ModalState
  setModal: (m: ModalState) => void
}) {
  return (
    <Dialog open={!!modal.type} onOpenChange={() => setModal({ type: null })}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {m["admin.dialogs.confirm_action.title"]()}
          </DialogTitle>
          <DialogDescription>
            {m["admin.dialogs.confirm_action.description"]()}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => setModal({ type: null })}>
            {m["admin.dialogs.confirm_action.cancel"]()}
          </Button>
          <Button onClick={() => setModal({ type: null })}>
            {m["admin.dialogs.confirm_action.confirm"]()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
