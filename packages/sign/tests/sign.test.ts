import { describe, it, expect } from "vitest";
import {
  generateSigningKey,
  publicKeyFor,
  signDocumentCrypto,
  verifyCryptoSignatures,
  verifyDocumentSignatures,
} from "../src/index";
import { sealDocument } from "@dotit/core";

const DOC = "title: Service Agreement\ntext: Payment due in 30 days\nsection: Authorization";

describe("@dotit/sign — Ed25519 keys", () => {
  it("generates a 32-byte keypair and derives the public key", () => {
    const k = generateSigningKey();
    expect(k.privateKey).toBeTruthy();
    expect(k.publicKey).toBeTruthy();
    expect(publicKeyFor(k.privateKey)).toBe(k.publicKey);
  });
});

describe("@dotit/sign — sign + verify", () => {
  it("embeds key:+sig: and verifies valid against current content", () => {
    const k = generateSigningKey();
    const s = signDocumentCrypto(DOC, { signer: "Ahmed", role: "CEO", privateKey: k.privateKey });
    expect(s.source).toMatch(/key: ed25519:[\w-]+ \| sig: [\w-]+/);
    const v = verifyDocumentSignatures(s.source);
    expect(v.allSignaturesValid).toBe(true);
    expect(v.validCount).toBe(1);
    expect(v.signatures[0]).toMatchObject({ signer: "Ahmed", role: "CEO", valid: true, cryptographic: true });
  });

  it("editing the document invalidates the signature", () => {
    const k = generateSigningKey();
    const s = signDocumentCrypto(DOC, { signer: "Ahmed", privateKey: k.privateKey });
    const tampered = s.source.replace("30 days", "90 days");
    const v = verifyDocumentSignatures(tampered);
    expect(v.allSignaturesValid).toBe(false);
    expect(v.signatures[0].valid).toBe(false);
  });

  it("swapping the embedded public key is rejected (no forgery)", () => {
    const k = generateSigningKey();
    const other = generateSigningKey();
    const s = signDocumentCrypto(DOC, { signer: "Ahmed", privateKey: k.privateKey });
    const forged = s.source.replace(/key: ed25519:[^ |]+/, "key: ed25519:" + other.publicKey);
    expect(verifyCryptoSignatures(forged)[0].valid).toBe(false);
  });

  it("is idempotent per public key (no duplicate sign: lines)", () => {
    const k = generateSigningKey();
    const a = signDocumentCrypto(DOC, { signer: "Ahmed", privateKey: k.privateKey });
    const b = signDocumentCrypto(a.source, { signer: "Ahmed", privateKey: k.privateKey });
    expect(b.note).toBe("already-signed");
    expect(b.source.split("\n").filter((l) => l.startsWith("sign:")).length).toBe(1);
  });

  it("multiple distinct signers stack and all verify", () => {
    const a = generateSigningKey();
    const b = generateSigningKey();
    let s = signDocumentCrypto(DOC, { signer: "Ahmed", role: "CEO", privateKey: a.privateKey });
    s = signDocumentCrypto(s.source, { signer: "Sara", role: "CFO", privateKey: b.privateKey });
    const v = verifyDocumentSignatures(s.source);
    expect(v.validCount).toBe(2);
    expect(v.allSignaturesValid).toBe(true);
  });

  it("signatures survive sealing (freeze: is excluded from the hash)", () => {
    const k = generateSigningKey();
    const s = signDocumentCrypto(DOC, { signer: "Ahmed", privateKey: k.privateKey });
    const sealed = sealDocument(s.source, { signer: "Ahmed", skipSign: true });
    expect(verifyDocumentSignatures(sealed.source).allSignaturesValid).toBe(true);
  });

  it("reports plain-text approvals as non-cryptographic", () => {
    const withText = DOC + "\nsign: Legal | role: Counsel | at: 2026-01-01";
    const checks = verifyCryptoSignatures(withText);
    expect(checks[0].cryptographic).toBe(false);
    expect(checks[0].valid).toBe(false);
  });
});
