// Shim for @tauri-apps/api/menu — unused (the native menu lives in the Electron
// main process; the renderer's lib/menu.ts maps menu-action events instead).
// Kept as a stub so any stray import resolves.
export const Menu = { new: async () => ({ setAsAppMenu: async () => {} }) };
export const Submenu = { new: async () => ({}) };
export const MenuItem = { new: async () => ({}) };
export const PredefinedMenuItem = { new: async () => ({}) };
