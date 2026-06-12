import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Library build: ES + CJS, everything peer/dependency-shaped stays external
// (react, @tiptap/*, @dotit/core, lucide-react). The stylesheet ships as
// dist/style.css (copied verbatim by the build script — plain CSS, no
// preprocessing needed) so consumers import "@dotit/editor/style.css".
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "index.mjs" : "index.cjs"),
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react-dom/client",
        "@dotit/core",
        "lucide-react",
        /^@tiptap\//,
      ],
      output: {
        // The CJS build default-imports external ESM-flavored CJS packages
        // (@tiptap/* set __esModule + .default) — "auto" emits the interop
        // that unwraps .default correctly in both module worlds.
        interop: "auto",
      },
    },
    sourcemap: true,
  },
});
