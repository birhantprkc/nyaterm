import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import i18n from "../i18n";

interface ChildWindowOptions {
  label: string;
  title: string;
  url: string;
  width?: number;
  height?: number;
  alwaysOnTop?: boolean;
  resizable?: boolean;
}

export async function openChildWindow(opts: ChildWindowOptions) {
  const existing = await WebviewWindow.getByLabel(opts.label);
  if (existing) {
    await existing.setTitle(opts.title).catch(() => { });
    await existing.setFocus();
    return existing;
  }
  return new WebviewWindow(opts.label, {
    url: opts.url,
    title: opts.title,
    width: opts.width ?? 720,
    height: opts.height ?? 560,
    visible: false,
    center: true,
    resizable: opts.resizable ?? true,
    alwaysOnTop: opts.alwaysOnTop ?? false,
  });
}

export function openSettings(tab?: string) {
  const url = tab ? `index.html?window=settings&tab=${encodeURIComponent(tab)}` : "index.html?window=settings";
  return openChildWindow({
    label: "settings",
    title: i18n.t("settings.title"),
    url,
    width: 800,
    height: 560,
  });
}

export function openNewSession(editId?: string, autoConnect?: boolean) {
  let url = editId
    ? `index.html?window=new-session&edit=${encodeURIComponent(editId)}`
    : "index.html?window=new-session";
  if (autoConnect) url += "&autoConnect=1";
  return openChildWindow({
    label: "new-session",
    title: i18n.t(editId ? "dialog.editConnection" : "dialog.newConnection"),
    url,
    width: 520,
    height: 620,
  });
}

export function openQuickCommand(editJson?: string) {
  const url = editJson
    ? `index.html?window=quick-command&data=${encodeURIComponent(editJson)}`
    : "index.html?window=quick-command";
  return openChildWindow({
    label: "quick-command",
    title: i18n.t(editJson ? "quickCommands.editCommand" : "quickCommands.addCommand"),
    url,
    width: 540,
    height: 640,
  });
}

export function openAutoUpload(data: { sessionId: string; localPath: string; remotePath: string }) {
  // Use a unique label for each upload dialog so multiple files modifying simultaneously don't conflict
  // We use the local path base64 (or just random) to make it unique per file
  const safePath = btoa(encodeURIComponent(data.localPath)).replace(/[^a-zA-Z0-9]/g, "");
  const label = `auto-upload-${safePath}`;
  const url = `index.html?window=auto-upload&data=${encodeURIComponent(JSON.stringify(data))}`;
  return openChildWindow({
    label,
    title: i18n.t("fileExplorer.fileModified"),
    url,
    width: 440,
    height: 240,
    resizable: false,
    alwaysOnTop: true,
  });
}
