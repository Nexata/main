import { Badge } from "@/components/ui/badge"
import type { CredentialItem } from "@/lib/credential"
import {
  Globe,
  ShieldCheck,
  Eye,
  Crown,
} from "lucide-react"
import {
  "components.credentials.permissions.tenat_admin" as components_credentials_permissions_tenat_admin,
  "components.credentials.permissions.read_only" as components_credentials_permissions_read_only
} from "@/paraglide/messages.js"

type Props = {
  level: CredentialItem["accessLevel"]
}

export function AccessLevelBadge({ level }: Props) {
  switch (level) {
    case "global":
      return (
        <Badge
          variant="secondary"
          className="gap-1 text-blue-700 bg-blue-50 border border-blue-200"
        >
          <Globe className="h-3 w-3" />
          Global
        </Badge>
      )

    case "admin":
      return (
        <Badge
          variant="secondary"
          className="gap-1 text-green-700 bg-green-50 border border-green-200"
        >
          <ShieldCheck className="h-3 w-3" />
          Admin
        </Badge>
      )

    case "read":
      return (
        <Badge
          variant="secondary"
          className="gap-1 text-muted-foreground bg-muted border"
        >
          <Eye className="h-3 w-3" />
          {components_credentials_permissions_read_only()}
        </Badge>
      )

    case "tenant-admin":
      return (
        <Badge
          variant="secondary"
          className="gap-1 text-amber-700 bg-amber-50 border border-amber-200"
        >
          <Crown className="h-3 w-3" />
          {components_credentials_permissions_tenat_admin()}
        </Badge>
      )

    default:
      return null
  }
}
