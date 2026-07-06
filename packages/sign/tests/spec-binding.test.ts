import { describe, it, expect } from "vitest";
import {
  generateSigningKey,
  signDocumentCrypto,
  verifyCryptoSignatures,
} from "../src/index";

// #37: the canonicalization `spec:` selector chooses which byte-rules verification uses.
// If it isn't bound into the signature, an attacker can DOWNGRADE it to a weaker ruleset.
// It is now part of the signed payload.
describe("#37: canonicalization spec is bound into the signature", () => {
  const DOC = "title: Agreement\n\ntext: Pay USD 100.";
  it("swapping the spec: field breaks the signature", () => {
    const k = generateSigningKey();
    const s = signDocumentCrypto(DOC, { signer: "Ahmed", privateKey: k.privateKey });
    expect(verifyCryptoSignatures(s.source)[0].valid).toBe(true);
    const downgraded = s.source.replace(/\| spec: \d+/, "| spec: 0");
    expect(verifyCryptoSignatures(downgraded)[0].valid).toBe(false);
  });
});
