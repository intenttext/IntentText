import type { RuntimeConfig } from "./types.js";

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  browserPool: {
    maxBrowsers: 2,
    maxPagesPerBrowser: 4,
    queueTimeoutMs: 10_000,
    launchTimeoutMs: 15_000,
    taskTimeoutMs: 30_000,
  },
  retryAttempts: 1,
  shutdownGraceMs: 5_000,
};
