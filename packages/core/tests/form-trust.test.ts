import { describe, it, expect } from "vitest";
import {
  formStructureHash,
  sealFormStructure,
  verifyFormStructure,
  extractFormSeal,
  applyAnswers,
  addAttachment,
  sealDocument,
  verifyDocument,
} from "../src/index";

const FORM = `meta: | type: form
title: Vendor Onboarding
input: Legal name | key: legal_name | type: text | required: yes
input: Country | key: country | type: choice | options: KW, SA | required: yes
text: I, [ ]{input: signer}, confirm the above.`;

describe("two-party form trust — structure hash", () => {
  it("is identical for a blank form and any filled copy (answers ignored)", () => {
    const filled = applyAnswers(FORM, { legal_name: "Dalil Tech", country: "KW", signer: "Sarah" });
    expect(formStructureHash(filled)).toBe(formStructureHash(FORM));
  });

  it("changes when the STRUCTURE changes (field added / label reworded / required flipped)", () => {
    const base = formStructureHash(FORM);
    expect(formStructureHash(FORM + "\ninput: Sneaky | key: x | type: text")).not.toBe(base);
    expect(formStructureHash(FORM.replace("Legal name", "Full legal name"))).not.toBe(base);
    expect(formStructureHash(FORM.replace("required: yes", "required: no"))).not.toBe(base);
  });
});

describe("structure seal — author vouches for the blank form", () => {
  it("seals + verifies, and survives the recipient filling it", () => {
    const { source: sealed, structureHash } = sealFormStructure(FORM, { sealer: "Acme HR" });
    expect(extractFormSeal(sealed)).toMatchObject({ sealer: "Acme HR", structureHash });

    const v1 = verifyFormStructure(sealed);
    expect(v1).toMatchObject({ sealed: true, intact: true, sealer: "Acme HR" });

    // recipient fills it → structure seal STILL valid (authenticity survives fill)
    let filled = applyAnswers(sealed, { legal_name: "Dalil Tech", country: "KW", signer: "Sarah" });
    filled = addAttachment(filled, { key: "evidence", name: "cr.pdf", mime: "application/pdf", size: 3, data: "YWJj" });
    expect(verifyFormStructure(filled).intact).toBe(true);
  });

  it("detects structure tampering after sealing", () => {
    const { source: sealed } = sealFormStructure(FORM, { sealer: "Acme HR" });
    // attacker reworded a clause / added a field after the author sealed
    const tampered = sealed.replace("confirm the above", "confirm and waive all claims");
    expect(verifyFormStructure(tampered).intact).toBe(false);
    const added = sealed.replace("form-seal:", "input: Gotcha | key: g | type: text\nform-seal:");
    expect(verifyFormStructure(added).intact).toBe(false);
  });

  it("reports unsealed forms", () => {
    expect(verifyFormStructure(FORM)).toMatchObject({ sealed: false, intact: false });
  });
});

describe("the two layers together — authentic structure + signed answers", () => {
  it("a returned form carries both a valid form-seal AND a valid completion seal", () => {
    // 1. author seals the blank structure and sends it
    const { source: blankSealed } = sealFormStructure(FORM, { sealer: "Acme HR" });
    // 2. recipient fills every field
    const filled = applyAnswers(blankSealed, { legal_name: "Dalil Tech", country: "KW", signer: "Sarah" });
    // 3. recipient seals the COMPLETED record (covers answers + the form-seal line)
    const record = sealDocument(filled, { signer: "Sarah" }).source;

    // author's structure claim holds
    expect(verifyFormStructure(record).intact).toBe(true);
    // filler's completion claim holds
    expect(verifyDocument(record).intact).toBe(true);

    // tampering an ANSWER breaks the completion seal but not the structure seal
    const answerTampered = record.replace("Dalil Tech", "Evil Corp");
    expect(verifyDocument(answerTampered).intact).toBe(false);
    expect(verifyFormStructure(answerTampered).intact).toBe(true);
  });
});
