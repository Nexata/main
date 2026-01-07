import { AlertTriangle } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog"
import { Button } from "../ui/button"
import * as m from "@/paraglide/messages.js"

type DeleteModalState = {
  credentialId: string | null
}

export function ConfirmDeleteCredentialModal({
    modal,
    setModal,
    onDeleteCredential,
}: {
    modal: DeleteModalState
    setModal: (m: DeleteModalState) => void
    onDeleteCredential: (id: string) => void
}) {
    if (!modal.credentialId) return null

    return (
        <Dialog open={!!modal.credentialId} onOpenChange={() => setModal({ credentialId: null })}>
            <DialogContent>
                <DialogHeader>
                    {/* Title with danger icon */}
                    <DialogTitle className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full">
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                        </span>
                        {m["components.credentials.modal.delete.title"]()}
                    </DialogTitle>

                    <DialogDescription className="pt-1">
                        {m["components.credentials.modal.delete.description"]()}
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter className="flex justify-end gap-2">
                    <Button
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() => setModal({ credentialId: null })}
                    >
                        {m["common.cancel"]()}
                    </Button>

                    <Button
                        variant="destructive"
                        className="cursor-pointer"
                        onClick={() => {
                            if (modal.credentialId) onDeleteCredential(modal.credentialId)
                            setModal({ credentialId: null })
                        }}
                    >
                        {m["common.confirm"]()}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}