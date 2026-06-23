/**
 * typed-value.test.ts — FORMAT-ROADMAP T-05B (reserved typed-value shape).
 */
import { describe, it, expect } from "vitest";
import {
  readTypedValue,
  parseNumericValue,
  metricTypedValue,
  parseIntentText,
} from "../src/index";

describe("T-05B: typed-value shape (value + unit)", () => {
  it("money — bare number + ISO-4217 unit", () => {
    expect(readTypedValue("17325", "QAR")).toMatchObject({
      number: 17325,
      currency: "QAR",
      kind: "money",
    });
  });

  it("money — M magnitude suffix and thousands separators are handled", () => {
    expect(readTypedValue("3.80M", "QAR").number).toBe(3_800_000);
    expect(readTypedValue("185M", "USD").number).toBe(185_000_000);
    expect(parseNumericValue("16,500")).toBe(16500);
  });

  it("percent — via unit or a trailing %", () => {
    expect(readTypedValue("5", "%").kind).toBe("percent");
    expect(readTypedValue("38%").kind).toBe("percent");
    expect(readTypedValue("38%").number).toBe(38);
  });

  it("quantity / number / text", () => {
    expect(readTypedValue("42", "points").kind).toBe("quantity");
    expect(readTypedValue("42").kind).toBe("number");
    expect(readTypedValue("Zero")).toMatchObject({ kind: "text", number: null });
  });

  it("metricTypedValue reads a metric: block; templates are non-numeric", () => {
    const doc = parseIntentText("metric: Total Due | value: 17325 | unit: QAR\n");
    const m = doc.blocks.find((b) => b.type === "metric")!;
    expect(metricTypedValue(m)).toMatchObject({ number: 17325, currency: "QAR", kind: "money" });
    expect(parseNumericValue("{{total}}")).toBeNull();
  });
});
