import { describe, it, expect, beforeEach } from "vitest";
import { parseIntentText as parseTs } from "../src/parser";
import { renderHTML as renderHTMLTs } from "../src/renderer";
import {
  getBuiltinTheme,
  generateThemeCSS,
  listBuiltinThemes,
} from "../src/theme";
import {
  renderHTML,
  getRustCoreFallbackTelemetry,
  resetRustCoreFallbackTelemetry,
} from "../src/rust-core";

const FIXTURES = [
  {
    id: "simple",
    source: "title: Test\nsection: Intro\ntext: Hello world",
  },
  {
    id: "callout-heavy",
    source:
      "title: Callouts\ninfo: Standard info\ninfo: Warning path | type: warning\ninfo: Danger path | type: danger\ninfo: Success path | type: success",
  },
  {
    id: "code-quote-link",
    source:
      "title: Mixed\nquote: Quoted line | by: Team\n```ts\nconst x = 1;\n```\nlink: Docs | to: https://example.com",
  },
  {
    id: "print-layout",
    source:
      "title: Print Layout\npage: A4 | margins: 25mm\nheader: Company Header\nfooter: Confidential\nwatermark: DRAFT\ntext: Body",
  },
];

describe("rust-core theme parity (step 3)", () => {
  beforeEach(() => {
    resetRustCoreFallbackTelemetry();
    if (typeof globalThis !== "undefined") {
      (globalThis as Record<string, unknown>).__INTENTTEXT_CORE_ENGINE = "rust";
    }
  });

  it("applies metadata theme in Rust path without TS theme fallback", () => {
    const doc = parseTs("meta: | theme: legal\ntitle: T\ntext: hello");
    const html = renderHTML(doc);
    const legalCss = generateThemeCSS(getBuiltinTheme("legal")!, "web");

    expect(html).toContain("<style>");
    expect(html).toContain(legalCss);

    const t = getRustCoreFallbackTelemetry();
    expect(t.renderer_theme_fallback_to_ts).toBe(0);
  });

  it("honors option theme over metadata theme", () => {
    const doc = parseTs("meta: | theme: legal\ntitle: T\ntext: hello");
    const html = renderHTML(doc, { theme: "corporate" });

    const corpCss = generateThemeCSS(getBuiltinTheme("corporate")!, "web");
    const legalCss = generateThemeCSS(getBuiltinTheme("legal")!, "web");

    expect(html).toContain(corpCss);
    expect(html).not.toContain(legalCss);

    const t = getRustCoreFallbackTelemetry();
    expect(t.renderer_option_fallback_to_ts).toBe(0);
  });

  it("falls back unknown theme name to default corporate theme", () => {
    const doc = parseTs("title: T\ntext: hello");
    const html = renderHTML(doc, { theme: "unknown-theme" as never });

    const corpCss = generateThemeCSS(getBuiltinTheme("corporate")!, "web");
    expect(html).toContain(corpCss);
  });

  it("keeps theme CSS token parity with TS renderer", () => {
    const doc = parseTs("meta: | theme: corporate\ntitle: T\ntext: hello");
    const rustHtml = renderHTML(doc);
    const tsHtml = renderHTMLTs(doc);

    const token = "--it-font-body:";
    expect(rustHtml).toContain(token);
    expect(tsHtml).toContain(token);
  });

  it("passes builtin theme matrix on representative fixtures", () => {
    const themes = listBuiltinThemes();

    for (const fixture of FIXTURES) {
      for (const themeName of themes) {
        const doc = parseTs(fixture.source);
        const rustHtml = renderHTML(doc, { theme: themeName });
        const tsHtml = renderHTMLTs(doc, { theme: themeName });
        const css = generateThemeCSS(getBuiltinTheme(themeName)!, "web");

        expect(rustHtml).toContain(css);
        expect(tsHtml).toContain(css);
        expect(rustHtml).toContain('class="intent-document"');
        expect(tsHtml).toContain('class="intent-document"');
      }
    }

    const t = getRustCoreFallbackTelemetry();
    expect(t.renderer_theme_fallback_to_ts).toBe(0);
    expect(t.renderer_option_fallback_to_ts).toBe(0);
  });
});
