import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import UserInput from "@/components/user-input/user-input"
import { AsyncConfirmButton } from "@/components/async-confirm-button/async-confirm-button"
import { deleteCredentialPermission, listCredentials, updateCredentialPermission } from "@/lib/credential"
import { infoToast } from "@/components/info-toast/info-toast"
import { getIsAdmin, getUserId } from "@/lib/auth"
import type { DisplayCredential } from "@api/utils/credential"
import * as m from "@/paraglide/messages.js"
import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type Props = {
  credential: DisplayCredential
  onCredentialsUpdate: React.Dispatch<React.SetStateAction<DisplayCredential[] | null>>
}

export function CredentialPermissions({
  credential,
  onCredentialsUpdate,
}: Props) {
    const [selectedUser, setSelectedUser] = useState<string | undefined>()

    const canManageCredential = getIsAdmin() || credential.canAdmin === true

    // Utility to generate a color from a string
    function stringToColor(str: string) {
        let hash = 0
        for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
        return `hsl(${Math.abs(hash) % 360}, 65%, 55%)`
    }

    // Utility to get initials from a user
    function getInitials(user: { displayName: string | null; email: string }) {
        if (user.displayName) {
            return user.displayName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()
        }

        return user.email.slice(0, 2).toUpperCase()
    }

    // Check if user is already in credential permissions
    function isUserAlreadyInCredential(userId?: string) {
        if (!userId) return false
        if (credential.ownedBy.id === userId) return true
        if (getUserId() === userId) return true

        return credential.permissions.some((p) => p.id === userId)
    }

    // Adding permission
    async function handleAddPermission() {
        if (!selectedUser) return

        await updateCredentialPermission({
            credentialId: credential.id,
            userId: selectedUser,
            isAdmin: false,
        })

        const fresh = await listCredentials()
        onCredentialsUpdate(fresh)
        setSelectedUser(undefined)
    }

    // Deleting permission
    async function handleDeletePermission(userId: string) {
        const toastId = infoToast.loading({
            title: m["components.credentials.permissions.remove.toast.loading.title"](),
            description: m["components.credentials.permissions.remove.toast.loading.description"]()
        })

        try {
            await deleteCredentialPermission({credentialId: credential.id, userId})
            const fresh = await listCredentials()
            onCredentialsUpdate(fresh)

            infoToast.success(toastId, {
                title: m["components.credentials.permissions.remove.toast.success.title"](),
                description:m["components.credentials.permissions.remove.toast.success.description"]()
            })
        } 
        catch (error) {
            console.error(error)

            infoToast.error(toastId, {
                title: m["components.credentials.permissions.remove.toast.error.title"](),
                description: m["components.credentials.permissions.remove.toast.error.description"]()
            })
        }
    }

    if (!canManageCredential) return null

    return (
        <div className="pt-4 border-t space-y-3">
            <div>
                <h4 className="text-sm font-medium">{m["components.credentials.permissions.title"]()}</h4>
                <p className="text-xs text-muted-foreground">{m["components.credentials.permissions.description"]()}</p>
            </div>

            {/* Add permission */}
            <div className="flex items-center gap-2">
                <div className="flex-1">
                    <UserInput
                        value={selectedUser}
                        onChange={setSelectedUser}
                    />
                </div>

                <AsyncConfirmButton
                    size="sm"
                    variant="outline"
                    className={cn("cursor-pointer",
                        (!selectedUser || isUserAlreadyInCredential(selectedUser)) &&
                        "opacity-50 cursor-not-allowed pointer-events-none"
                    )}
                    onClick={handleAddPermission}
                >
                    {m["components.credentials.permissions.add"]()}
                </AsyncConfirmButton>
            </div>

            {/* Permissions list */}
            <div className="space-y-2">
                {credential.permissions.map((user) => (
                    <div key={user.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="h-8 w-8">
                                {user.pfpUrl && ( <AvatarImage src={user.pfpUrl} /> )}

                                <AvatarFallback
                                    className="text-xs font-medium text-white"
                                    style={{ backgroundColor: stringToColor( user.displayName ?? user.email) }}
                                >
                                    {getInitials(user)}
                                </AvatarFallback>
                            </Avatar>

                            <div className="flex flex-col min-w-0">
                                <span className="text-sm truncate">{user.displayName ?? user.email}</span>
                                <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {user.isAdminOfCredential && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                    {m["components.credentials.permissions.admin_badge"]()}
                                </span>
                            )}

                            <Button
                                size="sm"
                                variant="destructive"
                                className="cursor-pointer"
                                onClick={() => handleDeletePermission(user.id)}
                            >
                                {m["common.delete"]()}
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
