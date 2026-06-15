// Shim for @tauri-apps/api/event — bridges listen() to Electron IPC channels.
export type UnlistenFn = () => void;
export interface Event<T> { payload: T; event: string }
export function listen<T = unknown>(
  event: string,
  handler: (e: Event<T>) => void,
): Promise<UnlistenFn> {
  const off = window.electronAPI.on(event, (payload) =>
    handler({ payload: payload as T, event }),
  );
  return Promise.resolve(off);
}
