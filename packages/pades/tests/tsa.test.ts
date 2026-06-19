/**
 * tsa.test.ts — RFC-3161 timestamp verification primitive (G-10).
 *
 * verifyTimestampToken is the trust-critical check the request side can't make: does a
 * TimeStampToken actually anchor THIS data (its message imprint == SHA-256(data))?
 * The negative cases are deterministic; the positive round-trip needs a live TSA and
 * skips gracefully when offline (so CI never flakes on network).
 */
import { describe, it, expect } from "vitest";
import {
  verifyTimestampToken,
  timestampTokenTime,
  requestTimestampToken,
  PUBLIC_TSA,
} from "../src/index.js";

describe("G-10: verifyTimestampToken", () => {
  it("rejects garbage / non-token bytes (parse-safe, never throws)", async () => {
    const garbage = new Uint8Array([1, 2, 3, 4, 5]);
    const v = await verifyTimestampToken(garbage, new Uint8Array([9]));
    expect(v.valid).toBe(false);
    expect(v.genTime).toBeUndefined();
    expect(timestampTokenTime(garbage)).toBeUndefined();
  });

  it("rejects an empty token", async () => {
    expect((await verifyTimestampToken(new Uint8Array(), new Uint8Array([1]))).valid).toBe(
      false,
    );
  });

  it(
    "verifies a REAL TSA token binds its data, rejects other data (network; skips offline)",
    async () => {
      const data = new TextEncoder().encode("sha256:0123456789abcdef-seal-hash");
      let token: Uint8Array;
      try {
        token = await requestTimestampToken(data, PUBLIC_TSA.digicert);
      } catch {
        return; // TSA unreachable / offline — skip without failing
      }
      const ok = await verifyTimestampToken(token, data);
      expect(ok.valid).toBe(true);
      expect(ok.genTime).toBeTruthy();

      // The same token must NOT verify against different data.
      const other = new TextEncoder().encode("a different payload");
      expect((await verifyTimestampToken(token, other)).valid).toBe(false);
    },
    20000,
  );
});
