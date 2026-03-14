import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  "chat.edit.confirm_title" as chat_edit_confirm_title,
  "chat.edit.confirm_description" as chat_edit_confirm_description,
  "chat.edit.confirm_action" as chat_edit_confirm_action,
  "chat.edit.cancel" as chat_edit_cancel,
} from "@/paraglide/messages.js";

interface EditConfirmModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function EditConfirmModal({
  open,
  onCancel,
  onConfirm,
}: EditConfirmModalProps) {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{chat_edit_confirm_title()}</DialogTitle>
          <DialogDescription>
            {chat_edit_confirm_description()}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            {chat_edit_cancel()}
          </Button>
          <Button variant="default" onClick={onConfirm}>
            {chat_edit_confirm_action()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
