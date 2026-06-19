/**
 * seal-versioning.test.ts — the seal records WHICH canonicalization produced it,
 * and verification applies exactly that version FOREVER. This is the guarantee
 * that a future byte-rule change can never silently break a historical seal — the
 * most important property for long-term (30–100yr) trust records.
 *
 * These tests are a CONFORMANCE PIN: the v1 golden hash below is frozen. If a code
 * change alters the v1 canonicalization, this test fails on purpose — the fix is to
 * add a NEW spec version (v2) and stamp it, never to mutate v1.
 */

import { describe, it, expect } from "vitest";
import {
  SEAL_SPEC,
  computeDocumentHash,
  hashMatches,
  sealDocument,
  signDocument,
  verifyDocument,
} from "../src/index";

// Precomposed "é" (U+00E9) vs decomposed "e"+◌́ (U+0065 U+0301) — visually identical,
// byte-different. Under v1 (NFC) they hash the same; under v0 (raw) they don't. That
// difference is what makes the version dispatch observable. Derived via normalize()
// so the distinction is guaranteed regardless of how this file is saved.
const BASE = "title: Café Agreement\ntext: 100% organic.";
const COMPOSED = BASE.normalize("NFC");
const DECOMPOSED = BASE.normalize("NFD");

// FROZEN v1 vector — recomputing under today's v1 rules must still equal this.
const V1_GOLDEN =
  "sha256:e7db3d0985825fb9bb10b6830ba26d816276899af3789d9fe9f5ffaae3572812";
const V1_GOLDEN_BODY =
  "title: Service Agreement\ntext: Café au lait — 100% organic.\nmetric: amount | value: 24000 | unit: USD";

describe("seal versioning — the forever-stable guarantee", () => {
  it("current spec is 4", () => {
    expect(SEAL_SPEC).toBe(4);
  });

  it("CONFORMANCE PIN: the v1 hash of a fixed body is frozen", () => {
    // If this fails, the v1 canonicalization changed — add a v4, do NOT edit v1.
    // A plain body (no trust lines, comments, or styling) hashes identically under
    // v1/v2/v3, so this golden is stable across the later body-scope changes.
    expect(computeDocumentHash(V1_GOLDEN_BODY.normalize("NFC"), 1)).toBe(V1_GOLDEN);
  });

  it("v1 normalizes (NFC), v0 does not — they are genuinely different rulesets", () => {
    expect(computeDocumentHash(DECOMPOSED, 1)).toBe(computeDocumentHash(COMPOSED, 1));
    expect(computeDocumentHash(DECOMPOSED, 0)).not.toBe(
      computeDocumentHash(COMPOSED, 0),
    );
  });

  it("seal + sign stamp the spec version into the lines", () => {
    const sealed = sealDocument(COMPOSED, { signer: "Ahmed", role: "CEO" }).source;
    expect(sealed).toMatch(/freeze:[^\n]*\|\s*spec:\s*4/);
    expect(sealed).toMatch(/sign:[^\n]*\|\s*spec:\s*4/);
    expect(verifyDocument(sealed).intact).toBe(true);

    const signed = signDocument(COMPOSED, { signer: "Sarah" }).source;
    expect(signed).toMatch(/sign:[^\n]*\|\s*spec:\s*4/);
  });

  it("verification dispatches on the RECORDED version, not today's rules", () => {
    const v1hash = computeDocumentHash(DECOMPOSED, 1);
    // Recorded as v1 → verifies under v1.
    expect(hashMatches(DECOMPOSED, v1hash, 1)).toBe(true);
    // If the seal had (wrongly) claimed v0, it would verify against v0 ONLY — and
    // the v0 hash of the decomposed body differs, so it must NOT match.
    expect(hashMatches(DECOMPOSED, v1hash, 0)).toBe(false);
  });

  it("a pre-versioning seal (no spec recorded) still verifies via try-all", () => {
    const v1hash = computeDocumentHash(DECOMPOSED, 1);
    const v0hash = computeDocumentHash(DECOMPOSED, 0);
    // No spec → accept under any known version (backward compatibility).
    expect(hashMatches(DECOMPOSED, v1hash)).toBe(true);
    expect(hashMatches(DECOMPOSED, v0hash)).toBe(true);
    expect(hashMatches(DECOMPOSED, "sha256:deadbeef")).toBe(false);
  });

  it("a sealed document with a typed block keeps its seal (real-world body)", () => {
    const sealed = sealDocument(V1_GOLDEN_BODY, { signer: "QA" }).source;
    expect(verifyDocument(sealed).intact).toBe(true);
    // tamper one byte → fails
    expect(verifyDocument(sealed.replace("24000", "24001")).intact).toBe(false);
  });
});
