import { AlertTriangle } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog"
import { Button } from "../ui/button"
import { 
    "components.credentials.modal.delete.title" as components_credentials_modal_delete_title,
    "components.credentials.modal.delete.description" as components_credentials_modal_delete_description,
    "common.cancel" as common_cancel,
    "common.confirm" as common_confirm
} from "@/paraglide/messages.js";

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
                        {components_credentials_modal_delete_title()}
                    </DialogTitle>

                    <DialogDescription className="pt-1">
                        {components_credentials_modal_delete_description()}
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter className="flex justify-end gap-2">
                    <Button
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() => setModal({ credentialId: null })}
                    >
                        {common_cancel()}
                    </Button>

                    <Button
                        variant="destructive"
                        className="cursor-pointer"
                        onClick={() => {
                            if (modal.credentialId) onDeleteCredential(modal.credentialId)
                            setModal({ credentialId: null })
                        }}
                    >
                        {common_confirm()}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}