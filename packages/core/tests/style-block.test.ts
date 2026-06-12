// Scoped document styles (`style:` blocks, v4.3) — house styling declared once,
// applied identically by renderHTML, renderPrint, and (via documentStyleCSS with a
// selector map) the visual editor.
import { describe, it, expect } from "vitest";
import {
  parseIntentText,
  renderHTML,
  renderPrint,
  documentToSource,
  collectDocumentStyles,
  documentStyleCSS,
} from "../src/index";

const SRC = `style: section | color: #0a7 | weight: 600
style: title | family: Georgia | size: 26pt
style: metric | color: #333

title: Branded Invoice
section: Items
metric: Total | value: 100`;

describe("style: blocks", () => {
  it("parses as 'style' blocks and collects sanitized rules", () => {
    const doc = parseIntentText(SRC);
    const rules = collectDocumentStyles(doc);
    expect(rules).toEqual([
      { target: "section", declarations: "color: #0a7; font-weight: 600" },
      { target: "title", declarations: "font-size: 26pt; font-family: Georgia" },
      { target: "metric", declarations: "color: #333" },
    ]);
  });

  it("emits CSS in renderHTML and renderPrint, after the theme (overrides)", () => {
    for (const html of [renderHTML(parseIntentText(SRC)), renderPrint(parseIntentText(SRC))]) {
      expect(html).toContain(".intent-section{color: #0a7; font-weight: 600;}");
      expect(html).toContain(".intent-title{font-size: 26pt; font-family: Georgia;}");
      expect(html).toContain(".it-metric-row{color: #333;}");
    }
  });

  it("style: lines are invisible in the rendered body", () => {
    const html = renderHTML(parseIntentText(SRC));
    expect(html).not.toMatch(/<p[^>]*>\s*section\b/);
    expect(html).toContain(">Branded Invoice<");
  });

  it("drops unknown targets and neutralizes hostile values (no </style> breakout)", () => {
    const hostile = `style: bogus | color: red
style: text | color: #c00"</style><script>alert(1)</script>
title: T`;
    const doc = parseIntentText(hostile);
    const rules = collectDocumentStyles(doc);
    expect(rules.find((r) => r.target === "bogus")).toBeUndefined();
    const html = renderHTML(doc);
    expect(html).not.toContain("<script>");
  });

  it("round-trips every style: line exactly (blank lines are not significant)", () => {
    const lines = (s: string) => s.split("\n").filter((l) => l.trim() !== "");
    expect(lines(documentToSource(parseIntentText(SRC)))).toEqual(lines(SRC));
  });

  it("documentStyleCSS supports a consumer selector map + prefix (editor parity)", () => {
    const css = documentStyleCSS(
      parseIntentText(SRC),
      { section: [".it-doc-section"], title: [".it-doc-title"], metric: [".it-doc-metric"] },
      ".docs-page .tiptap ",
    );
    expect(css).toContain(".docs-page .tiptap .it-doc-section{color: #0a7; font-weight: 600;}");
  });
});
