import { describe, it, expect } from "vitest";
import {
  generateSigningKey,
  signFormStructure,
  verifyFormStructureSignature,
} from "../src/index";
import { sealFormStructure, applyAnswers } from "@dotit/core";

// #21: the author's structure seal must be KEY-BOUND. A name-only form-seal lets a
// filler reword a field, re-seal under the bank's name, and still verify "intact".
// signFormStructure binds the seal to an Ed25519 key so the author is provable.

const form = `title: Wire Authorization Form
meta: | type: form

input: Approve over-limit transfer | key: approve | type: checkbox | required: yes
input: Amount | key: amount | type: number | required: yes`;

describe("@dotit/sign — key-bound form-structure seal (#21)", () => {
  it("a key-bound seal is authentic and survives the recipient FILLING the form", () => {
    const bank = generateSigningKey();
    const sealed = signFormStructure(form, {
      sealer: "TrustBank Compliance",
      role: "Issuer",
      privateKey: bank.privateKey,
    }).source;

    const v = verifyFormStructureSignature(sealed);
    expect(v.cryptographic).toBe(true);
    expect(v.authentic).toBe(true);
    expect(v.intact).toBe(true);
    expect(v.publicKey).toBe(bank.publicKey);

    // Filling answers must NOT break the structure seal (it ignores answer values).
    const filled = applyAnswers(sealed, { approve: "yes", amount: "5000000" });
    const vf = verifyFormStructureSignature(filled);
    expect(vf.authentic).toBe(true);
    expect(vf.intact).toBe(true);
  });

  it("the reword-and-reseal-under-the-bank-name attack is NOT authentic", () => {
    const bank = generateSigningKey();
    const sealed = signFormStructure(form, {
      sealer: "TrustBank Compliance",
      privateKey: bank.privateKey,
    }).source;
    // Filler rewords a field + flips required, then re-seals name-only under the bank's name.
    const tampered = sealed
      .replace("Approve over-limit transfer", "Approve transfer (pre-approved by bank)")
      .replace("required: yes", "required: no");
    const reSealed = sealFormStructure(tampered, {
      sealer: "TrustBank Compliance",
    }).source;

    const v = verifyFormStructureSignature(reSealed);
    expect(v.cryptographic).toBe(false); // no key at all
    expect(v.authentic).toBe(false);
  });

  it("re-signing the tampered form with the ATTACKER's key is caught by key mismatch", () => {
    const bank = generateSigningKey();
    const attacker = generateSigningKey();
    const sealed = signFormStructure(form, {
      sealer: "TrustBank Compliance",
      privateKey: bank.privateKey,
    }).source;
    const tampered = sealed.replace("required: yes", "required: no");
    const forged = signFormStructure(tampered, {
      sealer: "TrustBank Compliance",
      privateKey: attacker.privateKey,
    }).source;

    const v = verifyFormStructureSignature(forged);
    // The signature itself verifies (attacker signed their own tampered structure)…
    expect(v.authentic).toBe(true);
    // …but under the ATTACKER's key, so a bank pinning its author key rejects it.
    expect(v.publicKey).toBe(attacker.publicKey);
    expect(v.publicKey).not.toBe(bank.publicKey);
  });

  it("tampering a key-bound form WITHOUT re-signing breaks intact + authentic", () => {
    const bank = generateSigningKey();
    const sealed = signFormStructure(form, {
      sealer: "TrustBank Compliance",
      privateKey: bank.privateKey,
    }).source;
    const tampered = sealed.replace("Amount", "Amount (USD)");
    const v = verifyFormStructureSignature(tampered);
    expect(v.intact).toBe(false);
    expect(v.authentic).toBe(false);
  });
});
