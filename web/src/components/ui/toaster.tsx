import { ToastProvider } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, ...props }) => (
        <Toast key={id} {...props}>
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && (
              <ToastDescription>{description}</ToastDescription>
            )}
          </div>
          {action}
          <ToastClose />
        </Toast>
      ))}

      <ToastViewport
        className="
          fixed
          bottom-6
          right-6
          z-[100]
          flex
          max-h-screen
          w-full
          max-w-sm
          flex-col
          gap-2
          outline-none
        "
      />
    </ToastProvider>
  )
}
