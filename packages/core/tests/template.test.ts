import { describe, it, expect } from "vitest";
import {
  isTemplate,
  hasUnresolvedMergeVars,
  sealDocument,
  detectTrustState,
  parseIntentText,
  documentToSource,
} from "../src/index";

describe("isTemplate", () => {
  it("true for the explicit marker meta: type: template", () => {
    expect(isTemplate("meta: | type: template\n\ntext: hi\n")).toBe(true);
  });
  it("true for input: fields", () => {
    expect(isTemplate("title: Form\n\ninput: Name | id: name\n")).toBe(true);
  });
  it("true for unresolved {{ merge variables }}", () => {
    expect(isTemplate("title: {{client}}\n\ntext: Owed: {{total}}\n")).toBe(true);
  });
  it("FALSE for the print tokens {{page}}/{{pages}} alone", () => {
    expect(isTemplate("footer: Page {{page}} of {{pages}}\n\ntext: final\n")).toBe(
      false,
    );
  });
  it("FALSE for empty values (a blank field is not a template)", () => {
    expect(isTemplate("title: Memo\n\ntask: Do it | owner: | due:\n")).toBe(false);
    expect(hasUnresolvedMergeVars("task: Do it | owner: | due:\n")).toBe(false);
  });
  it("false for a plain final document", () => {
    expect(isTemplate("title: Memo\n\ntext: all set\n")).toBe(false);
  });
});

describe("trust workflow refuses templates", () => {
  it("sealDocument throws on a template (merge variables)", () => {
    expect(() =>
      sealDocument("title: {{client}}\n\ntext: {{body}}\n", { signer: "X" }),
    ).toThrow(/template/i);
  });
  it("sealDocument throws on an explicitly-marked template", () => {
    expect(() =>
      sealDocument("meta: | type: template\n\ntext: hi\n", { signer: "X" }),
    ).toThrow(/template/i);
  });

  // The key invariant from the design discussion: an EMPTY field must NOT be
  // mistaken for a template — a final document with a blank value stays sealable.
  it("a final document with an EMPTY field is still sealable", () => {
    const src = "title: Memo\n\ntask: Ship it | owner: | due:\n";
    expect(isTemplate(src)).toBe(false);
    const res = sealDocument(src, { signer: "Ahmed", skipSign: true });
    expect(res.success).toBe(true);
    expect(res.source).toContain("freeze:");
  });
});

describe("detectTrustState marks templates distinctly", () => {
  it("returns the template tier (not draft) for a template", () => {
    const s = detectTrustState("meta: | type: template\n\ntext: hi\n");
    expect(s.tier).toBe("template");
    expect(s.template).toBe(true);
    expect(s.label).toBe("TEMPLATE");
  });
  it("a plain draft stays draft, not template", () => {
    const s = detectTrustState("title: Memo\n\ntext: hi\n");
    expect(s.tier).toBe("draft");
    expect(s.template).toBe(false);
  });
});

describe("empty values round-trip cleanly", () => {
  it("serialises an empty value as a clean `key:` (no trailing space)", () => {
    const src = "title: Memo\n\ntask: Ship it | owner: | due:\n";
    const back = documentToSource(parseIntentText(src));
    // no double-space and no trailing space after the empty keys
    expect(back).not.toMatch(/owner:\s\s/);
    expect(back).toContain("owner:");
    expect(back).toContain("due:");
    // idempotent
    expect(documentToSource(parseIntentText(back))).toBe(back);
  });
});
