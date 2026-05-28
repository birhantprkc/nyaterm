import { emit, listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  getCurrentWindow,
  type Window as TauriWindow,
  UserAttentionType,
} from "@tauri-apps/api/window";
import i18n from "../i18n";
import { invoke } from "./invoke";
import { isMacOS } from "./platform";

interface ChildWindowOptions {
  label: string;
  title: string;
  url: string;
  width?: number;
  height?: number;
  resizable?: boolean;
}

const MAIN_WINDOW_LABEL = "main";
const AUTO_UPLOAD_WINDOW_PREFIX = "auto-upload-";
const MODAL_CHILD_LABELS = new Set(["settings", "new-session", "quick-command"]);
const CHILD_WINDOW_READY_TIMEOUT_MS = 10000;
const readyChildWindowLabels = new Set<string>();
const registeredDestroyedHandlers = new Set<string>();

void listen<{ label: string }>("child-window-ready", ({ payload }) => {
  if (isModalChildLabel(payload.label)) {
    readyChildWindowLabels.add(payload.label);
  }
});

export function isModalChildLabel(label: string) {
  return MODAL_CHILD_LABELS.has(label) || label.startsWith(AUTO_UPLOAD_WINDOW_PREFIX);
}

function needsAlwaysOnTop(label: string) {
  return label.startsWith(AUTO_UPLOAD_WINDOW_PREFIX);
}

function getChildWindowBackgroundColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--df-bg").trim() || "#0d1117";
}

async function getMainWindow() {
  return (await WebviewWindow.getByLabel(MAIN_WINDOW_LABEL)) ?? getCurrentWindow();
}

async function getOpenModalChildWindows() {
  const windows = await WebviewWindow.getAll();
  const modalWindows = windows.filter(
    (window) => window.label !== MAIN_WINDOW_LABEL && isModalChildLabel(window.label),
  );
  const visibleStates = await Promise.all(
    modalWindows.map((window) => window.isVisible().catch(() => false)),
  );
  return modalWindows.filter((_, index) => visibleStates[index]);
}

export async function getOpenModalChildWindowLabels() {
  const windows = await getOpenModalChildWindows();
  return windows.map((window) => window.label);
}

async function setMainWindowModalBlocking(mainWindow: TauriWindow, hasModalChild: boolean) {
  if (isMacOS) {
    // AppKit child windows inherit disabled/dimmed behavior from their parent window.
    await mainWindow.setEnabled(true).catch(() => {});
    await mainWindow.setFocusable(true).catch(() => {});
    return;
  }

  await mainWindow.setEnabled(!hasModalChild).catch(() => {});
  await mainWindow.setFocusable(!hasModalChild).catch(() => {});
}

async function applyModalWindowState(excludedLabel?: string) {
  const [mainWindow, modalWindows] = await Promise.all([
    getMainWindow(),
    getOpenModalChildWindows(),
  ]);
  const remainingModalWindows = excludedLabel
    ? modalWindows.filter((window) => window.label !== excludedLabel)
    : modalWindows;
  const hasModalChild = remainingModalWindows.length > 0;

  await setMainWindowModalBlocking(mainWindow, hasModalChild);

  if (hasModalChild) {
    const topModalWindow = remainingModalWindows[remainingModalWindows.length - 1];
    await topModalWindow.setAlwaysOnTop(needsAlwaysOnTop(topModalWindow.label)).catch(() => {});
    const isVisible = await topModalWindow.isVisible().catch(() => false);
    if (isVisible) {
      await topModalWindow.setFocus().catch(() => {});
    }
    return;
  }

  await mainWindow.show().catch(() => {});
  await mainWindow.setFocus().catch(() => {});
}

function attachChildWindowDestroyedHandler(label: string, win: WebviewWindow) {
  if (registeredDestroyedHandlers.has(label)) return;
  registeredDestroyedHandlers.add(label);

  win.once("tauri://destroyed", () => {
    registeredDestroyedHandlers.delete(label);
    readyChildWindowLabels.delete(label);
    emit("child-window-closed", { label });
    void prepareForModalChildClose(label);
  });
}

function waitForChildWindowReady(label: string) {
  if (readyChildWindowLabels.has(label)) return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let unlistenReady: (() => void) | undefined;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      unlistenReady?.();
      resolve(false);
    }, CHILD_WINDOW_READY_TIMEOUT_MS);

    listen<{ label: string }>("child-window-ready", ({ payload }) => {
      if (payload.label !== label || settled) return;

      settled = true;
      window.clearTimeout(timeout);
      unlistenReady?.();
      resolve(true);
    }).then((unlisten) => {
      if (settled) {
        unlisten();
        return;
      }
      unlistenReady = unlisten;
    });
  });
}

async function revealChildWindow(win: WebviewWindow, label: string) {
  const isReady = await waitForChildWindowReady(label);
  if (!isReady) {
    await win.close().catch(() => {});
    return;
  }

  await win.show().catch(() => {});
  await win.setFocus().catch(() => {});
  emit("child-window-opened", { label });
  await syncMainWindowModalState().catch(() => {});
}

export async function syncMainWindowModalState() {
  await applyModalWindowState();
}

