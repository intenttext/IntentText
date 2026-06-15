// Shim for @tauri-apps/api/app — version.
export async function getVersion(): Promise<string> {
  return window.electronAPI.appVersion();
}
