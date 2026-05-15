import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { invoke } from "@/lib/invoke";

export interface RenameDialogData {
  sessionId: string;
  oldPath: string;
  name: string;
  currentDirPath: string;
}

interface RenameDialogProps {
  data: RenameDialogData;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RenameDialog({ data, onClose, onSuccess }: RenameDialogProps) {
  const { t } = useTranslation();
  const [dialogInput, setDialogInput] = useState(data.name);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setDialogInput(data.name);
  }, [data.name]);

  const handleRenameSubmit = async () => {
    if (!dialogInput || dialogInput === data.name) {
      onClose();
      return;
    }

    try {
      setIsSubmitting(true);
      const newPath =
        data.currentDirPath === "/" ? `/${dialogInput}` : `${data.currentDirPath}/${dialogInput}`;
      await invoke("rename_remote_file", {
        sessionId: data.sessionId,
        oldPath: data.oldPath,
        newPath,
      });
      onSuccess();
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
          <DialogTitle className="text-sm truncate" title={t("fileExplorer.renameTo", { name: data.name })}>
            {t("fileExplorer.renameTo", { name: data.name })}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("fileExplorer.renameTo", { name: data.name })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input
            className="text-sm"
            value={dialogInput}
            onChange={(e) => setDialogInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isSubmitting && handleRenameSubmit()}
            disabled={isSubmitting}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            {t("dialog.cancel")}
          </Button>
          <Button size="sm" onClick={handleRenameSubmit} disabled={isSubmitting}>
            {isSubmitting && <MdRefresh className="text-[0.875rem] animate-spin" />}
            {t("dialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
