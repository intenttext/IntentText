// Shim for @tauri-apps/api/window — only what the renderer uses.
export function getCurrentWindow() {
  return {
    setTitle(title: string): Promise<void> {
      window.electronAPI.setTitle(title);
      return Promise.resolve();
    },
    show: () => Promise.resolve(),
    setFocus: () => Promise.resolve(),
    unminimize: () => Promise.resolve(),
    close: () => Promise.resolve(),
  };
}
