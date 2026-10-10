// Merged values and contact data that must print as written, in Arabic (RTL) and
// English. Everything here is opt-in: the inline escapes are new syntax, `literal`
// and `contactLinks` are off by default, and a document that uses none of them
// renders exactly as 3.8.0 (legacy-output.test.ts is the gate for that).
import { describe, it, expect } from "vitest";
import {
  parseIntentText,
  parseAndMerge,
  mergeData,
  documentToSource,
  renderHTML,
  renderPrint,
} from "../src/index";
import * as legacy from "dotit-core-legacy";

function inlineTypes(content: string): string[] {
  const b = parseIntentText(`text: ${content}`).blocks[0];
  return (b.inline ?? []).filter((n) => n.type !== "text").map((n) => `${n.type}:${n.value}`);
}

const plainText = (content: string) => parseIntentText(`text: ${content}`).blocks[0].content;

describe("inline escapes: \\ + one of @ # * _ ~ ^ ` [ { = is that character, as text", () => {
  const MARKS = ["@", "#", "*", "_", "~", "^", "`", "[", "{", "="];

  it("every escapable mark yields the literal character and no node", () => {
    for (const m of MARKS) {
      const b = parseIntentText(`text: a \\${m}b ${m}c`).blocks[0];
      expect(b.content.startsWith(`a ${m}b`)).toBe(true);
    }
    expect(inlineTypes("info\\@example.qa")).toEqual([]);
    expect(plainText("info\\@example.qa")).toBe("info@example.qa");
    expect(inlineTypes("البريد info\\@example.qa")).toEqual([]);
    expect(plainText("البريد info\\@example.qa")).toBe("البريد info@example.qa");
  });

  it("escaped marks do not open or close emphasis, tags, mentions or labels", () => {
    expect(inlineTypes("\\*note\\*")).toEqual([]);
    expect(plainText("\\*note\\*")).toBe("*note*");
    expect(inlineTypes("\\*ملاحظة\\*")).toEqual([]);
    expect(plainText("\\*ملاحظة\\*")).toBe("*ملاحظة*");
    expect(inlineTypes("\\#12 and \\#tag")).toEqual([]);
    expect(inlineTypes("\\_x\\_ \\~y\\~ \\^z\\^")).toEqual([]);
    expect(inlineTypes("\\{name} \\[a](b) \\==q\\==")).toEqual([]);
    expect(plainText("\\{name}")).toBe("{name}");
  });

  it("an escaped mark inside an emphasis span is a character of that span", () => {
    expect(inlineTypes("*a \\* b*")).toEqual(["bold:a * b"]);
  });

  it("a backslash before anything else is unchanged", () => {
    expect(plainText("C:\\temp \\n \\.")).toBe("C:\\temp \\n \\.");
    expect(inlineTypes("a \\ b")).toEqual([]);
  });

  it("an unescaped mark still works beside an escaped one", () => {
    expect(inlineTypes("\\@nobody @ali")).toEqual(["mention:ali"]);
    expect(inlineTypes("\\@نوبودي ثم @ali")).toEqual(["mention:ali"]);
  });

  it("a doubled backslash in the source is unescaped by the line first (edge case)", () => {
    // `\\@x` on the line becomes `\@x` before inline parsing, which escapes the @.
    expect(plainText("a\\\\@x")).toBe("a@x");
    expect(inlineTypes("a\\\\@x")).toEqual([]);
  });

  it("renders as plain text in both renderers", () => {
    const doc = parseIntentText("text: Mail info\\@example.qa and \\*literal\\*");
    for (const html of [renderHTML(doc), renderPrint(doc)]) {
      expect(html).toContain("Mail info@example.qa and *literal*");
      expect(html).not.toContain("intent-inline-mention");
      expect(html).not.toMatch(/<strong|<b>/);
    }
  });

  it("a document with no escapes parses exactly as 3.8.0 did", () => {
    for (const s of [
      "text: info@example.qa and #12 and ref_no_2026 and _____",
      "text: البريد info@example.qa · مبنى #12 · ref_no_2026",
    ]) {
      expect(JSON.stringify(parseIntentText(s).blocks.map((b) => b.inline))).toBe(
        JSON.stringify(legacy.parseIntentText(s).blocks.map((b: { inline?: unknown }) => b.inline)),
      );
    }
  });
});

