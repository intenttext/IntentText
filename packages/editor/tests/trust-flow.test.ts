// trust-flow — the editor's Trust actions must produce a document core can verify.
//
// The editor's Trust panel (useTrustState) and ribbon Trust control both drive the
// lifecycle through core: track → approve (hash-chained) → sign (with content hash)
// → seal (freeze + hash) → verify. This guards that sequence end-to-end — including
// the regression where a hand-built `sign:` had NO hash and verified as INVALID.

import { describe, it, expect } from "vitest";
import {
  appendApproval,
  signDocument,
  sealDocument,
  verifyDocument,
  verifyAuditChain,
  computeDocumentHash,
} from "@dotit/core";

const BASE = "title: Consulting Agreement\ntext: The terms below are agreed.";

describe("editor trust flow → core-verifiable", () => {
  it("approve → sign → seal yields an intact, validly-signed, chained document", () => {
    let s = BASE;
    s = appendApproval(s, { by: "Sarah Chen", role: "Legal", note: "Reviewed" });
    s = signDocument(s, { signer: "Ahmed Al-Rashid", role: "CEO" }).source;
    s = sealDocument(s, {
      signer: "Ahmed Al-Rashid",
      role: "CEO",
      skipSign: true,
    }).source;

    const v = verifyDocument(s);
    expect(v.intact).toBe(true);
    // The signature carries the hash → it verifies as VALID (the old hand-built,
    // hashless sign: line failed here).
    const ahmed = v.signers?.find((x) => x.signer === "Ahmed Al-Rashid");
    expect(ahmed?.valid).toBe(true);
    // The approval is hash-chained.
    expect(verifyAuditChain(s).valid).toBe(true);
    // And the sealed line carries a spec version (don't pin the number — it tracks
    // @dotit/core's current SEAL_SPEC, which advances over time).
    expect(s).toMatch(/freeze:[^\n]*\|\s*spec:\s*\d+/);
  });

  it("a hand-built sign: WITHOUT a hash verifies as INVALID (why we route via core)", () => {
    const sealed = sealDocument(BASE, { signer: "X", role: "Y", skipSign: true })
      .source;
    // Insert a hashless signature (the old useTrustState behaviour).
    const bad = sealed.replace(
      "freeze:",
      "sign: Mallory | role: CEO | at: 2026-01-01\nfreeze:",
    );
    const v = verifyDocument(bad);
    const mallory = v.signers?.find((x) => x.signer === "Mallory");
    expect(mallory?.valid).toBe(false); // no hash → not a valid signature
  });

  it("editing after sealing breaks verification", () => {
    let s = signDocument(BASE, { signer: "Ahmed", role: "CEO" }).source;
    s = sealDocument(s, { signer: "Ahmed", role: "CEO", skipSign: true }).source;
    expect(verifyDocument(s).intact).toBe(true);
    const tampered = s.replace("agreed", "DISPUTED");
    expect(verifyDocument(tampered).intact).toBe(false);
  });

  it("the signer is shown to have approved the sealed content (valid + current)", () => {
    let s = appendApproval(BASE, { by: "A", role: "R" });
    s = signDocument(s, { signer: "A", role: "R" }).source;
    s = sealDocument(s, { signer: "A", role: "R", skipSign: true }).source;
    // v3: the signature hash binds the signer identity and the seal hash covers the
    // signatures, so the two hashes DIFFER by construction — what matters is that the
    // signer verifies as having approved the current (sealed) content.
    const v = verifyDocument(s);
    expect(v.intact).toBe(true);
    expect(v.signers?.every((x) => x.valid && x.signedCurrentVersion)).toBe(true);
  });
});
