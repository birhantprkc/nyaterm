import { invoke } from "@tauri-apps/api/core";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Group, SavedConnection } from "../../types";

interface NewSessionDialogProps {
  open: boolean;
  onClose: () => void;
  onConnect: (sessionId: string, name: string, type: "SSH" | "Local") => void;
  onSaved: () => void;
  initialData?: SavedConnection;
}

/* Shared input style using CSS variables */
const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--df-bg-input)",
  borderColor: "var(--df-border)",
  color: "var(--df-text)",
};

/** Modal for new/edit SSH connection or local terminal. Save, connect, or cancel. */
export default function NewSessionDialog({
  open,
  onClose,
  onConnect,
  onSaved,
  initialData,
}: NewSessionDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [description, setDescription] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState("root");
  const [authType, setAuthType] = useState<"password" | "key">("password");
  const [password, setPassword] = useState("");
  const [keyFilePath, setKeyFilePath] = useState("");
  const [keyFileName, setKeyFileName] = useState("");
  const [hasKeyData, setHasKeyData] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const groupRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) {
        setShowGroupDropdown(false);
        setNewGroupName("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load groups when dialog opens
  useEffect(() => {
    if (open) {
      invoke<Group[]>("get_groups")
        .then(setGroups)
        .catch(() => { });
    }
  }, [open]);

  const resetForm = useCallback(() => {
    setName("");
    setGroup("");
    setDescription("");
    setHost("");
    setPort(22);
    setUsername("root");
    setAuthType("password");
    setPassword("");
    setKeyFilePath("");
    setKeyFileName("");
    setHasKeyData(false);
    setPassphrase("");
    setError("");
    setConnecting(false);
    setSaveSuccess(false);
  }, []);

  useEffect(() => {
    if (open) {
      if (initialData) {
        setName(initialData.name);
        setGroup(initialData.group || "");
        setDescription(initialData.description || "");
        setHost(initialData.host);
        setPort(initialData.port);
        setUsername(initialData.username);
        setAuthType(initialData.auth_type as "password" | "key");
        setPassword(initialData.password || "");
        setKeyFilePath("");
        setKeyFileName("");
        setHasKeyData(initialData.has_key_data || false);
        setPassphrase(initialData.passphrase || "");
      } else {
        resetForm();
      }
    }
  }, [open, initialData, resetForm]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !connecting && !showGroupDropdown) {
        resetForm();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, connecting, showGroupDropdown, resetForm, onClose]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    if (!host) {
      setError(t("dialog.hostRequired"));
      return;
    }

    setError("");
    setSaveSuccess(false);
    setConnecting(true);

    try {
      if (group && !groups.find((g) => g.name === group)) {
        await invoke("save_group", {
          group: { id: "", name: group, sort_order: groups.length },
        });
      }

      const connection: SavedConnection = {
        id: initialData?.id || "",
        name: name || `${host}:${port}`,
        group: group || undefined,
        description: description || undefined,
        host,
        port,
        username,
        auth_type: authType,
        password: authType === "password" ? password : undefined,
        key_file_path: authType === "key" && keyFilePath ? keyFilePath : undefined,
        passphrase: authType === "key" ? passphrase || undefined : undefined,
      };

      await invoke("save_connection", { connection });
      resetForm();
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectLocal = async () => {
    setConnecting(true);
    setError("");

    try {
      const sessionId = await invoke<string>("create_local_session");
      resetForm();
      onConnect(sessionId, t("dialog.localTerminal"), "Local");
    } catch (e) {
      setError(String(e));
    } finally {
      setConnecting(false);
    }
  };

  if (!open) return null;

  const inputClass = "w-full rounded px-3 py-2 text-xs focus:outline-none border transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="rounded-lg w-[480px] shadow-2xl border"
        style={{ backgroundColor: "var(--df-bg-panel)", borderColor: "var(--df-border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: "var(--df-border)" }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--df-text)" }}>
            {initialData ? t("dialog.editConnection") : t("dialog.newConnection")}
          </h2>
          <span
            className="material-icons text-base cursor-pointer transition-opacity hover:opacity-70"
            style={{ color: "var(--df-text-muted)" }}
            onClick={handleClose}
          >
            close
          </span>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {!initialData && (
            <button
              className="w-full flex items-center gap-3 p-3 border rounded transition-colors text-left hover:opacity-90"
              style={{ backgroundColor: "var(--df-bg-hover)", borderColor: "var(--df-border)" }}
              onClick={handleConnectLocal}
              disabled={connecting}
            >
              <span className="material-icons text-xl text-cyan-400">terminal</span>
              <div>
                <div className="text-xs font-medium" style={{ color: "var(--df-text)" }}>
                  {t("dialog.localTerminal")}
                </div>
                <div className="text-[10px]" style={{ color: "var(--df-text-dimmed)" }}>
                  {t("dialog.openLocalShell")}
                </div>
              </div>
            </button>
          )}

          {!initialData && (
            <div
              className="flex items-center gap-3 text-[10px] uppercase tracking-wider"
              style={{ color: "var(--df-text-dimmed)" }}
            >
              <div className="flex-1 border-t" style={{ borderColor: "var(--df-border)" }}></div>
              <span>{t("dialog.sshConnection")}</span>
              <div className="flex-1 border-t" style={{ borderColor: "var(--df-border)" }}></div>
            </div>
          )}

          {/* Name + Group */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[11px] mb-1" style={{ color: "var(--df-text-muted)" }}>
                {t("dialog.connectionName")}
              </label>
              <input
                type="text"
                placeholder={t("dialog.serverPlaceholder")}
                className={inputClass}
                style={inputStyle}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="w-52 relative" ref={groupRef}>
              <label className="block text-[11px] mb-1" style={{ color: "var(--df-text-muted)" }}>
                {t("dialog.group")}
              </label>
              <button
                type="button"
                className="w-full flex items-center justify-between rounded px-3 py-2 text-xs text-left border transition-colors"
                style={inputStyle}
                onClick={() => setShowGroupDropdown(!showGroupDropdown)}
              >
                <span style={{ color: group ? "var(--df-text)" : "var(--df-text-dimmed)" }}>
                  {group || t("dialog.none")}
                </span>
                <span className="material-icons text-xs" style={{ color: "var(--df-text-dimmed)" }}>
                  expand_more
                </span>
              </button>
              {showGroupDropdown && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 border rounded shadow-xl z-10 overflow-hidden"
                  style={{ backgroundColor: "var(--df-bg-panel)", borderColor: "var(--df-border)" }}
                >
                  <div
                    className="px-3 py-1.5 text-xs cursor-pointer transition-colors"
                    style={{
                      backgroundColor: !group
                        ? "color-mix(in srgb, var(--df-primary) 15%, transparent)"
                        : undefined,
                      color: !group ? "var(--df-primary)" : "var(--df-text-muted)",
                    }}
                    onMouseEnter={(e) => {
                      if (group) e.currentTarget.style.backgroundColor = "var(--df-bg-hover)";
                    }}
                    onMouseLeave={(e) => {
                      if (group) e.currentTarget.style.backgroundColor = "";
                    }}
                    onClick={() => {
                      setGroup("");
                      setShowGroupDropdown(false);
                    }}
                  >
                    {t("dialog.none")}
                  </div>
                  {groups.map((g) => (
                    <div
                      key={g.id}
                      className="px-3 py-1.5 text-xs cursor-pointer transition-colors"
                      style={{
                        backgroundColor:
                          group === g.name
                            ? "color-mix(in srgb, var(--df-primary) 15%, transparent)"
                            : undefined,
                        color: group === g.name ? "var(--df-primary)" : "var(--df-text)",
                      }}
                      onMouseEnter={(e) => {
                        if (group !== g.name)
                          e.currentTarget.style.backgroundColor = "var(--df-bg-hover)";
                      }}
                      onMouseLeave={(e) => {
                        if (group !== g.name) e.currentTarget.style.backgroundColor = "";
                      }}
                      onClick={() => {
                        setGroup(g.name);
                        setShowGroupDropdown(false);
                      }}
                    >
                      {g.name}
                    </div>
                  ))}
                  <div
                    className="p-1.5 border-t"
                    style={{ borderColor: "color-mix(in srgb, var(--df-border) 60%, transparent)" }}
                  >
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder={t("dialog.newGroupPlaceholder")}
                        className="flex-1 min-w-0 rounded px-2 py-1 text-xs border focus:outline-none"
                        style={inputStyle}
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newGroupName.trim()) {
                            setGroup(newGroupName.trim());
                            setNewGroupName("");
                            setShowGroupDropdown(false);
                          }
                        }}
                      />
                      <button
                        className="flex-shrink-0 p-1 transition-colors disabled:opacity-30"
                        style={{ color: "var(--df-text-muted)" }}
                        disabled={!newGroupName.trim()}
                        onClick={() => {
                          if (newGroupName.trim()) {
                            setGroup(newGroupName.trim());
                            setNewGroupName("");
                            setShowGroupDropdown(false);
                          }
                        }}
                      >
                        <span className="material-icons text-sm">add</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Host + Port */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[11px] mb-1" style={{ color: "var(--df-text-muted)" }}>
                {t("dialog.host")}
              </label>
              <input
                type="text"
                placeholder="192.168.1.100"
                className={inputClass}
                style={inputStyle}
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
            </div>
            <div className="w-20">
              <label className="block text-[11px] mb-1" style={{ color: "var(--df-text-muted)" }}>
                {t("dialog.port")}
              </label>
              <input
                type="number"
                className={inputClass}
                style={inputStyle}
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-[11px] mb-1" style={{ color: "var(--df-text-muted)" }}>
              {t("dialog.username")}
            </label>
            <input
              type="text"
              className={inputClass}
              style={inputStyle}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          {/* Auth Type */}
          <div>
            <label className="block text-[11px] mb-1" style={{ color: "var(--df-text-muted)" }}>
              {t("dialog.authentication")}
            </label>
            <div className="flex gap-2">
              <button
                className="flex-1 py-1.5 text-xs rounded border transition-colors"
                style={{
                  backgroundColor:
                    authType === "password"
                      ? "color-mix(in srgb, var(--df-primary) 20%, transparent)"
                      : "var(--df-bg-input)",
                  borderColor: authType === "password" ? "var(--df-primary)" : "var(--df-border)",
                  color: authType === "password" ? "var(--df-primary)" : "var(--df-text-muted)",
                }}
                onClick={() => setAuthType("password")}
              >
                {t("dialog.password")}
              </button>
              <button
                className="flex-1 py-1.5 text-xs rounded border transition-colors"
                style={{
                  backgroundColor:
                    authType === "key"
                      ? "color-mix(in srgb, var(--df-primary) 20%, transparent)"
                      : "var(--df-bg-input)",
                  borderColor: authType === "key" ? "var(--df-primary)" : "var(--df-border)",
                  color: authType === "key" ? "var(--df-primary)" : "var(--df-text-muted)",
                }}
                onClick={() => setAuthType("key")}
              >
                {t("dialog.privateKey")}
              </button>
            </div>
          </div>

          {/* Password or Key File */}
          {authType === "password" ? (
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "var(--df-text-muted)" }}>
                {t("dialog.password")}
              </label>
              <input
                type="password"
                className={inputClass}
                style={inputStyle}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: "var(--df-text-muted)" }}>
                  {t("dialog.privateKey")}
                </label>
                <div
                  className="flex items-center w-full rounded border overflow-hidden transition-colors"
                  style={{
                    backgroundColor: "var(--df-bg-input)",
                    borderColor: "var(--df-border)",
                  }}
                >
                  <div
                    className="flex-1 px-3 py-2 text-xs truncate"
                    style={{
                      color: keyFileName || hasKeyData ? "var(--df-text)" : "var(--df-text-muted)",
                      opacity: keyFileName || hasKeyData ? 1 : 0.5,
                    }}
                  >
                    {keyFileName || (hasKeyData ? t("dialog.keyFileLoaded") : t("dialog.selectKeyFile"))}
                  </div>
                  <button
                    type="button"
                    className="px-3 py-2 hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex items-center justify-center border-l"
                    style={{
                      borderColor: "var(--df-border)",
                      color: "var(--df-text-muted)",
                    }}
                    onClick={async () => {
                      const selected = await openFileDialog({
                        multiple: false,
                        title: t("dialog.selectKeyFileTitle"),
                      });
                      if (selected) {
                        setKeyFilePath(selected);
                        const parts = selected.replace(/\\/g, "/").split("/");
                        setKeyFileName(parts[parts.length - 1]);
                        setHasKeyData(false);
                      }
                    }}
                  >
                    <span className="material-icons text-sm">folder_open</span>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: "var(--df-text-muted)" }}>
                  {t("dialog.passphrase")}
                </label>
                <input
                  type="password"
                  className={inputClass}
                  style={inputStyle}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Description */}
          <div>
            <label className="block text-[11px] mb-1" style={{ color: "var(--df-text-muted)" }}>
              {t("dialog.description")}
            </label>
            <textarea
              rows={2}
              placeholder={t("dialog.descriptionPlaceholder")}
              className="w-full rounded px-3 py-2 text-xs border focus:outline-none resize-none transition-colors"
              style={inputStyle}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Messages */}
          {error && (
            <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
              {error}
            </div>
          )}
          {saveSuccess && (
            <div className="p-2 bg-green-500/10 border border-green-500/30 rounded text-xs text-green-400">
              {t("dialog.connectionSaved")}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex justify-end gap-2 px-5 py-3 border-t"
          style={{ borderColor: "var(--df-border)" }}
        >
          <button
            className="px-4 py-1.5 text-xs transition-colors hover:opacity-70"
            style={{ color: "var(--df-text-muted)" }}
            onClick={handleClose}
          >
            {t("dialog.cancel")}
          </button>
          <button
            className="px-4 py-1.5 text-xs text-white rounded transition-colors disabled:opacity-50"
            style={{ backgroundColor: "var(--df-primary)" }}
            onClick={handleSave}
            disabled={connecting || !host}
          >
            {connecting ? t("dialog.saving") : t("dialog.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
