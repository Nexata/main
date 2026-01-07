import { getDropboxCredentialUrl, getGoogleCredentialUrl } from "@/lib/oauth"
import { OauthProvider, OauthScope } from "@api/schema/credential"
import type { DisplayCredential } from "@api/utils/credential"

export type SourceConfig = {
    id: string
    provider: OauthProvider
    name: string
    icon: string
    scope: OauthScope
    connect: () => string
    kind: "dynamic" | "storage"
    getFileTree?: (credentialId: string) => Promise<unknown>
}

export function credentialsBySource(
    source: SourceConfig,
    credentials: DisplayCredential[]
): DisplayCredential[] {
    return credentials.filter(
    (cred) =>
        cred.provider === source.provider &&
        cred.scopes.includes(source.scope)
    )
}

export const DINAMIC_DATA_SOURCES: SourceConfig[] = [
    {
        id: "gmail",
        provider: OauthProvider.GOOGLE,
        name: "Gmail",
        icon: "/datasource_icons/gmail.png",
        scope: OauthScope.GMAIL,
        connect: () => getGoogleCredentialUrl("gmail"),
        kind: "dynamic"
    },
    {
        id: "gcalendar",
        provider: OauthProvider.GOOGLE,
        name: "Google Calendar",
        icon: "/datasource_icons/gcalendar.png",
        scope: OauthScope.CALENDAR,
        connect: () => getGoogleCredentialUrl("calendar"),
        kind: "dynamic"
    },
    {   
        id: "outlook",
        provider: OauthProvider.MICROSOFT,
        name: "Outlook",
        icon: "/datasource_icons/outlook.png",
        scope: OauthScope.OUTLOOK,
        connect: () => "",
        kind: "dynamic"
    },
    {
        id: "outlook_calendar",
        provider: OauthProvider.MICROSOFT,
        name: "Outlook Calendar",
        icon: "/datasource_icons/ocalendar.png",
        scope: OauthScope.OUTLOOK_CALENDAR,
        connect: () => "",
        kind: "dynamic"
    },
]

export const STORAGE_DATA_SOURCES: SourceConfig[] = [
    {
        id: "drive",
        provider: OauthProvider.GOOGLE,
        name: "Google Drive",
        icon: "/datasource_icons/gdrive.png",
        scope: OauthScope.DRIVE,
        connect: () => getGoogleCredentialUrl("drive"),
        kind: "storage",
        getFileTree: async (credentialId) => {return []}
    },
    {
        id: "dropbox",
        provider: OauthProvider.DROPBOX,
        name: "Dropbox",
        icon: "/datasource_icons/dropbox.png",
        scope: OauthScope.DROPBOX,
        connect: () => getDropboxCredentialUrl(),
        kind: "storage",
        getFileTree: async (credentialId) => {return []}
    },
    {   
        id: "onedrive",
        provider: OauthProvider.MICROSOFT,
        name: "OneDrive",
        icon: "/datasource_icons/onedrive.png",
        scope: OauthScope.ONE_DRIVE,
        connect: () => "",
        kind: "storage",
        getFileTree: async (credentialId) => {return []}
    }
]

