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
  // @dotit/editor is ESM but statically imports named exports from @dotit/core
  // and @dotit/sign, which ship CommonJS (sign also pulls in @noble/curves).
  // Pre-bundle them with esbuild and let @rollup/plugin-commonjs process them
  // so those named exports resolve in the production build (mirrors
  // apps/editor + apps/verify vite.config.ts).
  optimizeDeps: {
    include: [
      "@dotit/core",
      "@dotit/editor",
      "@dotit/sign",
      "@noble/curves/ed25519",
    ],
  },
  build: {
    commonjsOptions: {
      include: [/packages\/(core|sign)\/dist/, /node_modules/],
      transformMixedEsModules: true,
    },
    chunkSizeWarningLimit: 2000,
  },
});
