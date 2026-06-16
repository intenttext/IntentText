import { describe, it, expect } from "vitest";
import {
  computeValue,
  conditionHolds,
  parseCondition,
  formVisibility,
  computeFormValues,
  applyComputedValues,
  isFormComplete,
  missingRequiredFields,
  formAnswers,
} from "../src/index";

describe("safe expression evaluator", () => {
  it("evaluates arithmetic over field values (no eval)", () => {
    const v = { qty: "3", price: "1,200", tax: "0.05" };
    expect(computeValue("qty * price", v)).toBe(3600);
    expect(computeValue("qty * price * (1 + tax)", v)).toBe(3780);
    expect(computeValue("(a + b) / 2", { a: "10", b: "20" })).toBe(15);
    expect(computeValue("missing + 5", {})).toBe(5); // non-numeric → 0
    expect(computeValue("10 / 0", {})).toBe(0); // div-by-zero guarded
  });

  it("parses + evaluates show-if conditions", () => {
    expect(parseCondition("country = SA")).toMatchObject({ key: "country", op: "==", value: "SA" });
    expect(conditionHolds("country = SA", { country: "SA" })).toBe(true);
    expect(conditionHolds("country = SA", { country: "KW" })).toBe(false);
    expect(conditionHolds("amount > 1000", { amount: "1500" })).toBe(true);
    expect(conditionHolds("amount > 1000", { amount: "500" })).toBe(false);
    expect(conditionHolds(undefined, {})).toBe(true); // no condition → visible
  });
});

describe("conditional fields", () => {
  const form = `meta: | type: form
input: Country | key: country | type: choice | options: KW, SA | required: yes | value: KW
input: VAT number | key: vat | type: text | required: yes | show-if: country = SA`;

  it("a hidden required field does not block completeness", () => {
    // country=KW → vat hidden → form complete without it
    expect(formVisibility(form).vat).toBe(false);
    expect(missingRequiredFields(form)).toEqual([]);
    expect(isFormComplete(form)).toBe(true);
  });

  it("a shown required field DOES block completeness until filled", () => {
    const sa = form.replace("value: KW", "value: SA");
    expect(formVisibility(sa).vat).toBe(true);
    expect(missingRequiredFields(sa)).toEqual(["vat"]);
    expect(isFormComplete(sa)).toBe(false);
  });
});

describe("computed fields", () => {
  const form = `meta: | type: form
input: Quantity | key: qty | type: number | required: yes | value: 4
input: Unit price | key: price | type: number | required: yes | value: 250
input: Subtotal | key: subtotal | type: number | compute: qty * price
input: Total | key: total | type: number | compute: subtotal * 1.05`;

  it("computes values, including chained computes (two passes)", () => {
    const c = computeFormValues(form);
    expect(c.subtotal).toBe("1000");
    expect(c.total).toBe("1050");
  });

  it("a compute field never blocks completeness (it's derived)", () => {
    expect(missingRequiredFields(form)).toEqual([]);
    expect(isFormComplete(form)).toBe(true);
  });

  it("applyComputedValues writes the totals back into the source", () => {
    const out = applyComputedValues(form);
    expect(formAnswers(out).subtotal).toBe("1000");
    expect(formAnswers(out).total).toBe("1050");
  });
});
