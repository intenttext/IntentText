// Shim for @tauri-apps/api/core — routes invoke() to the Electron main process.
declare global {
  interface Window {
    electronAPI: {
      isElectron: boolean;
      invoke(cmd: string, args?: unknown): Promise<unknown>;
      dialogOpen(opts: unknown): Promise<unknown>;
      dialogSave(opts: unknown): Promise<unknown>;
      dialogMessage(msg: string, opts: unknown): Promise<void>;
      appVersion(): Promise<string>;
      tempDir(): Promise<string>;
      setTitle(title: string): void;
      printHtml(html: string): Promise<void>;
      on(channel: string, cb: (payload: unknown) => void): () => void;
    };
  }
}
export function invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return window.electronAPI.invoke(cmd, args) as Promise<T>;
}
