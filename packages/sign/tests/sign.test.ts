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

import {
  certifyDocument,
  verifyCertifications,
} from "../src/index";

describe("@dotit/sign — UTS certification (authority layer)", () => {
  const DOC2 = "title: Tender Bid\ntext: Bid amount 1,250,000 QAR\nsection: Submission";

  it("certifies and verifies against the trusted issuer key (provable time + account)", () => {
    const uts = generateSigningKey();
    const c = certifyDocument(DOC2, { issuer: "UTS", account: "acme-corp", issuerPrivateKey: uts.privateKey, at: "2026-06-13T10:15:00Z" });
    const [chk] = verifyCertifications(c.source, { UTS: uts.publicKey });
    expect(chk).toMatchObject({ issuer: "UTS", account: "acme-corp", at: "2026-06-13T10:15:00Z", valid: true, trusted: true, signatureValid: true });
  });

  it("editing the document invalidates the certification", () => {
    const uts = generateSigningKey();
    const c = certifyDocument(DOC2, { issuer: "UTS", account: "acme", issuerPrivateKey: uts.privateKey });
    const [chk] = verifyCertifications(c.source.replace("1,250,000", "9,999,999"), { UTS: uts.publicKey });
    expect(chk.valid).toBe(false);
  });

  it("a forged 'UTS' certification with a different key is rejected (not trusted)", () => {
    const uts = generateSigningKey();
    const attacker = generateSigningKey();
    const forged = certifyDocument(DOC2, { issuer: "UTS", account: "evil", issuerPrivateKey: attacker.privateKey });
    const [chk] = verifyCertifications(forged.source, { UTS: uts.publicKey });
    expect(chk.signatureValid).toBe(true); // attacker's own sig is valid math…
    expect(chk.trusted).toBe(false); // …but the key isn't UTS's
    expect(chk.valid).toBe(false);
  });

  it("an unknown issuer (no trusted key) reports signatureValid but not trusted", () => {
    const uts = generateSigningKey();
    const c = certifyDocument(DOC2, { issuer: "UTS", account: "a", issuerPrivateKey: uts.privateKey });
    const [chk] = verifyCertifications(c.source, {}); // no trusted set
    expect(chk.signatureValid).toBe(true);
    expect(chk.trusted).toBe(false);
    expect(chk.valid).toBe(false);
  });

  it("certification coexists with a signature; both verify; hash excludes both", () => {
    const uts = generateSigningKey();
    const signer = generateSigningKey();
    const signed = signDocumentCrypto(DOC2, { signer: "Ahmed", privateKey: signer.privateKey });
    const both = certifyDocument(signed.source, { issuer: "UTS", account: "acme", issuerPrivateKey: uts.privateKey });
    expect(verifyDocumentSignatures(both.source).allSignaturesValid).toBe(true);
    expect(verifyCertifications(both.source, { UTS: uts.publicKey })[0].valid).toBe(true);
  });

  it("certification is idempotent per issuer + content hash", () => {
    const uts = generateSigningKey();
    const c1 = certifyDocument(DOC2, { issuer: "UTS", account: "a", issuerPrivateKey: uts.privateKey });
    const c2 = certifyDocument(c1.source, { issuer: "UTS", account: "a", issuerPrivateKey: uts.privateKey });
    expect(c2.note).toBe("already-certified");
    expect(c2.source.split("\n").filter((l) => l.startsWith("certify:")).length).toBe(1);
  });
});

describe("@dotit/sign — certification identity (Phase 3b: verified entity)", () => {
  const DOC3 = "title: Quotation\ntext: Total 88,000 QAR";
  it("embeds + verifies the KYC-verified legal entity name", () => {
    const uts = generateSigningKey();
    const c = certifyDocument(DOC3, { issuer: "UTS", account: "acme", entity: "Acme Corp WLL", issuerPrivateKey: uts.privateKey });
    const [chk] = verifyCertifications(c.source, { UTS: uts.publicKey });
    expect(chk).toMatchObject({ valid: true, entity: "Acme Corp WLL", account: "acme" });
  });
  it("tampering the entity name invalidates the certification (entity is signed)", () => {
    const uts = generateSigningKey();
    const c = certifyDocument(DOC3, { issuer: "UTS", account: "acme", entity: "Acme Corp WLL", issuerPrivateKey: uts.privateKey });
    const [chk] = verifyCertifications(c.source.replace("Acme Corp WLL", "Imposter LLC"), { UTS: uts.publicKey });
    expect(chk.valid).toBe(false);
  });
  it("timestamp-only certification (no entity) still verifies", () => {
    const uts = generateSigningKey();
    const c = certifyDocument(DOC3, { issuer: "UTS", account: "acme", issuerPrivateKey: uts.privateKey });
    const [chk] = verifyCertifications(c.source, { UTS: uts.publicKey });
    expect(chk.valid).toBe(true);
    expect(chk.entity).toBeUndefined();
  });

  describe("input hardening", () => {
    it("reports a malformed signature as invalid instead of crashing", () => {
      const key = generateSigningKey();
      const signed = signDocumentCrypto(DOC, { signer: "A", privateKey: key.privateKey }).source;
      // Corrupt the sig field with non-base64url characters.
      const tampered = signed.replace(/sig: [^\n]+/, "sig: not!!valid!!base64");
      const [chk] = verifyCryptoSignatures(tampered);
      expect(chk.valid).toBe(false);
      expect(chk.cryptographic).toBe(true);
    });

    it("rejects a wrong-length (non-32-byte) public key", () => {
      const key = generateSigningKey();
      const signed = signDocumentCrypto(DOC, { signer: "A", privateKey: key.privateKey }).source;
      const tampered = signed.replace(/key: ed25519:[^\s|]+/, "key: ed25519:AAAA");
      const [chk] = verifyCryptoSignatures(tampered);
      expect(chk.valid).toBe(false);
    });

    it("does not treat the public key merely appearing in the body as already-signed", () => {
      const key = generateSigningKey();
      // The signer's public key is quoted in the document content.
      const doc = `title: Note\ntext: my key is ed25519:${key.publicKey}\n`;
      const res = signDocumentCrypto(doc, { signer: "A", privateKey: key.privateKey });
      expect(res.note).not.toBe("already-signed");
      // And it genuinely signed.
      const [chk] = verifyCryptoSignatures(res.source);
      expect(chk.cryptographic).toBe(true);
      expect(chk.valid).toBe(true);
    });
  });
});
