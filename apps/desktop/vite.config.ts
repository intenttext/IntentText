import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 5174 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  // @dotit/editor is ESM but statically imports named exports from @dotit/core,
  // which ships CommonJS. Pre-bundle both with esbuild and let
  // @rollup/plugin-commonjs process core so those named exports resolve in the
  // production build (mirrors apps/editor/vite.config.ts).
  optimizeDeps: {
    include: ["@dotit/core", "@dotit/editor"],
  },
  build: {
    commonjsOptions: {
      include: [/packages\/core\/dist/, /node_modules/],
      transformMixedEsModules: true,
    },
    chunkSizeWarningLimit: 2000,
  },
});
