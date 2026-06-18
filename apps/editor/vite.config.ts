import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// npm-only: both @dotit/core and @dotit/editor are consumed from their PUBLISHED
// packages (no source aliases, no local workspace links — see root .npmrc). Dev
// and production both use the installed dist, so what runs is what shipped.
//
// To resume fast cross-package dev (HMR off package source), set
// link-workspace-packages=true in .npmrc and add a serve-mode source alias here.

export default defineConfig(() => ({
  plugins: [react()],
  resolve: {
    // One React instance across the app + packages (else hooks break).
    dedupe: ["react", "react-dom"],
  },
  // @dotit/core ships CommonJS; pre-bundle both deps with esbuild and let
  // @rollup/plugin-commonjs process them so named exports resolve in dev + build.
  optimizeDeps: {
    include: ["@dotit/core", "@dotit/editor"],
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
}));
