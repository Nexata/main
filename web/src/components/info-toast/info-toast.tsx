import { toast } from "@/hooks/use-toast"
import { Loader2, CheckCircle2, XCircle, Info } from "lucide-react"

type ToastId = string | number

type BaseOptions = {
    title?: string
    description?: string
}

const baseToastClass = "group relative flex gap-3 rounded-xl border bg-card/95 backdrop-blur-md px-4 py-3 shadow-lg transition-all"

export const infoToast = {
    loading(options: BaseOptions): ToastId {
        return toast({
            title: options.title ?? "Procesando",
            description: (
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm">{options.description ?? "Por favor espera…"}</span>
                </div>
            ),
            duration: Infinity,
            className: `${baseToastClass} border-border`
        })
    },

    success(toastId: ToastId, options: BaseOptions) {
        toast({
            id: toastId,
            title: options.title ?? "Completado",
            description: (
                <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
                    <span className="text-sm text-foreground">{options.description ?? "La operación fue exitosa"}</span>
                </div>
            ),
            duration: 3000,
            className: `
                ${baseToastClass}
                border-emerald-500/30
                shadow-[0_0_0_1px_theme(colors.emerald.500/0.15)]
            `
        })
    },

    info(toastId: ToastId, options: BaseOptions) {
        toast({
            id: toastId,
            title: options.title ?? "Información",
            description: (
                <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                    <span className="text-sm text-foreground">{options.description ?? "No se realizaron cambios"}</span>
                </div>
            ),
            duration: 3000,
            className: `
                ${baseToastClass}
                border-blue-500/30
                shadow-[0_0_0_1px_theme(colors.blue.500/0.15)]
            `
        })
    },

    error(toastId: ToastId, options: BaseOptions) {
        toast({
            id: toastId,
            title: options.title ?? "Error",
            description: (
                <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm text-foreground">{options.description ?? "Algo salió mal"}</span>
                </div>
            ),
            duration: 4000,
            className: `
                ${baseToastClass}
                border-destructive/40
                shadow-[0_0_0_1px_hsl(var(--destructive)/0.25)]
            `
        })
    },
}
