// Jadwal release regression: a filled IntentText FORM is a final record that can
// be cryptographically signed (Ed25519) and verified — forms (core) + signatures
// (sign) working end-to-end, the consumer's hard requirement.
import { describe, it, expect } from "vitest";
import {
  isForm,
  isFormComplete,
  applyAnswers,
  formAnswers,
} from "@dotit/core";
import {
  generateSigningKey,
  signDocumentCrypto,
  verifyCryptoSignatures,
} from "../src/index";

describe("forms + crypto signatures (round-trip)", () => {
  const form = `title: Service Agreement
meta: | type: form
input: Vendor | key: vendor | type: text | required: yes
input: Amount | key: amount | type: number | required: yes
`;

  it("fill → complete → crypto-sign → verify, answers intact", () => {
    expect(isForm(form)).toBe(true);

    const filled = applyAnswers(form, {
      vendor: "Dalil Technology",
      amount: "12000",
    });
    expect(isFormComplete(filled)).toBe(true);

    const { privateKey } = generateSigningKey();
    const signed = signDocumentCrypto(filled, {
      signer: "Sarah Al-Ahmad",
      role: "CFO",
      privateKey,
    });
    expect(signed.success).toBe(true);

    const checks = verifyCryptoSignatures(signed.source);
    expect(checks).toHaveLength(1);
    expect(checks[0].valid).toBe(true);
    expect(checks[0].cryptographic).toBe(true);
    expect(checks[0].signer).toBe("Sarah Al-Ahmad");

    // answers survive signing + remain queryable
    expect(formAnswers(signed.source)).toMatchObject({
      vendor: "Dalil Technology",
      amount: "12000",
    });
  });

  it("editing an answer after signing breaks the signature", () => {
    const filled = applyAnswers(form, { vendor: "Acme", amount: "100" });
    const { privateKey } = generateSigningKey();
    const signed = signDocumentCrypto(filled, { signer: "X", privateKey });
    const tampered = signed.source.replace("Acme", "Evil Corp");
    expect(verifyCryptoSignatures(tampered)[0].valid).toBe(false);
  });
});