export async function prepareForModalChildClose(closingLabel: string) {
  await applyModalWindowState(closingLabel);
}

export async function bounceTopModalWindow() {
  const modalWindows = await getOpenModalChildWindows();
  const topModalWindow = modalWindows[modalWindows.length - 1];
  if (!topModalWindow) return;

  const isVisible = await topModalWindow.isVisible().catch(() => false);
  if (!isVisible) return;

  await topModalWindow.requestUserAttention(UserAttentionType.Critical).catch(() => {});
  await topModalWindow.setAlwaysOnTop(needsAlwaysOnTop(topModalWindow.label)).catch(() => {});
  await topModalWindow.setFocus().catch(() => {});
}

export async function openChildWindow(opts: ChildWindowOptions) {
  const existing = await WebviewWindow.getByLabel(opts.label);
  if (existing) {
    await existing.setTitle(opts.title).catch(() => {});
    await existing.setAlwaysOnTop(needsAlwaysOnTop(opts.label)).catch(() => {});
    const isVisible = await existing.isVisible().catch(() => true);
    if (isVisible) {
      await existing.show().catch(() => {});
      await existing.setFocus().catch(() => {});
      emit("child-window-opened", { label: opts.label });
      await syncMainWindowModalState().catch(() => {});
    } else {
      await revealChildWindow(existing, opts.label);
    }
    return existing;
  }
  await invoke("open_child_window", {
    options: {
      label: opts.label,
      title: opts.title,
      url: opts.url,
      width: opts.width ?? 720,
      height: opts.height ?? 560,
      resizable: opts.resizable ?? true,
      alwaysOnTop: needsAlwaysOnTop(opts.label),
      backgroundColor: getChildWindowBackgroundColor(),
    },
  });

  const win = await WebviewWindow.getByLabel(opts.label);
  if (!win) {
    throw new Error(`Failed to create child window: ${opts.label}`);
  }

  await win.setAlwaysOnTop(needsAlwaysOnTop(opts.label)).catch(() => {});
  attachChildWindowDestroyedHandler(opts.label, win);

  const readyTimeout = window.setTimeout(async () => {
    const isVisible = await win.isVisible().catch(() => true);
    if (isVisible) return;

    await win.close().catch(() => {});
  }, CHILD_WINDOW_READY_TIMEOUT_MS);

  win.once("tauri://destroyed", () => {
    window.clearTimeout(readyTimeout);
  });
  return win;
}

export async function openSettings(tab?: string) {
  const url = tab
    ? `index.html?window=settings&tab=${encodeURIComponent(tab)}`
    : "index.html?window=settings";
  const win = await openChildWindow({
    label: "settings",
    title: i18n.t("settings.title"),
    url,
    width: 800,
    height: 560,
  });
  if (tab) {
    emit("settings-open-tab", { tab });
  }
  return win;
}

export async function prewarmSettingsWindow() {
  if (await WebviewWindow.getByLabel("settings")) return;

  await invoke("open_child_window", {
    options: {
      label: "settings",
      title: i18n.t("settings.title"),
      url: "index.html?window=settings&prewarm=1",
      width: 800,
      height: 560,
      resizable: true,
      alwaysOnTop: false,
      backgroundColor: getChildWindowBackgroundColor(),
    },
  });

  const win = await WebviewWindow.getByLabel("settings");
  if (!win) return;

  attachChildWindowDestroyedHandler("settings", win);

  window.setTimeout(async () => {
    const isReady = readyChildWindowLabels.has("settings");
    const isVisible = await win.isVisible().catch(() => true);
    if (!isReady && !isVisible) {
      await win.close().catch(() => {});
    }
  }, CHILD_WINDOW_READY_TIMEOUT_MS);
}

export interface NewSessionTarget {
  targetLeafId?: string;
  anchorTabId?: string | null;
  sourceTabId?: string;
  sourcePaneId?: string;
  initialGroupId?: string;
}

export function openNewSession(editId?: string, autoConnect?: boolean, target?: NewSessionTarget) {
  return openNewSessionWithTarget(editId, autoConnect, target);
}

export function openNewSessionWithTarget(
  editId?: string,
  autoConnect?: boolean,
  target?: NewSessionTarget,
) {
  let url = editId
    ? `index.html?window=new-session&edit=${encodeURIComponent(editId)}`
    : "index.html?window=new-session";
  if (autoConnect) url += "&autoConnect=1";
  if (target?.targetLeafId) {
    url += `&targetLeafId=${encodeURIComponent(target.targetLeafId)}`;
  }
  if (target?.anchorTabId) {
    url += `&anchorTabId=${encodeURIComponent(target.anchorTabId)}`;
  }
  if (target?.sourceTabId) {
    url += `&sourceTabId=${encodeURIComponent(target.sourceTabId)}`;
  }
  if (target?.sourcePaneId) {
    url += `&sourcePaneId=${encodeURIComponent(target.sourcePaneId)}`;
  }
  if (!editId && target?.initialGroupId) {
    url += `&groupId=${encodeURIComponent(target.initialGroupId)}`;
  }
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
  });
}