describe("mergeData literal: merged values re-parse as plain text", () => {
  const TEMPLATES = {
    en: "text: Email: {{email}} · Note: {{note}} · Ref {{ref}}",
    ar: "text: البريد: {{email}} · ملاحظة: {{note}} · المرجع {{ref}}",
  };
  const DATA = { email: "info@example.qa", note: "*note*", ref: "#42 ref_no_2026" };

  for (const lang of ["en", "ar"] as const) {
    it(`round trip: merge → source → parse → print shows the values as written (${lang})`, () => {
      const merged = mergeData(parseIntentText(TEMPLATES[lang]), DATA, { literal: true });
      const source = documentToSource(merged);
      const html = renderPrint(parseIntentText(source));
      expect(html).toContain("info@example.qa");
      expect(html).toContain("*note*");
      expect(html).toContain("#42 ref_no_2026");
      expect(html).not.toContain("intent-inline-mention");
      expect(html).not.toContain("intent-inline-tag");
      expect(html).not.toMatch(/<strong|<b>|<em[ >]/);
    });

    it(`parseAndMerge takes the option too (${lang})`, () => {
      const merged = parseAndMerge(TEMPLATES[lang], DATA, { literal: true });
      const html = renderPrint(parseIntentText(documentToSource(merged)));
      expect(html).toContain("info@example.qa");
      expect(html).not.toContain("intent-inline-mention");
    });

    it(`without literal the output is exactly 3.8.0's (${lang})`, () => {
      const now = documentToSource(mergeData(parseIntentText(TEMPLATES[lang]), DATA));
      const old = legacy.documentToSource(
        legacy.mergeData(legacy.parseIntentText(TEMPLATES[lang]), DATA),
      );
      expect(now).toBe(old);
      expect(renderPrint(parseIntentText(now))).toContain("intent-inline-mention");
      expect(documentToSource(parseAndMerge(TEMPLATES[lang], DATA))).toBe(now);
    });
  }

  it("a value with a backslash keeps it, before a mark or not", () => {
    const merged = mergeData(parseIntentText("text: Path {{p}} end"), { p: "C:\\a\\@b \\*x*" }, { literal: true });
    const doc = parseIntentText(documentToSource(merged));
    expect(doc.blocks[0].content).toBe("Path C:\\a\\@b \\*x* end");
    expect(doc.blocks[0].inline?.every((n) => n.type === "text")).toBe(true);
  });

  it("a pipe in a value stays text, not a property delimiter", () => {
    const merged = mergeData(parseIntentText("text: A {{v}} B"), { v: "x | y: z" }, { literal: true });
    const doc = parseIntentText(documentToSource(merged));
    expect(doc.blocks[0].content).toBe("A x | y: z B");
    expect(doc.blocks[0].properties?.y).toBeUndefined();
  });

  it("table cells and properties take the value as written (no escapes leak into them)", () => {
    const merged = mergeData(
      parseIntentText("headers: a | b\nrow: {{e}} | {{n}}\ntext: x | note: {{n}}"),
      { e: "info@example.qa", n: "*n*" },
      { literal: true },
    );
    const html = renderHTML(merged);
    expect(html).toContain(">info@example.qa</td>");
    expect(html).toContain(">*n*</td>");
    expect(html).not.toContain("\\@");
  });
});

describe("renderPrint contactLinks: false prints contact data as text", () => {
  const AR = "contact: شركة الأفق | phone: +974 4400 0001 | email: info@example.qa | url: https://example.qa";
  const EN = "contact: Horizon Trading Co. | phone: +974 4400 0001 | email: info@example.qa | url: https://example.qa";

  for (const [lang, src] of [["ar", AR], ["en", EN]] as const) {
    for (const render of [renderHTML, renderPrint]) {
      it(`${render.name}: text, no link, isolated value (${lang})`, () => {
        const html = render(parseIntentText(src), { contactLinks: false });
        expect(html).toContain('<div class="it-contact-email"><span dir="auto">info@example.qa</span></div>');
        expect(html).toContain('<div class="it-contact-phone"><span dir="auto">+974 4400 0001</span></div>');
        expect(html).toContain('<div class="it-contact-url"><span dir="auto">https://example.qa</span></div>');
        expect(html).not.toContain("mailto:");
        expect(html).not.toContain("tel:");
        expect(html).not.toContain('href="https://example.qa"');
      });

      it(`${render.name}: default and contactLinks: true are 3.8.0's markup (${lang})`, () => {
        const doc = parseIntentText(src);
        const old = render === renderHTML ? legacy.renderHTML : legacy.renderPrint;
        const oldHtml = old(legacy.parseIntentText(src));
        const norm = (h: string) => h.replace("padding:0 1px;}", "padding:0;}");
        expect(norm(render(doc))).toBe(oldHtml);
        expect(norm(render(doc, { contactLinks: true }))).toBe(oldHtml);
        expect(render(doc)).toContain('<a href="mailto:info@example.qa">');
      });
    }
  }
});
