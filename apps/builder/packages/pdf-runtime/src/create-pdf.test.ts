import assert from "node:assert/strict";
import test from "node:test";

import { __testing } from "./index.js";

function createConfig(retryAttempts: number) {
  return {
    retryAttempts,
    shutdownGraceMs: 0,
    browserPool: {
      maxBrowsers: 1,
      maxPagesPerBrowser: 1,
      queueTimeoutMs: 100,
      launchTimeoutMs: 100,
      taskTimeoutMs: 100,
    },
  };
}

test("createPdf retries once and succeeds on second attempt", async () => {
  let poolCreations = 0;
  let now = 0;

  const result = await __testing.createPdfWithDeps(
    {
      template: "title: T",
      data: {},
    },
    createConfig(1),
    {
      renderHtmlFn: async () => "<html><body>ok</body></html>",
      loadPuppeteerFn: async () => ({
        launch: async () => ({}) as unknown,
      }),
      createPool: () => {
        poolCreations += 1;
        const attempt = poolCreations;

        return {
          withPage: async (task) => {
            if (attempt === 1) {
              throw new Error("flaky-render");
            }
            const page = {
              setContent: async () => {},
              pdf: async () => new Uint8Array([37, 80, 68, 70, 45]),
            };
            const value = await task(page);
            return { value, queueWaitMs: 7 };
          },
          getCrashCount: () => (attempt === 1 ? 1 : 0),
          shutdown: async () => {},
        };
      },
      now: () => {
        now += 10;
        return now;
      },
    },
  );

  assert.equal(poolCreations, 2);
  assert.equal(result.metrics.crashCount, 1);
  assert.equal(result.metrics.queueWaitMs, 7);
  assert.ok(result.metrics.durationMs > 0);
  assert.equal(result.html, "<html><body>ok</body></html>");
  assert.equal(result.pdf[0], 37);
});

test("createPdf respects retryAttempts=0 and fails immediately", async () => {
  let poolCreations = 0;

  await assert.rejects(
    __testing.createPdfWithDeps(
      {
        template: "title: T",
        data: {},
      },
      createConfig(0),
      {
        renderHtmlFn: async () => "<html><body>ok</body></html>",
        loadPuppeteerFn: async () => ({
          launch: async () => ({}) as unknown,
        }),
        createPool: () => {
          poolCreations += 1;
          return {
            withPage: async () => {
              throw new Error("fatal");
            },
            getCrashCount: () => 1,
            shutdown: async () => {},
          };
        },
        now: () => Date.now(),
      },
    ),
    /fatal/,
  );

  assert.equal(poolCreations, 1);
});
