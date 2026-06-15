// Regression tests encoding the Jadwal ERP consumer's hard requirements for the
// @dotit/core 1.10.0 release. If any of these fail, DO NOT publish.
import { describe, it, expect } from "vitest";
import {
  sealDocument,
  verifyDocument,
  isTemplate,
  assertNotTemplate,
  isForm,
  isFormComplete,
  applyAnswers,
  formAnswers,
  missingRequiredFields,
} from "../src/index";

describe("Jadwal release — {{page}} render tokens are sealable", () => {
  // The published 1.9.0 wrongly treated {{page}}/{{pages}} as unresolved merge
  // variables → "this is a template, cannot be sealed". They are render-time
  // counters, NOT merge vars, so a document using them MUST seal.
  const invoice = `title: Invoice INV-1001
meta: | author: Jadwal
footer: Page {{page}} of {{pages}}
page: | size: A4
section: Items
text: Consulting | end: 1,200.00
`;

  it("a doc with {{page}}/{{pages}} in footer/page is NOT a template", () => {
    expect(isTemplate(invoice)).toBe(false);
    expect(() => assertNotTemplate(invoice, "sealed")).not.toThrow();
  });

  it("sealing such a doc does not throw and verifies intact", () => {
    let sealed = "";
    expect(() => {
      sealed = sealDocument(invoice, { signer: "Jadwal" }).source;
    }).not.toThrow();
    expect(verifyDocument(sealed).intact).toBe(true);
  });
});

describe("Jadwal release — legacy @intenttext@4.3 seals still verify", () => {
  // Protects already-issued legal invoices: a document sealed by the OLD
  // @intenttext/core@4.3.0 must still verify intact under the new @dotit/core.
  it("verifies a document sealed by @intenttext/core@4.3.0", async () => {
    const legacy = await import("@intenttext/core");
    const invoice = `title: Invoice INV-2002
meta: | author: Jadwal
section: Items
text: Service | end: 900.00
`;
    const r = (legacy as { sealDocument: (s: string, o: unknown) => { source: string } })
      .sealDocument(invoice, { signer: "Jadwal" });
    const legacySealed = r.source ?? (r as unknown as string);
    expect(verifyDocument(legacySealed).intact).toBe(true);
  });
});

describe("Jadwal release — forms API round-trip", () => {
  const form = `title: Vendor Onboarding
meta: | type: form
input: Legal name | key: legal_name | type: text | required: yes
input: Country | key: country | type: choice | options: KW, SA | required: yes
input: Notes | key: notes | type: textarea
`;

  it("forms API is present and the lifecycle works", () => {
    expect(isForm(form)).toBe(true);
    expect(isFormComplete(form)).toBe(false);
    expect(missingRequiredFields(form)).toEqual(["legal_name", "country"]);

    const filled = applyAnswers(form, {
      legal_name: "Dalil Technology",
      country: "KW",
    });
    expect(isFormComplete(filled)).toBe(true);
    expect(formAnswers(filled)).toMatchObject({
      legal_name: "Dalil Technology",
      country: "KW",
      notes: "",
    });
  });

  it("a COMPLETE form is a final, sealable record; verifies intact", () => {
    const filled = applyAnswers(form, {
      legal_name: "Dalil Technology",
      country: "KW",
    });
    expect(isTemplate(filled)).toBe(false);
    const sealed = sealDocument(filled, { signer: "Sarah Al-Ahmad" }).source;
    expect(verifyDocument(sealed).intact).toBe(true);
    // answers survive sealing + are still queryable
    expect(formAnswers(sealed).legal_name).toBe("Dalil Technology");
  });

  it("a BLANK form stays template-like (not sealable)", () => {
    expect(isTemplate(form)).toBe(true);
    expect(() => assertNotTemplate(form, "sealed")).toThrow();
  });
});
