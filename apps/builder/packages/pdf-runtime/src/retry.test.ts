import assert from "node:assert/strict";
import test from "node:test";

import { executeWithRetries } from "./retry.js";

test("executeWithRetries succeeds after transient failures", async () => {
  let calls = 0;

  const value = await executeWithRetries(
    async () => {
      calls += 1;
      if (calls < 3) {
        throw new Error("transient");
      }
      return "ok";
    },
    {
      retryAttempts: 2,
      backoffMs: () => 0,
    },
  );

  assert.equal(value, "ok");
  assert.equal(calls, 3);
});

test("executeWithRetries throws after retries are exhausted", async () => {
  let calls = 0;

  await assert.rejects(
    executeWithRetries(
      async () => {
        calls += 1;
        throw new Error("always-fails");
      },
      {
        retryAttempts: 1,
        backoffMs: () => 0,
      },
    ),
    /always-fails/,
  );

  assert.equal(calls, 2);
});

test("executeWithRetries invokes onRetry hook for each retry", async () => {
  const seenAttempts: number[] = [];
  let calls = 0;

  await assert.rejects(
    executeWithRetries(
      async () => {
        calls += 1;
        throw new Error("x");
      },
      {
        retryAttempts: 2,
        backoffMs: () => 0,
        onRetry: async (attempt) => {
          seenAttempts.push(attempt);
        },
      },
    ),
  );

  assert.equal(calls, 3);
  assert.deepEqual(seenAttempts, [0, 1]);
});
