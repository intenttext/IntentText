import { defineConfig } from "vitest/config";

// Unit tests for pure main-process logic (e.g. the fs capability guard). Runs in a
// node environment — no Electron required.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
