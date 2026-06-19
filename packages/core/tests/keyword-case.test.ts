/**
 * keyword-case.test.ts — UNKNOWN (custom) keywords keep their case (G-18).
 *
 * `Invoice:` / `LedgerCode:` previously round-tripped lowercased — a byte-preservation
 * miss and an author surprise. (KNOWN keywords/aliases like `title:`/`ref:` still
 * canonicalize to their registered form — that is intended canonicalization, not this.)
 * The lowercased form is used only for registry lookup; the AS-WRITTEN keyword is stored
 * and re-emitted.
 */
import { describe, it, expect } from "vitest";
import { parseIntentText, documentToSource } from "../src/index";

describe("G-18: custom keyword case is preserved", () => {
  it("re-emits an unknown keyword with its original case", () => {
    const out = documentToSource(parseIntentText("Invoice: INV-2026-1\n"));
    expect(out).toContain("Invoice:");
    expect(out).not.toContain("invoice:");
  });

  it("round-trips mixed-case custom keywords byte-stably", () => {
    const src = "Memo: AB-12\nLedgerCode: 4400\n";
    const once = documentToSource(parseIntentText(src));
    const twice = documentToSource(parseIntentText(once));
    expect(once).toContain("Memo:");
    expect(once).toContain("LedgerCode:");
    expect(twice).toBe(once); // idempotent
  });

  it("non-ASCII (Arabic) custom keywords are unchanged", () => {
    const out = documentToSource(parseIntentText("مصروف: كراسي\n"));
    expect(out).toContain("مصروف:");
  });

  it("the stored keyword property carries the original case", () => {
    const doc = parseIntentText("Invoice: INV-1\n");
    const custom = doc.blocks.find((b) => b.type === "custom");
    expect(custom?.properties?.keyword).toBe("Invoice");
  });
});
