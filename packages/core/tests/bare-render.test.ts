// bare-render — renderHTML({ bare: true }) is the "document as signed" view.
//
// CONTRACT: the bare render keeps content and EMPHASIS (bold / italic / underline
// / strike) but drops every visual decoration — authored colour, size, font
// family, background, alignment, and `style:` rules. This is the visual twin of
// what the content signature covers; if it ever leaks decoration, the signed view
// could differ from what was hashed.

import { describe, it, expect } from "vitest";
import { parseIntentText, renderHTML } from "../src/index";

const render = (src: string, bare: boolean) =>
  renderHTML(parseIntentText(src), { theme: "corporate", bare });
// The <style> block holds the theme + DOCUMENT_CSS (which legitimately define
// colours and the .intent-align-* classes). Authored inline decoration lives in
// the BODY, so strip <style> when asserting on what the document itself emitted.
const bodyOf = (html: string) => html.replace(/<style[\s\S]*?<\/style>/gi, "");
const bareBody = (src: string) => bodyOf(render(src, true));
const styledBody = (src: string) => bodyOf(render(src, false));

describe("bare render — decoration stripped, content + emphasis kept", () => {
  it("drops an inline colour span but keeps its text", () => {
    const src = "text: A [red word]{color: #dc2626} here";
    expect(bareBody(src)).toContain("red word"); // text survives
    expect(bareBody(src)).not.toContain("#dc2626"); // colour gone
    expect(styledBody(src)).toContain("#dc2626"); // present without bare
  });

  it("drops inline font-size but keeps the text", () => {
    expect(bareBody("text: A [big]{size: 30px} word")).toContain("big");
    expect(bareBody("text: A [big]{size: 30px} word")).not.toContain("30px");
  });

  it("keeps emphasis: bold / italic / strike marks render as tags", () => {
    const out = bareBody("text: This is *bold* and _italic_ and ~gone~");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<em>italic</em>");
    expect(out).toContain("<del>gone</del>");
  });

  it("keeps underline (a style-prop, not a mark)", () => {
    const out = bareBody("text: A [signed]{underline: true} line");
    expect(out).toContain("signed");
    expect(out).toMatch(/text-decoration:\s*underline/);
  });

  it("drops block-level colour + alignment but not the heading text", () => {
    const src = "section: Terms | color: #0a7 | align: center";
    expect(bareBody(src)).toContain("Terms");
    expect(bareBody(src)).not.toContain("#0a7");
    expect(bareBody(src)).not.toContain("intent-align-center");
    // sanity: the styled body DOES carry both
    expect(styledBody(src)).toContain("#0a7");
    expect(styledBody(src)).toContain("intent-align-center");
  });

  it("drops `style:` rules entirely (they live in the <style> block)", () => {
    const src = "style: section | color: #0a7 | weight: 700\nsection: Heading";
    expect(render(src, true)).toContain("Heading");
    expect(render(src, true)).not.toContain("#0a7"); // rule gone from <style>
    expect(render(src, false)).toContain("#0a7"); // present without bare
  });

  it("marks the container so the viewer can style it", () => {
    expect(render("text: hi", true)).toContain("intent-bare");
    expect(render("text: hi", false)).not.toContain("intent-bare");
  });

  it("emits the box-reset (no boxes/borders) only in bare", () => {
    // Callouts, contact cards, coloured rules etc. are flattened in bare.
    expect(render("info: Late fees | type: warning", true)).toContain(
      ".intent-bare .intent-callout",
    );
    expect(render("info: Late fees | type: warning", false)).not.toContain(
      ".intent-bare .intent-callout",
    );
  });

  // Direction is CONTENT, not decoration — critical for gov/GCC (Arabic).
  describe("RTL / Arabic direction is preserved in the bare view", () => {
    const ARABIC = "section: الشروط والأحكام\ntext: هذا عقد ملزم بين الطرفين.";

    it("auto-detects Arabic → container renders dir=rtl (not forced ltr)", () => {
      const out = render(ARABIC, true);
      expect(out).toContain('dir="rtl"');
      expect(out).not.toContain('class="intent-document intent-bare" dir="ltr"');
      expect(out).toContain("هذا عقد ملزم"); // the Arabic text survives
    });

    it("each block gets dir=auto so direction follows its own characters", () => {
      // Mixed doc: an Arabic line and an English line. With no authored dir, bare
      // gives every block dir="auto" → each resolves from its own text.
      const out = render("text: مرحبا بالعالم\ntext: Hello world", true);
      expect(out).toContain('dir="auto"');
      expect(out).toContain("مرحبا بالعالم");
      expect(out).toContain("Hello world");
    });

    it("an explicit per-block dir is still honoured over auto", () => {
      const out = render("text: Forced RTL | dir: rtl", true);
      expect(out).toContain('dir="rtl"');
    });
  });
});
