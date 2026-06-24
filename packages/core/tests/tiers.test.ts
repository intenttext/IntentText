import { describe, it, expect } from "vitest";
import {
  CANONICAL_KEYWORDS,
  KEYWORD_TIERS,
  CORE_KEYWORDS,
  tierOf,
  LANGUAGE_REGISTRY,
} from "../src";

describe("keyword tiers (v4.1)", () => {
  it("partitions every canonical keyword into exactly one tier", () => {
    const flat = Object.values(KEYWORD_TIERS).flat();
    // No duplicates across tiers.
    expect(new Set(flat).size).toBe(flat.length);
    // Covers exactly the canonical (stable) set.
    expect(new Set(flat)).toEqual(new Set(CANONICAL_KEYWORDS));
  });

  it("keeps the everyday core set small (<= 16) and includes the essentials", () => {
    expect(CORE_KEYWORDS.length).toBeLessThanOrEqual(16);
    for (const kw of ["title", "section", "text", "task", "done", "link"]) {
      expect(CORE_KEYWORDS).toContain(kw);
    }
  });

  it("places profile keywords in their profiles, not core", () => {
    expect(KEYWORD_TIERS.agent).toContain("step");
    expect(KEYWORD_TIERS.contract).toContain("sign");
    expect(KEYWORD_TIERS.print).toContain("watermark");
    expect(CORE_KEYWORDS).not.toContain("sign");
    expect(CORE_KEYWORDS).not.toContain("watermark");
  });

  it("honors per-keyword overrides", () => {
    const route = LANGUAGE_REGISTRY.find((k) => k.canonical === "route")!;
    expect(tierOf(route)).toBe("contract"); // override: agent -> contract
    const task = LANGUAGE_REGISTRY.find((k) => k.canonical === "task")!;
    expect(tierOf(task)).toBe("core"); // override: agent -> core
  });
});
