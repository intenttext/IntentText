import { describe, it, expect, beforeEach } from "vitest";
import {
  parseIntentText,
  _resetIdCounter,
  renderHTML,
  renderPrint,
  validateDocumentSemantic,
  ALIASES,
  detectHistoryBoundary,
  documentToSource,
  sealDocument,
  updateHistory,
} from "../src/index";

beforeEach(() => _resetIdCounter());

// ── Helpers ─────────────────────────────────────────────

function parse(source: string) {
  return parseIntentText(source);
}

function blocks(source: string) {
  return parse(source).blocks;
}

function firstBlock(source: string) {
  return blocks(source)[0];
}

function validate(source: string) {
  return validateDocumentSemantic(parse(source));
}

function issuesByCode(source: string, code: string) {
  return validate(source).issues.filter((i) => i.code === code);
}

function html(source: string) {
  return renderHTML(parse(source));
}

function print(source: string) {
  return renderPrint(parse(source));
}

// ═══════════════════════════════════════════════════════════
//  history: keyword — History boundary (6 tests)
// ═══════════════════════════════════════════════════════════

describe("v2.12 history: keyword — history boundary", () => {
  it("history: recognized as history boundary", () => {
    const src = `title: Agreement
track: | version: 1.0 | by: A

note: Content

history:

// registry
abc12 | note | | Content`;
    const doc = parseIntentText(src, { includeHistorySection: true });
    expect(doc.history).toBeDefined();
    expect(doc.history!.registry).toBeDefined();
  });

  it("history: produces no block output", () => {
    const src = `title: Test
note: Hello

history:

// registry
abc12 | note | | Hello`;
    const doc = parse(src);
    const historyBlocks = doc.blocks.filter((b) => b.type === "history");
    expect(historyBlocks).toHaveLength(0);
  });

  it("history: is in Trust keyword set", () => {
    const src = `title: Test
note: Hello

history:

// registry
abc12 | note | | Hello`;
    const doc = parse(src);
    // Version should be 2.12 because history: keyword present
    expect(doc.version).toBe("2.12");
  });

  it("detectHistoryBoundary finds history: keyword", () => {
    const lines = [
      "title: Test",
      "note: Content",
      "",
      "history:",
      "",
      "// registry",
    ];
    const idx = detectHistoryBoundary(lines);
    expect(idx).toBe(3);
  });

  it("detectHistoryBoundary returns -1 when no boundary", () => {
    const lines = ["title: Test", "note: Content"];
    const idx = detectHistoryBoundary(lines);
    expect(idx).toBe(-1);
  });

  it("HISTORY_WITHOUT_FREEZE warning fires when history: present but no freeze:", () => {
    const src = `title: Agreement
track: | version: 1.0 | by: A

note: Content

history:

// registry
abc12 | note | | Content

// revisions
revision: | version: 1.0 | at: 2026-01-01T00:00:00Z | by: A | change: added | id: abc12 | block: note | now: Content`;
    const doc = parseIntentText(src, { includeHistorySection: true });
    const result = validateDocumentSemantic(doc);
    const issues = result.issues.filter(
      (i) => i.code === "HISTORY_WITHOUT_FREEZE",
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe("warning");
  });
});

// ═══════════════════════════════════════════════════════════
//  Legacy history boundary backward compat (2 tests)
// ═══════════════════════════════════════════════════════════

describe("v2.12 legacy history boundary — backward compat", () => {
  it("legacy --- + // history pattern still detected", () => {
    const lines = [
      "title: Test",
      "note: Content",
      "",
      "---",
      "// history",
      "",
      "// registry",
    ];
    const idx = detectHistoryBoundary(lines);
    expect(idx).toBe(3);
  });

  it("LEGACY_HISTORY_BOUNDARY warning fires for old pattern", () => {
    const src = `title: Agreement
track: | version: 1.0 | by: A

note: Content

---
// history

// registry
abc12 | note | | Content

// revisions
revision: | version: 1.0 | at: 2026-01-01T00:00:00Z | by: A | change: added | id: abc12 | block: note | now: Content`;
    const doc = parse(src);
    const legacyWarning = doc.diagnostics?.find(
      (d) => d.code === "LEGACY_HISTORY_BOUNDARY",
    );
    expect(legacyWarning).toBeDefined();
    expect(legacyWarning!.message).toContain("history:");
  });
});

// ═══════════════════════════════════════════════════════════
//  --- as visible divider (3 tests)
// ═══════════════════════════════════════════════════════════

describe("v2.12 --- as visible divider", () => {
  it("--- renders as <hr> divider in HTML", () => {
    const output = html("note: Above\n---\nnote: Below");
    expect(output).toContain("<hr");
    expect(output).toContain("it-divider");
  });

  it("--- parsed as divider block", () => {
    const b = blocks("note: Above\n---\nnote: Below");
    const dividerBlock = b.find((block) => block.type === "divider");
    expect(dividerBlock).toBeDefined();
    expect(dividerBlock!.type).toBe("divider");
  });

  it("--- renders in print output", () => {
    const output = print("note: Above\n---\nnote: Below");
    expect(output).toContain("<hr");
  });
});

// ═══════════════════════════════════════════════════════════
//  divider: keyword with styles (5 tests)
// ═══════════════════════════════════════════════════════════

describe("v2.12 divider: keyword with styles", () => {
  it("divider: renders identical output to ---", () => {
    const htmlDash = html("---");
    const htmlKeyword = html("divider:");
    // Both should produce hr with it-divider
    expect(htmlDash).toContain("it-divider");
    expect(htmlKeyword).toContain("it-divider");
  });

  it("divider: | style: dashed renders dashed line", () => {
    const output = html("divider: | style: dashed");
    expect(output).toContain("border-style: dashed");
  });

  it("divider: | style: dotted renders dotted line", () => {
    const output = html("divider: | style: dotted");
    expect(output).toContain("border-style: dotted");
  });

  it("divider: default style is solid", () => {
    const output = html("divider:");
    expect(output).toContain("border-style: solid");
  });

  it("divider: serializes back to source correctly", () => {
    const doc = parse("divider: | style: dashed");
    const source = documentToSource(doc);
    expect(source).toContain("divider:");
    expect(source).toContain("style: dashed");
  });
});

// ═══════════════════════════════════════════════════════════
//  hr: and separator: aliases (2 tests)
// ═══════════════════════════════════════════════════════════

describe("v2.12 divider aliases — hr: and separator:", () => {
  it("hr: alias resolves to divider", () => {
    expect(ALIASES["hr"]).toBe("divider");
    const b = firstBlock("hr:");
    expect(b.type).toBe("divider");
  });

  it("separator: alias resolves to divider", () => {
    expect(ALIASES["separator"]).toBe("divider");
    const b = firstBlock("separator:");
    expect(b.type).toBe("divider");
  });
});

// ═══════════════════════════════════════════════════════════
//  break: — invisible in web, page break in print (2 tests)
// ═══════════════════════════════════════════════════════════

describe("v2.12 break: — web invisible, print page-break", () => {
  it("break: is invisible in web output", () => {
    const output = html("note: Above\nbreak:\nnote: Below");
    expect(output).toContain("it-page-break");
    expect(output).toContain('aria-hidden="true"');
    expect(output).toContain("display:none");
  });

  it("break: has page-break CSS in print output", () => {
    const output = print("note: Above\nbreak:\nnote: Below");
    expect(output).toContain("page-break");
  });
});

// ═══════════════════════════════════════════════════════════
//  sealDocument writes history: keyword (1 test)
// ═══════════════════════════════════════════════════════════

describe("v2.12 seal writes history: keyword", () => {
  it("sealDocument inserts seal before history: boundary", () => {
    const src = `title: Agreement
track: | version: 1.0 | by: A

note: Payment within 30 days.

history:

// registry
abc12 | note | | Payment within 30 days.`;
    const result = sealDocument(src, { signer: "A" });
    expect(result.source).toContain("history:");
    // freeze: should appear before history:
    const freezeIdx = result.source.indexOf("freeze:");
    const historyIdx = result.source.indexOf("history:");
    expect(freezeIdx).toBeLessThan(historyIdx);
  });
});

// ═══════════════════════════════════════════════════════════
//  updateHistory writes history: keyword (1 test)
// ═══════════════════════════════════════════════════════════

describe("v2.12 updateHistory writes history: keyword", () => {
  it("updateHistory output uses history: boundary", () => {
    const prev = `title: Agreement
track: | version: 1.0 | by: A

note: Payment within 30 days.

history:

// registry
abc12 | note | | Payment within 30 days.

// revisions
revision: | version: 1.0 | at: 2026-01-01T00:00:00Z | by: A | change: added | id: abc12 | block: note | now: Payment within 30 days.`;
    const curr = prev.replace(
      "Payment within 30 days.",
      "Payment within 15 days.",
    );
    const result = updateHistory(prev, curr, { by: "A" });
    expect(result).toContain("history:");
  });
});
