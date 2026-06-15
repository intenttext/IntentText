import { describe, it, expect } from "vitest";
import {
  isForm,
  isFormComplete,
  extractFormFields,
  formAnswers,
  missingRequiredFields,
  isTemplate,
  assertNotTemplate,
  parseIntentText,
  queryBlocks,
} from "../src/index";

const BLANK_FORM = `title: Vendor Onboarding
meta: | type: form

section: Company
input: Legal name | key: legal_name | type: text | required: yes
input: Country | key: country | type: choice | options: KW, SA, AE | required: yes
input: VAT registered? | key: vat | type: checkbox
input: Notes | key: notes | type: textarea
`;

const FILLED_FORM = `title: Vendor Onboarding
meta: | type: form

section: Company
input: Legal name | key: legal_name | type: text | required: yes | value: Dalil Technology
input: Country | key: country | type: choice | options: KW, SA, AE | required: yes | value: KW
input: VAT registered? | key: vat | type: checkbox | value: yes
input: Notes | key: notes | type: textarea
`;

describe("isForm", () => {
  it("true only with meta: type: form", () => {
    expect(isForm(BLANK_FORM)).toBe(true);
    expect(isForm("input: Name | key: n\n")).toBe(false); // input alone ≠ form
    expect(isForm("text: hi\n")).toBe(false);
  });
});

describe("extractFormFields", () => {
  it("reads block fields with key/type/required/options/value", () => {
    const f = extractFormFields(FILLED_FORM);
    expect(f.map((x) => x.key)).toEqual(["legal_name", "country", "vat", "notes"]);
    const country = f.find((x) => x.key === "country")!;
    expect(country.type).toBe("choice");
    expect(country.options).toEqual(["KW", "SA", "AE"]);
    expect(country.required).toBe(true);
    expect(country.value).toBe("KW");
    expect(country.filled).toBe(true);
  });
  it("defaults key to a slug of the label", () => {
    const f = extractFormFields("meta: | type: form\ninput: Full Name | type: text\n");
    expect(f[0].key).toBe("full_name");
  });
  it("reads inline [value]{input: key} fields", () => {
    const src =
      "meta: | type: form\ntext: I, [Jane Doe]{input: signer; type: text}, agree to pay [120]{input: amount; type: number; required: yes}.\n";
    const f = extractFormFields(src);
    expect(f.map((x) => x.key).sort()).toEqual(["amount", "signer"]);
    expect(f.find((x) => x.key === "signer")!.value).toBe("Jane Doe");
    expect(f.find((x) => x.key === "amount")!.inline).toBe(true);
  });
  it("ignores normal styled spans (no input prop)", () => {
    const f = extractFormFields("meta: | type: form\ntext: [bold]{weight: bold}\n");
    expect(f).toHaveLength(0);
  });
});

describe("isFormComplete", () => {
  it("false when a required field is blank", () => {
    expect(isFormComplete(BLANK_FORM)).toBe(false);
    expect(missingRequiredFields(BLANK_FORM)).toEqual(["legal_name", "country"]);
  });
  it("true when all required fields are answered (optional may be blank)", () => {
    expect(isFormComplete(FILLED_FORM)).toBe(true);
    expect(missingRequiredFields(FILLED_FORM)).toEqual([]);
  });
  it("required checkbox must be checked", () => {
    const src =
      "meta: | type: form\ninput: I agree | key: agree | type: checkbox | required: yes\n";
    expect(isFormComplete(src)).toBe(false);
    expect(isFormComplete(src.replace("required: yes", "required: yes | value: yes"))).toBe(true);
  });
});

describe("formAnswers", () => {
  it("maps key -> value", () => {
    expect(formAnswers(FILLED_FORM)).toEqual({
      legal_name: "Dalil Technology",
      country: "KW",
      vat: "yes",
      notes: "",
    });
  });
});

describe("query answers by field key", () => {
  it("matches a returned form by its answer key", () => {
    const doc = parseIntentText(FILLED_FORM);
    expect(queryBlocks(doc, "country=KW").matched).toBe(1);
    expect(queryBlocks(doc, "country=SA").matched).toBe(0);
    expect(queryBlocks(doc, "vat=yes").matched).toBe(1);
  });
});

describe("trust gate (THE core change)", () => {
  it("a blank/incomplete form is template-like (NOT signable)", () => {
    expect(isTemplate(BLANK_FORM)).toBe(true);
    expect(() => assertNotTemplate(BLANK_FORM, "signed")).toThrow();
  });
  it("a COMPLETE form is a final record (signable)", () => {
    expect(isTemplate(FILLED_FORM)).toBe(false);
    expect(() => assertNotTemplate(FILLED_FORM, "signed")).not.toThrow();
  });
  it("legacy input: merge-templates (no meta:type:form) stay templates", () => {
    expect(isTemplate("input: Name | key: n | value: x\n")).toBe(true);
  });
  it("explicit meta:type:template still wins even if it looks complete", () => {
    expect(isTemplate("meta: | type: template\ntext: hi\n")).toBe(true);
  });
});
