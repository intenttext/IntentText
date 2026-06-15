import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Map the renderer's existing `@tauri-apps/*` imports onto thin Electron-backed
// shims, so the React renderer ports over with NO source edits — only the native
// layer changes (now in the Electron main process via window.electronAPI).
const shim = (m: string) => resolve(__dirname, `src/renderer/src/tauri-shims/${m}.ts`);

export default defineConfig({
  main: {
    build: {
      outDir: "out/main",
      lib: { entry: resolve(__dirname, "src/main/index.ts") },
      rollupOptions: { external: ["electron", "chokidar"] },
    },
  },
  preload: {
    build: {
      outDir: "out/preload",
      lib: { entry: resolve(__dirname, "src/preload/index.ts") },
      rollupOptions: { external: ["electron"] },
    },
  },
  renderer: {
    root: "src/renderer",
    plugins: [react()],
    resolve: {
      alias: {
        "@tauri-apps/api/core": shim("core"),
        "@tauri-apps/api/event": shim("event"),
        "@tauri-apps/api/window": shim("window"),
        "@tauri-apps/api/webview": shim("webview"),
        "@tauri-apps/api/path": shim("path"),
        "@tauri-apps/api/app": shim("app"),
        "@tauri-apps/api/menu": shim("menu"),
        "@tauri-apps/plugin-dialog": shim("dialog"),
      },
    },
    optimizeDeps: {
      include: ["@dotit/core", "@dotit/editor", "@dotit/sign"],
    },
    build: {
      outDir: "out/renderer",
      commonjsOptions: {
        include: [/packages\/(core|sign)\/dist/, /node_modules/],
        transformMixedEsModules: true,
      },
      chunkSizeWarningLimit: 2000,
      rollupOptions: { input: resolve(__dirname, "src/renderer/index.html") },
    },
  },
});
