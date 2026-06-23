/**
 * conformance.test.ts — FORMAT-ROADMAP T-16 (named conformance / strict mode).
 */
import { describe, it, expect } from "vitest";
import { checkConformance, parseIntentText } from "../src/index";

describe("T-16: checkConformance", () => {
  it("a clean document is conformant at both levels", () => {
    const src = "title: Invoice\ntext: hello\nmetric: Total | value: 100 | unit: QAR\n";
    expect(checkConformance(src).conformant).toBe(true);
    expect(checkConformance(src, { level: "strict" }).conformant).toBe(true);
  });

  it("unknown keywords are NOT errors — custom passthrough stays conformant", () => {
    const r = checkConformance("title: X\nمصروف: كراسي | فئة: أثاث\nexpense: chairs\n");
    expect(r.conformant).toBe(true);
    expect(r.errors).toBe(0);
  });

  it("a non-ISO date is lax-conformant but FAILS strict (a warning)", () => {
    const src = "title: X\ntask: Ship | due: 09/03/2026\n";
    expect(checkConformance(src).conformant).toBe(true); // lax: warnings allowed
    const strict = checkConformance(src, { level: "strict" });
    expect(strict.conformant).toBe(false);
    expect(strict.warnings).toBeGreaterThan(0);
    expect(strict.issues.some((i) => i.code === "DATE_NOT_ISO")).toBe(true);
  });

  it("accepts an already-parsed document, and is read-only", () => {
    const doc = parseIntentText("title: X\ntext: hi\n");
    const before = JSON.stringify(doc);
    const r = checkConformance(doc, { level: "strict" });
    expect(r.conformant).toBe(true);
    expect(JSON.stringify(doc)).toBe(before); // unchanged — pure
  });
});
