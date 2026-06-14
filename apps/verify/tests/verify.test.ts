/**
 * verify.test.ts — the public verification engine (runVerification). The verify
 * portal is the trust surface the world drops untrusted .it files into, so its
 * verdicts and its (sandboxable) preview must be correct and injection-safe.
 * Pure + offline — no DOM, no network.
 */
import { describe, it, expect } from "vitest";
import { sealDocument } from "@dotit/core";
import { generateSigningKey, signDocumentCrypto } from "@dotit/sign";
import { runVerification } from "../src/verify";

const DRAFT = "title: Quarterly Memo\n\ntext: Revenue is up 12%.\n";

describe("runVerification — verdicts", () => {
  it("an unsealed draft is 'unsealed' (not a failure)", () => {
    const r = runVerification(DRAFT);
    expect(r.ok).toBe(true);
    expect(r.template).toBe(false);
    expect(r.verdict).toBe("unsealed");
    expect(r.integrity.sealed).toBe(false);
  });

  it("a template short-circuits to template (outside trust)", () => {
    const r = runVerification("title: {{customer.name}} Invoice\n\ntext: {{total}}\n");
    expect(r.template).toBe(true);
  });

  it("a sealed, unchanged document verifies", () => {
    const sealed = sealDocument(DRAFT, { signer: "Finance" }).source;
    const r = runVerification(sealed);
    expect(r.integrity.sealed).toBe(true);
    expect(r.integrity.intact).toBe(true);
    expect(r.verdict).toBe("verified");
  });

  it("editing a sealed document flips the verdict to 'modified'", () => {
    const sealed = sealDocument(DRAFT, { signer: "Finance" }).source;
    const tampered = sealed.replace("12%", "99%");
    const r = runVerification(tampered);
    expect(r.integrity.intact).toBe(false);
    expect(r.verdict).toBe("modified");
  });

  it("a valid cryptographic signature verifies", () => {
    const key = generateSigningKey();
    const signed = signDocumentCrypto(DRAFT, { signer: "Jane", privateKey: key.privateKey }).source;
    const r = runVerification(signed);
    expect(r.signatures.allSignaturesValid).toBe(true);
    expect(r.verdict).toBe("verified");
  });

  it("editing after signing makes the signature invalid", () => {
    const key = generateSigningKey();
    const signed = signDocumentCrypto(DRAFT, { signer: "Jane", privateKey: key.privateKey }).source;
    const tampered = signed.replace("12%", "99%");
    const r = runVerification(tampered);
    expect(r.signatures.allSignaturesValid).toBe(false);
    expect(r.verdict).toBe("invalid");
  });

  it("a forged 'UTS' certification (wrong key) is not trusted", () => {
    const attacker = generateSigningKey();
    // Hand-craft a certify line signed by a key that is NOT the trusted UTS key.
    const src =
      `title: Fake Award\n\ntext: We won.\n` +
      `certify: UTS | account: evil | at: 2026-01-01T00:00:00Z | hash: sha256:abc | key: ed25519:${attacker.publicKey} | sig: ${"A".repeat(86)}\n`;
    const r = runVerification(src);
    // It must NOT come back verified — the embedded key isn't the trusted UTS key.
    expect(r.verdict).not.toBe("verified");
    expect(r.certifications.every((c) => !c.valid)).toBe(true);
  });
});

describe("runVerification — preview is injection-safe", () => {
  it("a hostile SVG embed is sanitized in the preview HTML", () => {
    const src =
      'title: Doc\n\nembed: | type: svg | content: <svg onload="alert(1)"><script>alert(2)</script></svg>\n';
    const r = runVerification(src);
    expect(r.previewHTML).not.toContain("<script>alert(2)</script>");
    expect(r.previewHTML.toLowerCase()).not.toContain("onload");
  });

  it("does not throw on malformed input", () => {
    expect(() => runVerification("|||::: not really valid :::|||")).not.toThrow();
  });
});
