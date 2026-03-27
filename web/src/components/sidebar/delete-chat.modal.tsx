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
  "sidebar.delete_chat_desc" as sidebar_delete_chat_desc,
  "sidebar.delete_chat_title" as sidebar_delete_chat_title,
  "sidebar.delete_chats_title" as sidebar_delete_chats_title,
  "sidebar.delete_chats_desc" as sidebar_delete_chats_desc,
  "common.cancel" as common_cancel,
  "common.delete" as common_delete
} from "@/paraglide/messages.js";

interface DeleteChatModalProps {
  open: boolean;
  chatTitle?: string | null | undefined;
  bulkCount?: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteChatModal({
  open,
  chatTitle,
  bulkCount,
  onCancel,
  onConfirm,
}: DeleteChatModalProps) {
  const isBulk = bulkCount !== undefined && bulkCount > 1;

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isBulk
              ? sidebar_delete_chats_title({ count: String(bulkCount) })
              : sidebar_delete_chat_title()}
          </DialogTitle>
          <DialogDescription>
            {isBulk
              ? sidebar_delete_chats_desc({ count: String(bulkCount) })
              : sidebar_delete_chat_desc({ title: chatTitle || "" })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            {common_cancel()}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {common_delete()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
