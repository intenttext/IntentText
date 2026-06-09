import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // @intenttext/core ships CommonJS. Pre-bundle it with esbuild and let
  // @rollup/plugin-commonjs process it so its named exports (e.g.
  // listBuiltinThemes) resolve in both dev and the production build.
  optimizeDeps: {
    include: ["@intenttext/core"],
  },
  build: {
    commonjsOptions: {
      // Core resolves through a workspace symlink to packages/core/dist, so the
      // include regex must match that resolved path, not the package specifier.
      include: [/packages\/core\/dist/, /node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          "monaco-editor": ["monaco-editor"],
        },
      },
    },
    chunkSizeWarningLimit: 5000,
  },
});
