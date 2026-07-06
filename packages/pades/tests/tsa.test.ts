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
    expect(v.signatureValid).toBe(false);
    expect(v.imprintValid).toBe(false);
    expect(v.genTime).toBeUndefined();
    expect(timestampTokenTime(garbage)).toBeUndefined();
  });

  it("rejects an empty token", async () => {
    const v = await verifyTimestampToken(new Uint8Array(), new Uint8Array([1]));
    expect(v.valid).toBe(false);
    expect(v.signatureValid).toBe(false);
  });

  it(
    "verifies a REAL TSA token: signature + imprint (network; skips offline)",
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
      expect(ok.signatureValid).toBe(true);
      expect(ok.imprintValid).toBe(true);
      expect(ok.genTime).toBeTruthy();

      // The same token must NOT verify against different data (imprint mismatch).
      const other = await verifyTimestampToken(token, new TextEncoder().encode("x"));
      expect(other.valid).toBe(false);
      expect(other.imprintValid).toBe(false);
    },
    20000,
  );

  it(
    "REJECTS a token whose signature was tampered — even though its imprint still matches (network; skips offline)",
    async () => {
      // This is the whole point of the fix: the old code returned valid:true from the
      // imprint ALONE, so a self-minted / altered token passed. Now a broken signature
      // fails, while imprintValid stays true (the data itself is unchanged).
      const data = new TextEncoder().encode("sha256:tamper-proof-seal");
      let token: Uint8Array;
      try {
        token = await requestTimestampToken(data, PUBLIC_TSA.digicert);
      } catch {
        return; // offline — skip
      }
      const forged = new Uint8Array(token);
      forged[forged.length - 40] ^= 0xff; // flip a byte in the signature region
      const v = await verifyTimestampToken(forged, data);
      expect(v.signatureValid).toBe(false);
      expect(v.imprintValid).toBe(true); // imprint binds — the CONTENT wasn't changed
      expect(v.valid).toBe(false); // …but the token is not authentic → rejected
    },
    20000,
  );
});
