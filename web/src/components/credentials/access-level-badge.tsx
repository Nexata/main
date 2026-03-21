import { Badge } from "@/components/ui/badge"
import type { CredentialItem } from "@/lib/credential"
import {
  Globe,
  ShieldCheck,
  Eye,
  Crown,
} from "lucide-react"
import {
  "components.credentials.permissions.tenant_admin" as components_credentials_permissions_tenant_admin,
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
          className="gap-1 text-blue-600/70 bg-blue-50/50 border border-blue-100"
        >
          <Globe className="h-3 w-3" />
          Global
        </Badge>
      )

    case "admin":
      return (
        <Badge
          variant="secondary"
          className="gap-1 text-green-600/70 bg-green-50/50 border border-green-100"
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
          className="gap-1 text-amber-600/70 bg-amber-50/50 border border-amber-100"
        >
          <Crown className="h-3 w-3" />
          {components_credentials_permissions_tenant_admin()}
        </Badge>
      )

    default:
      return null
  }
}
