import { CheckCircle2, Eye, EyeOff, KeyRound, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CredentialDeleteDialog } from "@/components/dialog/security-auth/CredentialDeleteDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { validatePromptRegex } from "@/lib/credentialAutofill";
import { invoke } from "@/lib/invoke";
import type { SavedCredential } from "@/types/global";
import { CopyButton } from "./CopyButton";
import { SecretUnlockFooter } from "./SecretUnlockFooter";

interface CredentialManagementTabProps {
  onCountChange?: (count: number) => void;
  secretsUnlocked?: boolean;
  onLockSecrets?: () => void;
  onUnlockSecrets?: () => void;
}

interface CredentialEditorProps {
  entry: Partial<SavedCredential>;
  isEditing: boolean;
  passwordLoading: boolean;
  onCancel: () => void;
  onChange: (patch: Partial<SavedCredential>) => void;
  onSave: () => void;
  saveDisabled: boolean;
  t: ReturnType<typeof useTranslation>["t"];
}

function CredentialEditor({
  entry,
  isEditing,
  passwordLoading,
  onCancel,
  onChange,
  onSave,
  saveDisabled,
  t,
}: CredentialEditorProps) {
  const [showPassword, setShowPassword] = useState(false);
  const usernamePromptRegex = entry.username_prompt_regex ?? "";
  const passwordPromptRegex = entry.password_prompt_regex ?? "";
  const usernameRegexValid = validatePromptRegex(usernamePromptRegex);
  const passwordRegexValid = validatePromptRegex(passwordPromptRegex);
  const regexError = (value: string) =>
    value.trim() ? t("credentialManager.invalidRegex") : t("credentialManager.regexRequired");

  return (
    <div className="border-b bg-accent/25 p-3">
      <div className="mb-3 flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label className="text-[0.6875rem] text-muted-foreground">
            {t("credentialManager.nameLabel")}
          </Label>
          <Input
            placeholder={t("credentialManager.namePlaceholder")}
            className="h-8 text-xs"
            value={entry.name ?? ""}
            onChange={(event) => onChange({ name: event.target.value })}
            autoFocus
          />
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-6">
          <span className="text-[0.6875rem] text-muted-foreground">
            {t("credentialManager.enabled")}
          </span>
          <Switch
            size="sm"
            checked={entry.enabled ?? true}
            onCheckedChange={(enabled) => onChange({ enabled })}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <UserRound className="h-3.5 w-3.5 text-primary" />
            {t("credentialManager.usernameLabel")}
          </div>
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label className="text-[0.6875rem] text-muted-foreground">
                {t("credentialManager.promptRegexLabel")}
              </Label>
              <div className="relative">
                <Input
                  placeholder={t("credentialManager.usernameRegexPlaceholder")}
                  className="h-8 pr-8 font-mono text-[0.6875rem]"
                  value={usernamePromptRegex}
                  onChange={(event) => onChange({ username_prompt_regex: event.target.value })}
                  aria-invalid={!usernameRegexValid}
                />
                {usernameRegexValid ? (
                  <CheckCircle2 className="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-500" />
                ) : null}
              </div>
              {!usernameRegexValid ? (
                <div className="text-[0.6875rem] text-destructive">
                  {regexError(usernamePromptRegex)}
                </div>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[0.6875rem] text-muted-foreground">
                {t("credentialManager.sendValueLabel")}
              </Label>
              <Input
                placeholder={t("credentialManager.usernamePlaceholder")}
                className="h-8 text-xs"
                value={entry.username ?? ""}
                onChange={(event) => onChange({ username: event.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <KeyRound className="h-3.5 w-3.5 text-primary" />
            {t("credentialManager.passwordLabel")}
          </div>
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label className="text-[0.6875rem] text-muted-foreground">
                {t("credentialManager.promptRegexLabel")}
              </Label>
              <div className="relative">
                <Input
                  placeholder={t("credentialManager.passwordRegexPlaceholder")}
                  className="h-8 pr-8 font-mono text-[0.6875rem]"
                  value={passwordPromptRegex}
                  onChange={(event) => onChange({ password_prompt_regex: event.target.value })}
                  aria-invalid={!passwordRegexValid}
                />
                {passwordRegexValid ? (
                  <CheckCircle2 className="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-500" />
                ) : null}
              </div>
              {!passwordRegexValid ? (
                <div className="text-[0.6875rem] text-destructive">
                  {regexError(passwordPromptRegex)}
                </div>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[0.6875rem] text-muted-foreground">
                {t("credentialManager.sendValueLabel")}
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={
                    passwordLoading
                      ? t("common.loading")
                      : isEditing && entry.has_password
                        ? t("credentialManager.passwordUnchanged")
                        : t("credentialManager.passwordPlaceholder")
                  }
                  className="h-8 pr-8 text-xs"
                  value={entry.password ?? ""}
                  onChange={(event) => onChange({ password: event.target.value })}
                  disabled={passwordLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-0.5 right-0.5 h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((value) => !value)}
                  disabled={passwordLoading}
                  aria-label={
                    showPassword
                      ? t("credentialManager.hidePassword")
                      : t("credentialManager.showPassword")
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-end gap-1.5">
        <Button variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button size="sm" className="h-7 px-3 text-xs" onClick={onSave} disabled={saveDisabled}>
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}

export function CredentialManagementTab({
  onCountChange,
  secretsUnlocked = false,
  onLockSecrets,
  onUnlockSecrets,
}: CredentialManagementTabProps) {
  const { t } = useTranslation();
  const [credentials, setCredentials] = useState<SavedCredential[]>([]);
  const [passwordCache, setPasswordCache] = useState<Record<string, string>>({});
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [revealLoadingIds, setRevealLoadingIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEntry, setEditEntry] = useState<Partial<SavedCredential>>({});
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<SavedCredential | null>(null);
  const editRequestRef = useRef(0);

  const loadCredentials = useCallback(async () => {
    try {
      const result = await invoke<SavedCredential[]>("get_saved_credentials");
      setCredentials(result);
      onCountChange?.(result.length);
    } catch {
      /* ignore */
    }
  }, [onCountChange]);

  useEffect(() => {
    void loadCredentials();
  }, [loadCredentials]);

  useEffect(() => {
    if (!secretsUnlocked) {
      setPasswordCache({});
      setRevealedIds(new Set());
      setRevealLoadingIds(new Set());
    }
  }, [secretsUnlocked]);

  const handleToggleReveal = useCallback(
    async (id: string) => {
      if (revealedIds.has(id)) {
        setRevealedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        return;
      }

      if (id in passwordCache) {
        setRevealedIds((prev) => new Set(prev).add(id));
        return;
      }

      setRevealLoadingIds((prev) => new Set(prev).add(id));
      try {
        const value = await invoke<string | null>("get_saved_credential_password", { id });
        setPasswordCache((prev) => ({ ...prev, [id]: value ?? "" }));
        setRevealedIds((prev) => new Set(prev).add(id));
      } catch {
        setPasswordCache((prev) => ({ ...prev, [id]: "" }));
        setRevealedIds((prev) => new Set(prev).add(id));
      } finally {
        setRevealLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [revealedIds, passwordCache],
  );

  const resetEdit = useCallback(() => {
    editRequestRef.current += 1;
    setEditingId(null);
    setEditEntry({});
    setPasswordLoading(false);
    setIsNew(false);
  }, []);

  const handleAdd = useCallback(() => {
    resetEdit();
    setEditingId("__new__");
    setEditEntry({ enabled: true, username_prompt_regex: "", password_prompt_regex: "" });
    setIsNew(true);
  }, [resetEdit]);

  const handleEdit = useCallback(async (entry: SavedCredential) => {
    const requestId = ++editRequestRef.current;
    setEditingId(entry.id);
    setEditEntry({ ...entry, password: "" });
    setPasswordLoading(true);
    setIsNew(false);

    try {
      const password = await invoke<string | null>("get_saved_credential_password", {
        id: entry.id,
      });
      if (editRequestRef.current !== requestId) return;
      setEditEntry((prev) => ({ ...prev, password: password ?? "" }));
    } catch {
      if (editRequestRef.current !== requestId) return;
      setEditEntry((prev) => ({ ...prev, password: "" }));
    } finally {
      if (editRequestRef.current === requestId) {
        setPasswordLoading(false);
      }
    }
  }, []);

  const handleChange = useCallback((patch: Partial<SavedCredential>) => {
    setEditEntry((prev) => ({ ...prev, ...patch }));
  }, []);

  const regexValid =
    validatePromptRegex(editEntry.username_prompt_regex ?? "") &&
    validatePromptRegex(editEntry.password_prompt_regex ?? "");

  const saveDisabled =
    passwordLoading ||
    !editEntry.name?.trim() ||
    !editEntry.username?.trim() ||
    (isNew && !editEntry.password) ||
    !regexValid;

  const handleSave = useCallback(async () => {
    if (saveDisabled) return;

    try {
      await invoke("save_credential", {
        entry: {
          enabled: editEntry.enabled ?? true,
          id: isNew ? "" : editingId,
          name: editEntry.name?.trim() ?? "",
          password: editEntry.password || undefined,
          password_prompt_regex: editEntry.password_prompt_regex?.trim() || null,
          username: editEntry.username?.trim() ?? "",
          username_prompt_regex: editEntry.username_prompt_regex?.trim() || null,
        },
      });
      resetEdit();
      await loadCredentials();
    } catch {
      /* ignore */
    }
  }, [editEntry, editingId, isNew, loadCredentials, resetEdit, saveDisabled]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingEntry) return;
    try {
      await invoke("delete_credential", { id: deletingEntry.id });
      await loadCredentials();
    } catch {
      /* ignore */
    }
    setDeletingEntry(null);
  }, [deletingEntry, loadCredentials]);

  const actionsDisabled = editingId !== null;
  const lockedHint = !secretsUnlocked ? t("secretUnlock.lockedActionHint") : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 terminal-scroll">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">{t("credentialManager.title")}</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-primary"
              onClick={handleAdd}
              disabled={actionsDisabled}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("credentialManager.add")}
            </Button>
          </div>

          <div className="overflow-hidden rounded-md border">
            {isNew && editingId === "__new__" ? (
              <CredentialEditor
                entry={editEntry}
                isEditing={false}
                passwordLoading={passwordLoading}
                onCancel={resetEdit}
                onChange={handleChange}
                onSave={handleSave}
                saveDisabled={saveDisabled}
                t={t}
              />
            ) : null}

            {credentials.map((entry) => (
              <div key={entry.id}>
                {editingId === entry.id && !isNew ? (
                  <CredentialEditor
                    entry={editEntry}
                    isEditing={true}
                    passwordLoading={passwordLoading}
                    onCancel={resetEdit}
                    onChange={handleChange}
                    onSave={handleSave}
                    saveDisabled={saveDisabled}
                    t={t}
                  />
                ) : (
                  <div className="flex items-center gap-1.5 border-b px-3 py-2.5 transition-colors last:border-0 hover:bg-accent">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs">{entry.name}</span>
                        {!entry.enabled ? (
                          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">
                            {t("credentialManager.disabled")}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex items-start gap-0.5">
                        <span className="min-w-0 select-text break-all text-[0.6875rem] text-muted-foreground">
                          {entry.username}
                        </span>
                        {entry.username ? (
                          <CopyButton value={entry.username} />
                        ) : null}
                      </div>
                      {revealedIds.has(entry.id) ? (
                        <div className="mt-1 flex items-start gap-0.5">
                          <span className="min-w-0 select-text break-all font-mono text-[0.6875rem] text-muted-foreground">
                            {passwordCache[entry.id] || t("secretUnlock.emptySecret")}
                          </span>
                          {passwordCache[entry.id] ? (
                            <CopyButton value={passwordCache[entry.id]} />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => void handleToggleReveal(entry.id)}
                              disabled={
                                !secretsUnlocked ||
                                actionsDisabled ||
                                revealLoadingIds.has(entry.id)
                              }
                              aria-label={
                                revealedIds.has(entry.id)
                                  ? t("credentialManager.hidePassword")
                                  : t("credentialManager.showPassword")
                              }
                            >
                              {revealedIds.has(entry.id) ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {lockedHint ??
                            (revealedIds.has(entry.id)
                              ? t("credentialManager.hidePassword")
                              : t("credentialManager.showPassword"))}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                void handleEdit(entry);
                              }}
                              disabled={!secretsUnlocked || actionsDisabled}
                              aria-label={t("common.edit")}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {lockedHint ?? t("common.edit")}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => setDeletingEntry(entry)}
                              disabled={!secretsUnlocked || actionsDisabled}
                              aria-label={t("common.delete")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {lockedHint ?? t("common.delete")}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {credentials.length === 0 && !isNew ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                {t("credentialManager.noCredentials")}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <SecretUnlockFooter
        unlocked={secretsUnlocked}
        onLock={onLockSecrets ?? (() => {})}
        onUnlocked={onUnlockSecrets ?? (() => {})}
      />

      <CredentialDeleteDialog
        entry={deletingEntry}
        onOpenChange={(open) => !open && setDeletingEntry(null)}
        onCancel={() => setDeletingEntry(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
