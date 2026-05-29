import { describe, it, expect, beforeEach } from "vitest";
import { parseIntentText as parseTs } from "../src/parser";
import {
  parseIntentText,
  renderHTML,
  getRustCoreFallbackTelemetry,
  resetRustCoreFallbackTelemetry,
} from "../src/rust-core";

describe("rust-core fallback telemetry", () => {
  beforeEach(() => {
    resetRustCoreFallbackTelemetry();
    if (typeof globalThis !== "undefined") {
      delete (globalThis as Record<string, unknown>).__INTENTTEXT_CORE_ENGINE;
    }
  });

  it("handles parser options without TS fallback", () => {
    parseIntentText("title: A", { includeHistorySection: true });
    const t = getRustCoreFallbackTelemetry();
    expect(t.parser_option_fallback_to_ts).toBe(0);
  });

  it("does not fallback for renderer option theme path", () => {
    const doc = parseTs("title: A");
    renderHTML(doc, { theme: "corporate" });
    const t = getRustCoreFallbackTelemetry();
    expect(t.renderer_option_fallback_to_ts).toBe(0);
  });

  it("does not fallback for renderer metadata theme path", () => {
    const doc = parseTs("meta: | theme: corporate\ntitle: A");
    renderHTML(doc);
    const t = getRustCoreFallbackTelemetry();
    expect(t.renderer_theme_fallback_to_ts).toBe(0);
  });

  it("resets counters", () => {
    parseIntentText("title: A", { includeHistorySection: true });
    resetRustCoreFallbackTelemetry();
    const t = getRustCoreFallbackTelemetry();
    expect(t.parser_option_fallback_to_ts).toBe(0);
    expect(t.renderer_option_fallback_to_ts).toBe(0);
    expect(t.renderer_theme_fallback_to_ts).toBe(0);
    expect(t.wasm_load_failure_fallback_to_ts).toBe(0);
    expect(t.wasm_call_failure_fallback_to_ts).toBe(0);
  });

  it("renders first Step 4 writer batch without TS renderer fallback", () => {
    const doc = parseTs(`dedication: For my father
byline: Jane Smith | date: 2026 | publication: Tribune
epigraph: To be or not to be | by: Hamlet
caption: Photo by John
note: Some text[^1]
footnote: 1 | text: A footnote.`);

    const html = renderHTML(doc);
    expect(html).toContain('class="it-dedication"');
    expect(html).toContain('class="it-byline"');
    expect(html).toContain('class="it-epigraph"');
    expect(html).toContain('class="it-caption"');
    expect(html).toContain('class="it-footnotes"');

    const t = getRustCoreFallbackTelemetry();
    expect(t.wasm_call_failure_fallback_to_ts).toBe(0);
  });

  it("renders docgen integration patterns without TS renderer fallback", () => {
    const cases = [
      `font: | family: Courier New | size: 14pt
page: | size: A4
title: Test`,
      `dedication: For my father
break:
toc: | depth: 2 | title: Contents
break:
title: Chapter One
epigraph: A wise quote | by: Author
byline: Emad | date: 2026 | publication: Press
section: Introduction
note: Some text[^1]
sub: Details
note: More text
footnote: 1 | text: A footnote about the source.`,
      `title: Breaking News
byline: Sara | date: 2026-03-05 | publication: Tribune
note: First paragraph[^1]
image: Photo | at: img.jpg
caption: Photo credit
footnote: 1 | text: Source verified.`,
      `note: A[^1] and B[^2]
footnote: 1 | text: Note one
footnote: 2 | text: Note two`,
    ];

    for (const [idx, source] of cases.entries()) {
      resetRustCoreFallbackTelemetry();
      const doc = parseTs(source);
      renderHTML(doc);
      const t = getRustCoreFallbackTelemetry();
      expect(
        t.wasm_call_failure_fallback_to_ts,
        `case ${idx + 1} should not fallback`,
      ).toBe(0);
    }
  });

  it("renders remaining v2.11 blocker groups without TS renderer fallback", () => {
    const cases = [
      {
        source: "ref: Agreement | file: ./agreement.it | rel: governed-by",
        expect: ["Agreement", "governed-by", "ref"],
      },
      {
        source:
          "def: API | meaning: Application Programming Interface | abbr: API",
        expect: ["API", "Application Programming Interface", "def"],
      },
      {
        source: "figure: Test Fig | src: ./test.png | caption: A test figure",
        expect: ["<figure", "test.png", "A test figure"],
      },
      {
        source:
          "signline: Provider | name: Alice Smith | role: CEO | date-line: true",
        expect: ["it-signline", "Provider", "CEO", "Date"],
      },
      {
        source:
          "contact: Jane | email: jane@example.com | phone: +15550100 | role: PM",
        expect: ["mailto:jane@example.com", "tel:+15550100", "contact"],
      },
      {
        source:
          "deadline: Payment Due | date: 2027-03-01 | consequence: Late fee of 1.5%",
        expect: ["deadline", "Payment Due", "Late fee of 1.5%"],
      },
    ];

    for (const [idx, testCase] of cases.entries()) {
      resetRustCoreFallbackTelemetry();
      const doc = parseTs(testCase.source);
      const html = renderHTML(doc);

      for (const token of testCase.expect) {
        expect(html).toContain(token);
      }

      const t = getRustCoreFallbackTelemetry();
      expect(
        t.wasm_call_failure_fallback_to_ts,
        `remaining case ${idx + 1} should not fallback`,
      ).toBe(0);
    }
  });
});
