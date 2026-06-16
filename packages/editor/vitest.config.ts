import { defineConfig } from "vitest/config";

// Standalone test config (does NOT load the lib vite.config.ts). JSX is handled by
// esbuild's automatic runtime — no @vitejs/plugin-react, which sidesteps the
// vite/plugin-react "vite/internal" incompatibility. Dep optimization is disabled so
// the heavy tiptap tree isn't pre-bundled on startup (the cause of the prior hang).
export default defineConfig({
  esbuild: { jsx: "automatic" },
  optimizeDeps: { noDiscovery: true, include: [] },
  test: {
    environment: "happy-dom",
    include: ["tests/**/*.test.{ts,tsx}"],
    globals: true,
    pool: "forks",
    server: {
      deps: {
        optimizer: { web: { enabled: false }, ssr: { enabled: false } },
        inline: [/@dotit\//],
      },
    },
  },
});
