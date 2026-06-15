// Shim for @tauri-apps/plugin-dialog — open / save / message.
export function open(opts?: unknown): Promise<string | string[] | null> {
  return window.electronAPI.dialogOpen(opts ?? {}) as Promise<string | string[] | null>;
}
export function save(opts?: unknown): Promise<string | null> {
  return window.electronAPI.dialogSave(opts ?? {}) as Promise<string | null>;
}
export function message(msg: string, opts?: unknown): Promise<void> {
  return window.electronAPI.dialogMessage(msg, opts ?? {});
}
// Tauri's `ask` — a confirm dialog resolving to true when accepted.
export function ask(msg: string, opts?: unknown): Promise<boolean> {
  return window.electronAPI.dialogAsk(msg, opts ?? {});
}
