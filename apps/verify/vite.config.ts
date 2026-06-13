import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @dotit/core and @dotit/sign ship CommonJS (and @dotit/sign pulls in
// @noble/curves). Pre-bundle them with esbuild and let @rollup/plugin-commonjs
// process them so their named exports resolve in both dev and the production
// build. Mirrors apps/editor/vite.config.ts.
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["@dotit/core", "@dotit/sign", "@noble/curves/ed25519"],
  },
  build: {
    commonjsOptions: {
      // core/sign resolve through workspace symlinks to packages/*/dist, so the
      // include regex must match those resolved paths, not the specifiers.
      include: [/packages\/(core|sign)\/dist/, /node_modules/],
      transformMixedEsModules: true,
    },
    chunkSizeWarningLimit: 2000,
  },
});
