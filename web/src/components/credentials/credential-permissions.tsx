import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import UserInput from "@/components/user-input/user-input"
import { AsyncConfirmButton } from "@/components/async-confirm-button/async-confirm-button"
import { deleteCredentialPermission, listCredentials, updateCredentialPermission } from "@/lib/credential"
import { infoToast } from "@/components/info-toast/info-toast"
import type { CredentialItem } from '@/lib/credential';
import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    "components.credentials.permissions.remove.toast.error.description" as components_credentials_permissions_remove_toast_error_description,
    "common.delete" as common_delete,
    "components.credentials.permissions.add" as components_credentials_permissions_add,
    "components.credentials.permissions.title" as components_credentials_permissions_title,
    "components.credentials.permissions.description" as components_credentials_permissions_description,
    "components.credentials.permissions.remove.toast.error.title" as components_credentials_permissions_remove_toast_error_title,
    "components.credentials.permissions.remove.toast.success.title" as components_credentials_permissions_remove_toast_success_title,
    "components.credentials.permissions.remove.toast.success.description" as components_credentials_permissions_remove_toast_success_description,
    "components.credentials.permissions.remove.toast.loading.title" as components_credentials_permissions_remove_toast_loading_title,
  "components.credentials.permissions.remove.toast.loading.description" as components_credentials_permissions_remove_toast_loading_description,
  "components.credentials.permissions.no_manage_description" as components_credentials_permissions_no_manage_description
} from "@/paraglide/messages.js"
import { useMe } from "@/lib/user"
import { Checkbox } from "../ui/checkbox"
import { Label } from "../ui/label"
import { AccessLevelBadge } from "./access-level-badge"

type Props = {
  credential: CredentialItem
  canManage: boolean
  onCredentialsUpdate: React.Dispatch<React.SetStateAction<CredentialItem[] | null>>
}

export function CredentialPermissions({
  credential,
  canManage,
  onCredentialsUpdate,
}: Props) {
    const [selectedUser, setSelectedUser] = useState<string | undefined>()
    const [isAdminPermission, setIsAdminPermission] = useState(false)
    const { data: me } = useMe()

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
        if (me?.id === userId) return true

        return credential.permissions.some((p) => p.id === userId)
    }

    // Adding permission
    async function handleAddPermission() {
        if (!selectedUser) return

        await updateCredentialPermission({
            credentialId: credential.id,
            userId: selectedUser,
            isAdmin: isAdminPermission,
        })

        const fresh = await listCredentials()
        onCredentialsUpdate(fresh)
        setSelectedUser(undefined)
    }

    // Deleting permission
    async function handleDeletePermission(userId: string) {
        const toastId = infoToast.loading({
            title: components_credentials_permissions_remove_toast_loading_title(),
            description: components_credentials_permissions_remove_toast_loading_description()
        })

        try {
            console.log(userId)
            await deleteCredentialPermission({credentialId: credential.id, userId: userId})
            const fresh = await listCredentials()
            onCredentialsUpdate(fresh)

            infoToast.success(toastId, {
                title: components_credentials_permissions_remove_toast_success_title(),
                description: components_credentials_permissions_remove_toast_success_description()
            })
        }
        catch (error) {
            console.error(error)

            infoToast.error(toastId, {
                title: components_credentials_permissions_remove_toast_error_title(),
                description: components_credentials_permissions_remove_toast_error_description()
            })
        }
    }

    return (
        <div className="pt-4 border-t space-y-3">
            <div>
                <h4 className="text-sm font-medium">{components_credentials_permissions_title()}</h4>
                <p className="text-xs text-muted-foreground">{canManage ? components_credentials_permissions_description() : components_credentials_permissions_no_manage_description()}</p>
            </div>

            {/* Add permission */}
            {canManage && (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <UserInput value={selectedUser} onChange={setSelectedUser} />
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="admin-permission"
                        className="cursor-pointer"
                        checked={isAdminPermission}
                        onCheckedChange={(checked) => setIsAdminPermission(checked === true)}
                      />
                      <Label htmlFor="admin-permission" className="text-xs text-muted-foreground">
                        Admin
                      </Label>
                    </div>
                  </div>
                </div>

                <AsyncConfirmButton
                  size="sm"
                  variant="outline"
                  className={cn(
                    "cursor-pointer",
                    (!selectedUser || isUserAlreadyInCredential(selectedUser)) &&
                      "opacity-50 cursor-not-allowed pointer-events-none"
                  )}
                  onClick={handleAddPermission}
                >
                  {components_credentials_permissions_add()}
                </AsyncConfirmButton>
              </div>
            )}

            {/* Permissions list */}
            <div className="space-y-2">
                {credential.permissions.map((user) => (
                    <div key={user.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="h-8 w-8">
                                {user.pfpUrl && ( <AvatarImage src={user.pfpUrl} /> )}

                                <AvatarFallback
                                    className="text-xs font-medium text-white"
                                    style={{ backgroundColor: stringToColor(user.displayName ?? user.email) }}
                                >
                                    {getInitials(user)}
                                </AvatarFallback>
                            </Avatar>

                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm truncate">
                                  {user.displayName ?? user.email}
                                </span>
                                <span className="shrink-0">
                                  <AccessLevelBadge level={user.accessLevel} />
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground truncate">
                                {user.email}
                              </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {canManage && (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="cursor-pointer"
                              onClick={() => handleDeletePermission(user.id)}
                            >
                              {common_delete()}
                            </Button>
                          )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
