// forms-templates — the fillable/mergeable document surface.
//
// Covers: Insert ▸ Field output (must keep its props), the form lifecycle
// (visibility / computed / completeness via core), and template {{var}} extraction
// + merge. The FormFill UI (render/show-if/compute) is covered in FormFill.test.tsx.

import { describe, it, expect } from "vitest";
import {
  parseIntentText,
  parseAndMerge,
  documentToSource,
  applyAnswers,
  formVisibility,
  computeFormValues,
  isFormComplete,
  missingRequiredFields,
} from "@dotit/core";
import { docToSource } from "../src/bridge";
import { extractTemplateVariables } from "../src/template-highlight";

describe("Insert ▸ Field", () => {
  it("an inserted input: field keeps ALL its props through serialize", () => {
    // What the ribbon's insertField builds: an itGenericBlock with keyword:input
    // and a properties string. (Regression: props used to be dropped on serialize.)
    const doc = {
      type: "doc",
      content: [
        {
          type: "itGenericBlock",
          attrs: { keyword: "input", properties: "type: text | required: yes" },
          content: [{ type: "text", text: "Legal name" }],
        },
      ],
    };
    const src = docToSource(doc);
    expect(src).toBe("input: Legal name | type: text | required: yes");
    const block = parseIntentText(src).blocks[0];
    expect(block.type).toBe("input");
    expect(block.properties?.type).toBe("text");
    expect(block.properties?.required).toBe("yes");
  });
});

describe("form lifecycle (core, as the editor drives it)", () => {
  const FORM = [
    "meta: | type: form",
    "input: Country | key: country | type: choice | options: KW, SA | required: yes",
    "input: VAT | key: vat | type: text | show-if: country = SA | required: yes",
    "input: Qty | key: qty | type: number | value: 4",
    "input: Total | key: total | type: number | compute: qty * 250",
  ].join("\n");

  it("show-if hides the conditional field until its condition holds", () => {
    expect(formVisibility(applyAnswers(FORM, { country: "KW" })).vat).toBe(false);
    expect(formVisibility(applyAnswers(FORM, { country: "SA" })).vat).toBe(true);
  });

  it("computed field derives from other fields", () => {
    expect(computeFormValues(applyAnswers(FORM, {})).total).toBe("1000"); // 4*250
    expect(computeFormValues(applyAnswers(FORM, { qty: "10" })).total).toBe("2500");
  });

  it("completeness: a hidden required field doesn't block completion", () => {
    const kw = applyAnswers(FORM, { country: "KW" }); // vat hidden → not required
    expect(missingRequiredFields(kw)).toEqual([]);
    expect(isFormComplete(kw)).toBe(true);
    const sa = applyAnswers(FORM, { country: "SA" }); // vat now required + empty
    expect(missingRequiredFields(sa)).toContain("vat");
    expect(isFormComplete(sa)).toBe(false);
  });
});

describe("templates — {{variables}} + merge", () => {
  const TPL =
    "title: Invoice {{invoice.number}}\ntext: Bill {{client.name}} for {{invoice.total}}";

  it("extracts every distinct variable path", () => {
    const vars = extractTemplateVariables(TPL);
    expect(vars).toContain("invoice.number");
    expect(vars).toContain("client.name");
    expect(vars).toContain("invoice.total");
  });

  it("merge replaces resolved vars and flags unresolved ones", () => {
    const merged = parseAndMerge(TPL, {
      invoice: { number: "INV-42" },
      client: { name: "Acme" },
      // invoice.total intentionally missing
    });
    const out =
      typeof merged === "string" ? merged : documentToSource(merged);
    expect(out).toContain("Invoice INV-42");
    expect(out).toContain("Bill Acme");
    // The missing var is left visible (not silently blanked) + flagged.
    expect(out).toContain("{{invoice.total}}");
    expect(out).toMatch(/unresolved:/);
  });

  it("a fully-merged template has no remaining placeholders", () => {
    const merged = parseAndMerge(TPL, {
      invoice: { number: "INV-7", total: "9000" },
      client: { name: "Dalil" },
    });
    const out =
      typeof merged === "string" ? merged : documentToSource(merged);
    expect(out).not.toMatch(/\{\{.*\}\}/);
    expect(out).not.toMatch(/unresolved:/);
  });
});
