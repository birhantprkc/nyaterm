import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MdRefresh } from "react-icons/md";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { invoke } from "@/lib/invoke";

export interface DeleteDialogData {
  sessionId: string;
  items: DeleteDialogItem[];
}

export interface DeleteDialogItem {
  path: string;
  name: string;
}

interface DeleteDialogProps {
  data: DeleteDialogData;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DeleteDialog({ data, onClose, onSuccess }: DeleteDialogProps) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const previewItems = data.items.slice(0, 6);
  const remainingItems = data.items.length - previewItems.length;

  const handleDeleteSubmit = async () => {
    try {
      setIsSubmitting(true);

      const results = await Promise.allSettled(
        data.items.map((item) =>
          invoke("delete_remote_file", {
            sessionId: data.sessionId,
            path: item.path,
          }),
        ),
      );

      const failedCount = results.filter((result) => result.status === "rejected").length;
      const successCount = results.length - failedCount;

      if (successCount > 0) {
        onSuccess();
      }

      if (failedCount > 0) {
        toast.error(
          failedCount === 1
            ? t("fileExplorer.deleteFailedItem")
            : t("fileExplorer.deleteFailedCount", { count: failedCount }),
        );
      }

      onClose();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && !isSubmitting && onClose()}>
      <DialogContent className="w-80 sm:max-w-80">
        <DialogHeader>
          <DialogTitle className="text-sm break-words">
            {data.items.length === 1
              ? t("fileExplorer.sureDelete", { name: data.items[0]?.name ?? "" })
              : t("fileExplorer.sureDeleteMultiple", { count: data.items.length })}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("fileExplorer.cmDelete")}
          </DialogDescription>
        </DialogHeader>

        {data.items.length > 1 && (
          <div
            className="terminal-scroll max-h-40 overflow-y-auto rounded-md border px-2 py-1.5 text-xs"
            style={{ borderColor: "var(--df-border)", color: "var(--df-text-dimmed)" }}
          >
            {previewItems.map((item) => (
              <div key={item.path} className="truncate py-0.5" title={item.path}>
                {item.name}
              </div>
            ))}
            {remainingItems > 0 && (
              <div className="pt-1" style={{ color: "var(--df-text)" }}>
                {t("fileExplorer.moreItems", { count: remainingItems })}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            {t("dialog.cancel")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteSubmit}
            disabled={isSubmitting || data.items.length === 0}
            autoFocus
          >
            {isSubmitting && <MdRefresh className="mr-1 text-[0.875rem] animate-spin" />}
            {t("fileExplorer.cmDelete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
