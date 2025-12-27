import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import * as m from "@/paraglide/messages.js";

interface DeleteChatModalProps {
  open: boolean;
  chatTitle?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteChatModal({
  open,
  chatTitle,
  onCancel,
  onConfirm,
}: DeleteChatModalProps) {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{m["sidebar.delete_chat_title"]()}</DialogTitle>
          <DialogDescription>
            {m["sidebar.delete_chat_desc"]({ title: chatTitle || "" })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            {m["common.cancel"]()}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {m["common.delete"]()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
