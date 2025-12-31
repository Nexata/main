import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import * as m from "@/paraglide/messages.js"

import {
  Settings,
  ArrowLeft,
  Trash2,
  TrendingUp,
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
            <Button
            variant="secondary"
            onClick={() => navigate({ to: "/settings" })}
            className="
                cursor-pointer
                bg-secondary
                text-secondary-foreground
                border border-border
                hover:bg-muted
                hover:text-foreground
                hover:shadow-sm
                transition-all
            "
            >
            <Settings className="h-4 w-4 mr-2 opacity-80" />
            {m["admin.header.personal_panel"]()}
            </Button>


            <Button
            variant="outline"
            onClick={() => navigate({ to: "/chat" })}
            className="
                cursor-pointer
                hover:bg-muted
                transition-colors
            "
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
      <CardContent className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
            <div>
                <h2 className="text-lg font-semibold">
                    {m["admin.company_overview.title"]()}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {m["admin.company_overview.description"]()}
                </p>
            </div>

            {/* Company logo */}
            <img
                src="/company_logo.png"
                alt="Company logo"
                className="h-8 w-auto opacity-80"
            />
        </div>

        {/* Message balance */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>{m["admin.company_overview.message_balance"]()}</span>
            <span className="font-medium text-primary">
              {used} / {total}
            </span>
          </div>

          <div className="h-3.5 rounded-full bg-muted/60 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(used / total) * 100}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="h-full rounded-full bg-primary"
            />
          </div>
        </div>

        {/* Plan + actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-sm text-muted-foreground">
              {m["admin.company_overview.current_plan"]()}
            </span>
            <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              Business 500
            </span>
          </div>

          <div className="flex gap-2">
            <Button
            size="sm"
            className="
                cursor-pointer
                bg-orange-500/90 
                hover:bg-orange-500 
                text-white
            "
            >
            <TrendingUp className="h-4 w-4 mr-2" />
                {m["admin.company_overview.upgrade_plan"]()}
            </Button>

            <Button
            size="sm"
            variant="outline"
            className="cursor-pointer"
            >
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

    function ChartTooltip({ active, payload, label }: any) {
        if (!active || !payload?.length) return null

        return (
            <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-medium text-foreground">
                {payload[0].value} mensajes
            </p>
            </div>
        )
    }

    function MetricItem({ label, value }: { label: string; value: string }) {
        return (
            <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold text-foreground">
                {value}
            </p>
            </div>
        )
    }


  return (
    <Card className="bg-[var(--sidebar)]">
      <CardContent className="p-6 space-y-4">
        <div className="flex justify-between items-center">
            <div>
                <h2 className="text-lg font-semibold">
                    {m["admin.usage.title"]()}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {m["admin.usage.description"]()}
                </p>
            </div>

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

        <div className="h-56 rounded-xl border border-border bg-muted/40 p-3">
            <ResponsiveContainer width="100%" height="100%">
                {type === "bars" ? (
                <BarChart data={data}>
                    <XAxis
                    dataKey="name"
                    stroke="var(--muted-foreground)"
                    tickLine={false}
                    axisLine={false}
                    />
                    <YAxis
                    stroke="var(--muted-foreground)"
                    tickLine={false}
                    axisLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={false} />
                    <Bar
                    dataKey="mensajes"
                    fill="var(--primary)"
                    radius={6}
                    activeBar={{
                        fill: "var(--primary)",
                        opacity: 1,
                        stroke: "var(--primary)",
                        strokeWidth: 1,
                    }}
                    />
                </BarChart>
                ) : (
                <LineChart data={data}>
                    <XAxis
                    dataKey="name"
                    stroke="var(--muted-foreground)"
                    tickLine={false}
                    axisLine={false}
                    />
                    <YAxis
                    stroke="var(--muted-foreground)"
                    tickLine={false}
                    axisLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={false} />
                    <Line
                    type="monotone"
                    dataKey="mensajes"
                    stroke="var(--primary)"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "var(--primary)", opacity: 0.6 }}
                    activeDot={{
                        r: 6,
                        fill: "var(--primary)",
                        stroke: "var(--background)",
                        strokeWidth: 2,
                    }}
                    />
                </LineChart>
                )}
            </ResponsiveContainer>
        </div>
        {/* Extra info */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 place-items-center rounded-xl border border-border bg-muted/30 p-4">
            <MetricItem
                label="Total de mensajes"
                value="430"
            />

            <MetricItem
                label="Usuario más activo"
                value="Ana"
            />

            <MetricItem
                label="Pico máximo"
                value="150"
            />

            <MetricItem
                label="Hora mas activa"
                value="10AM - 11AM"
            />
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
