// Shim for @tauri-apps/api/path — tempDir + join.
export async function tempDir(): Promise<string> {
  return window.electronAPI.tempDir();
}
export async function join(...parts: string[]): Promise<string> {
  return parts.join("/").replace(/\/+/g, "/");
}
