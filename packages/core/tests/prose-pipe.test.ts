/**
 * prose-pipe.test.ts — FORMAT-ROADMAP T-20-1 (prose-pipe footgun lint).
 *
 * A ` | word: value` segment inside prose is parsed as a property. We do NOT change
 * that parse (it would be a cross-version hash hazard); instead we WARN, so authors
 * can escape a literal pipe as `\|`.
 */
import { describe, it, expect } from "vitest";
import { parseIntentText, validateDocumentSemantic } from "../src/index";

const hasProsePipe = (src: string) =>
  validateDocumentSemantic(parseIntentText(src)).issues.some(
    (i) => i.code === "PROSE_PIPE_SUSPECT",
  );

describe("T-20: prose-pipe lint", () => {
  it("warns when a ` | word: value` is likely swallowed into a prose property", () => {
    expect(hasProsePipe("text: The total is 50 | tax: high\n")).toBe(true);
  });

  it("does NOT warn on legitimate presentation props (end / align / color)", () => {
    expect(hasProsePipe("text: Customer | end: 2026-06-12\n")).toBe(false);
    expect(hasProsePipe("text: Centered | align: center | color: #333\n")).toBe(false);
  });

  it("does NOT warn on non-prose blocks (properties are expected there)", () => {
    expect(hasProsePipe("task: Ship | owner: Ada | priority: high\n")).toBe(false);
    expect(hasProsePipe("metric: Total | value: 100 | unit: QAR\n")).toBe(false);
  });
});
