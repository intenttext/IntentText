import { contextBridge, ipcRenderer } from "electron";

// The bridge the Tauri shims (renderer/src/tauri-shims/*) call. Keeps the React
// renderer unchanged: it still "invokes commands" and "listens for events", now
// over Electron IPC.
const api = {
  isElectron: true,

  // Generic command channel — mirrors Tauri's invoke(cmd, args).
  invoke: (cmd: string, args?: unknown) => ipcRenderer.invoke("invoke", cmd, args),

  // Dialogs (plugin-dialog).
  dialogOpen: (opts: unknown) => ipcRenderer.invoke("dialog:open", opts),
  dialogSave: (opts: unknown) => ipcRenderer.invoke("dialog:save", opts),
  dialogMessage: (msg: string, opts: unknown) =>
    ipcRenderer.invoke("dialog:message", msg, opts),
  dialogAsk: (msg: string, opts: unknown) =>
    ipcRenderer.invoke("dialog:ask", msg, opts) as Promise<boolean>,

  // App / window / paths.
  appVersion: () => ipcRenderer.invoke("app:version"),
  tempDir: () => ipcRenderer.invoke("path:temp"),
  setTitle: (title: string) => ipcRenderer.send("win:setTitle", title),

  // Reliable Chromium print of a standalone document.
  printHtml: (html: string) => ipcRenderer.invoke("print:html", html),

  // Export a PAdES-signed PDF (render + sign in main; returns the saved path).
  exportSignedPdf: (arg: {
    html: string;
    defaultName?: string;
    name?: string;
    reason?: string;
    tsaUrl?: string;
  }) =>
    ipcRenderer.invoke("export:signedPdf", arg) as Promise<{
      ok: boolean;
      path?: string;
      error?: string;
    }>,

  // Events pushed from main → renderer (open-file, menu-action, file-created/
  // modified/deleted). Returns an unsubscribe fn.
  on: (channel: string, cb: (payload: unknown) => void) => {
    const listener = (_e: unknown, payload: unknown) => cb(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
};

contextBridge.exposeInMainWorld("electronAPI", api);

export type ElectronAPI = typeof api;
