import { AnimatePresence, motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import * as m from "@/paraglide/messages.js"
import { CredentialPermissions } from "@/components/credentials/credential-permissions"
import type { DisplayCredential } from "@api/utils/credential"

type Props = {
  credential: DisplayCredential
  expanded: boolean
  onToggle: () => void
  canManage: boolean
  onDelete: (id: string) => void
  onCredentialsUpdate: React.Dispatch<React.SetStateAction<DisplayCredential[] | null>>
}

export function CredentialDetailsRow({
    credential,
    expanded,
    onToggle,
    canManage,
    onDelete,
    onCredentialsUpdate,
}: Props) {

    // Utility to generate a color from a string
    function stringToColor(str: string) {
        let hash = 0
        for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash) }
        return `hsl(${Math.abs(hash) % 360}, 65%, 55%)`
    }

    return (
        <div className="rounded-md border border-border bg-[var(--card)] overflow-hidden">
            {/* Row */}
            <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors gap-2">
                {/* Owner */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {credential.ownedBy.pfpUrl ? (
                        <img
                            src={credential.ownedBy.pfpUrl}
                            alt={credential.ownedBy.displayName ?? credential.ownedBy.email}
                            className="h-6 w-6 rounded-full object-cover"
                        />
                    ) : (
                        <div
                            className="h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                            style={{ backgroundColor: stringToColor(credential.ownedBy.displayName ?? credential.ownedBy.email)}}
                        >
                            {(credential.ownedBy.displayName ?? credential.ownedBy.email)[0]?.toUpperCase()}
                        </div>
                    )}

                    <span className="text-sm font-medium truncate">{credential.ownedBy.displayName ?? credential.ownedBy.email}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="ghost"
                        className="cursor-pointer"
                        onClick={onToggle}
                    >
                        {expanded ? m["common.collapse"]() : m["common.expand"]()}
                    </Button>

                    <Button
                        size="sm"
                        variant="destructive"
                        disabled={!canManage}
                        className={cn("cursor-pointer", !canManage && "opacity-50 cursor-not-allowed")}
                        onClick={() => {
                            if (!canManage) return
                            onDelete(credential.id)
                        }}
                    >
                        {m["common.delete"]()}
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
                        <div className="space-y-4 text-sm">
                            {/* Basic info */}
                            <div className="divide-y divide-border">
                                <DetailItem label={m["common.account"]()} value={credential.email} />
                                <DetailItem label={m["common.created_at"]()} value={new Date(credential.createdAt).toLocaleDateString()} />
                            </div>

                            {/* Permissions */}
                            {canManage && (
                                <CredentialPermissions
                                    credential={credential}
                                    onCredentialsUpdate={onCredentialsUpdate}
                                />
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}
