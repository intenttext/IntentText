import { describe, it, expect, beforeEach } from "vitest";
import {
  parseIntentText,
  _resetIdCounter,
  renderHTML,
  renderPrint,
  collectPrintLayout,
  validateDocumentSemantic,
  documentToSource,
} from "../src/index";

beforeEach(() => _resetIdCounter());

// ─── Parser Tests ─────────────────────────────────────────────────────────────

describe("v2.9 parser — header, footer, watermark", () => {
  it("header: keyword parsed with left, center, right properties", () => {
    const doc = parseIntentText(
      "page: | size: A4\nheader: | left: Acme Corp | center: CONFIDENTIAL | right: 2026-03-06",
    );
    const header = doc.blocks.find((b) => b.type === "header");
    expect(header).toBeDefined();
    expect(header!.properties?.left).toBe("Acme Corp");
    expect(header!.properties?.center).toBe("CONFIDENTIAL");
    expect(header!.properties?.right).toBe("2026-03-06");
  });

  it("footer: keyword parsed with left, center, right properties", () => {
    const doc = parseIntentText(
      "page: | size: A4\nfooter: | left: Ref-001 | center: Page 1 of 5 | right: Acme",
    );
    const footer = doc.blocks.find((b) => b.type === "footer");
    expect(footer).toBeDefined();
    expect(footer!.properties?.left).toBe("Ref-001");
    expect(footer!.properties?.center).toBe("Page 1 of 5");
    expect(footer!.properties?.right).toBe("Acme");
  });

  it("watermark: keyword parsed with content, color, angle, size", () => {
    const doc = parseIntentText(
      "page: | size: A4\nwatermark: CONFIDENTIAL | color: #ff000020 | angle: -45 | size: 80pt",
    );
    const wm = doc.blocks.find((b) => b.type === "watermark");
    expect(wm).toBeDefined();
    expect(wm!.content).toBe("CONFIDENTIAL");
    expect(wm!.properties?.color).toBe("#ff000020");
    expect(wm!.properties?.angle).toBe("-45");
    expect(wm!.properties?.size).toBe("80pt");
  });

  it("header: with skip-first: true stores property correctly", () => {
    const doc = parseIntentText(
      "page: | size: A4\nheader: | left: Acme | skip-first: true",
    );
    const header = doc.blocks.find((b) => b.type === "header");
    expect(header!.properties?.["skip-first"]).toBe("true");
  });

  it("footer: with skip-first: true stores property correctly", () => {
    const doc = parseIntentText(
      "page: | size: A4\nfooter: | center: Page 1 | skip-first: true",
    );
    const footer = doc.blocks.find((b) => b.type === "footer");
    expect(footer!.properties?.["skip-first"]).toBe("true");
  });

  it("watermark: with no content parsed as clear watermark", () => {
    const doc = parseIntentText("page: | size: A4\nwatermark:");
    const wm = doc.blocks.find((b) => b.type === "watermark");
    expect(wm).toBeDefined();
    expect(wm!.content).toBe("");
  });

  it("break: | before: section parsed correctly", () => {
    const doc = parseIntentText("page: | size: A4\nbreak: | before: section");
    const br = doc.blocks.find((b) => b.type === "break");
    expect(br).toBeDefined();
    expect(br!.properties?.before).toBe("section");
  });

  it("break: | keep: sign parsed correctly", () => {
    const doc = parseIntentText("page: | size: A4\nbreak: | keep: sign");
    const br = doc.blocks.find((b) => b.type === "break");
    expect(br).toBeDefined();
    expect(br!.properties?.keep).toBe("sign");
  });
});

// ─── Renderer Tests ───────────────────────────────────────────────────────────

describe("v2.9 renderer — print layout", () => {
  it("header: produces no HTML in web output", () => {
    const doc = parseIntentText(
      "title: Test\nheader: | left: Acme | right: Date",
    );
    const html = renderHTML(doc);
    expect(html).not.toContain("Acme");
    expect(html).not.toContain("header");
  });

  it("footer: produces no HTML in web output", () => {
    const doc = parseIntentText("title: Test\nfooter: | center: Page 1 of 5");
    const html = renderHTML(doc);
    expect(html).not.toContain("Page 1 of 5");
  });

  it("watermark: produces no HTML in web output", () => {
    const doc = parseIntentText(
      "title: Test\nwatermark: DRAFT | color: #00000015",
    );
    const html = renderHTML(doc);
    expect(html).not.toContain("DRAFT");
    expect(html).not.toContain("it-watermark");
  });

  it("header: produces CSS zones in print output", () => {
    const doc = parseIntentText(
      "page: | size: A4\nheader: | left: Acme Corp | center: CONFIDENTIAL | right: 2026",
    );
    const html = renderPrint(doc);
    expect(html).toContain("@top-left");
    expect(html).toContain("@top-center");
    expect(html).toContain("@top-right");
    expect(html).toContain("Acme Corp");
    expect(html).toContain("CONFIDENTIAL");
    expect(html).toContain("2026");
  });

  it("footer: produces CSS zones in print output", () => {
    const doc = parseIntentText(
      "page: | size: A4\nfooter: | left: Ref-001 | center: Page 1 | right: Acme",
    );
    const html = renderPrint(doc);
    expect(html).toContain("@bottom-left");
    expect(html).toContain("@bottom-center");
    expect(html).toContain("@bottom-right");
    expect(html).toContain("Ref-001");
  });

  it("header: skip-first: true produces @page:first CSS suppression", () => {
    const doc = parseIntentText(
      "page: | size: A4\nheader: | left: Acme | skip-first: true",
    );
    const html = renderPrint(doc);
    expect(html).toContain("@page:first");
    // First page should have empty content
    expect(html).toMatch(/@page:first\{@top-left\{content:""\;?\}/);
  });

  it("watermark: produces fixed-position element in print output", () => {
    const doc = parseIntentText(
      "page: | size: A4\nwatermark: CONFIDENTIAL | color: #0000ff10 | angle: -45 | size: 72pt",
    );
    const html = renderPrint(doc);
    expect(html).toContain("it-watermark");
    expect(html).toContain("CONFIDENTIAL");
    expect(html).toContain("rotate(-45deg)");
    expect(html).toContain("72pt");
    expect(html).toContain("#0000ff10");
  });

  it("break: | before: section adds page-break-before to section blocks", () => {
    const doc = parseIntentText(
      "page: | size: A4\nbreak: | before: section\nsection: Test",
    );
    const html = renderPrint(doc);
    expect(html).toContain(".it-section{page-break-before:always;}");
  });

  it("break: | keep: sign adds break-inside: avoid to sign blocks", () => {
    const doc = parseIntentText("page: | size: A4\nbreak: | keep: sign");
    const html = renderPrint(doc);
    expect(html).toContain(".it-sign{break-inside:avoid;}");
  });

  it("print-mode: minimal-ink adds it-print-minimal class to body", () => {
    const doc = parseIntentText(
      "page: | size: A4 | print-mode: minimal-ink\ntitle: Test",
    );
    const html = renderPrint(doc);
    expect(html).toContain('class="it-print it-print-minimal"');
    expect(html).toContain("background-color:transparent");
  });

  it("Legal paper size produces correct @page dimensions", () => {
    const doc = parseIntentText("page: | size: Legal\ntitle: Test");
    const html = renderPrint(doc);
    expect(html).toContain("8.5in 14in");
  });

  it("A3 paper size produces correct @page dimensions", () => {
    const doc = parseIntentText("page: | size: A3\ntitle: Test");
    const html = renderPrint(doc);
    expect(html).toContain("297mm 420mm");
  });

  it("custom paper size uses width and height values", () => {
    const doc = parseIntentText(
      "page: | size: custom | width: 210mm | height: 297mm\ntitle: Test",
    );
    const html = renderPrint(doc);
    expect(html).toContain("210mm 297mm");
  });

  it("multiple style zones from header: all appear in output", () => {
    const doc = parseIntentText(
      "page: | size: A4\nheader: | left: L | center: C | right: R",
    );
    const html = renderPrint(doc);
    // All three zones present
    expect(html).toContain('@top-left{content:"L";}');
    expect(html).toContain('@top-center{content:"C";}');
    expect(html).toContain('@top-right{content:"R";}');
  });
});

// ─── Validation Tests ─────────────────────────────────────────────────────────

describe("v2.9 validation — print layout warnings", () => {
  it("HEADER_WITHOUT_PAGE warning raised when header: present but no page:", () => {
    const doc = parseIntentText("title: Test\nheader: | left: Acme");
    const result = validateDocumentSemantic(doc);
    const warning = result.issues.find((i) => i.code === "HEADER_WITHOUT_PAGE");
    expect(warning).toBeDefined();
    expect(warning!.type).toBe("warning");
  });

  it("FOOTER_WITHOUT_PAGE warning raised when footer: present but no page:", () => {
    const doc = parseIntentText("title: Test\nfooter: | center: Page 1");
    const result = validateDocumentSemantic(doc);
    const warning = result.issues.find((i) => i.code === "FOOTER_WITHOUT_PAGE");
    expect(warning).toBeDefined();
    expect(warning!.type).toBe("warning");
  });

  it("WATERMARK_WITHOUT_PAGE warning raised when watermark: present but no page:", () => {
    const doc = parseIntentText("title: Test\nwatermark: DRAFT");
    const result = validateDocumentSemantic(doc);
    const warning = result.issues.find(
      (i) => i.code === "WATERMARK_WITHOUT_PAGE",
    );
    expect(warning).toBeDefined();
    expect(warning!.type).toBe("warning");
  });

  it("MULTIPLE_WATERMARKS warning raised for multiple watermark: blocks", () => {
    const doc = parseIntentText(
      "page: | size: A4\nwatermark: DRAFT\nwatermark: CONFIDENTIAL",
    );
    const result = validateDocumentSemantic(doc);
    const warnings = result.issues.filter(
      (i) => i.code === "MULTIPLE_WATERMARKS",
    );
    expect(warnings.length).toBe(1);
  });

  it("no warnings when header/footer/watermark have page: block", () => {
    const doc = parseIntentText(
      "page: | size: A4\nheader: | left: Acme\nfooter: | center: Page 1\nwatermark: DRAFT",
    );
    const result = validateDocumentSemantic(doc);
    expect(
      result.issues.filter(
        (i) =>
          i.code === "HEADER_WITHOUT_PAGE" ||
          i.code === "FOOTER_WITHOUT_PAGE" ||
          i.code === "WATERMARK_WITHOUT_PAGE",
      ),
    ).toHaveLength(0);
  });
});

// ─── Integration Tests ────────────────────────────────────────────────────────

describe("v2.9 integration — full documents", () => {
  it("full contract with header, footer, watermark, break renders correctly", () => {
    const doc = parseIntentText(`
title: Service Agreement
page: | size: A4 | margins: 25mm | print-mode: full
header: | left: Acme Corp | right: CONTRACT-2026-042 | skip-first: true
footer: | left: Confidential | center: Page 1 of 5 | right: 2026-03-06 | skip-first: true
watermark: CONFIDENTIAL | color: #0000ff10 | angle: -45 | size: 72pt
break: | before: section | keep: sign

section: Parties
note: Acme Corp · Doha, Qatar

section: Signatures
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-06T14:32:00Z | hash: sha256:a3f8c2d1
`);
    const html = renderPrint(doc);
    // Header CSS zones
    expect(html).toContain("@top-left");
    expect(html).toContain("Acme Corp");
    // Footer CSS zones
    expect(html).toContain("@bottom-left");
    expect(html).toContain("Confidential");
    // Watermark element
    expect(html).toContain("it-watermark");
    expect(html).toContain("CONFIDENTIAL");
    // Break declarations
    expect(html).toContain(".it-section{page-break-before:always;}");
    expect(html).toContain(".it-sign{break-inside:avoid;}");
    // Skip-first
    expect(html).toContain("@page:first");
    // Content still renders
    expect(html).toContain("Parties");
    expect(html).toContain("Acme Corp");
  });

  it("meta: PDF metadata fields extracted correctly via collectPrintLayout", () => {
    const doc = parseIntentText(`
title: Service Agreement
meta: | author: Ahmed | subject: Contract | keywords: legal,consulting | lang: en
page: | size: A4
`);
    expect(doc.metadata?.meta?.author).toBe("Ahmed");
    expect(doc.metadata?.meta?.subject).toBe("Contract");
    expect(doc.metadata?.meta?.keywords).toBe("legal,consulting");
    expect(doc.metadata?.meta?.lang).toBe("en");
    // collectPrintLayout works
    const layout = collectPrintLayout(doc);
    expect(layout.page).toBeDefined();
    expect(layout.header).toBeUndefined();
  });

  it("print-mode: minimal-ink + color properties interact correctly", () => {
    const doc = parseIntentText(`
page: | size: A4 | print-mode: minimal-ink
title: Test
note: Highlighted text | bg: yellow | color: red
`);
    const html = renderPrint(doc);
    // Body has minimal-ink class
    expect(html).toContain("it-print-minimal");
    // Minimal-ink CSS overrides colors
    expect(html).toContain("background-color:transparent !important");
    expect(html).toContain("color:black !important");
  });

  it("backward compat: page: | header: text treated as center zone", () => {
    const doc = parseIntentText(
      "page: | size: A4 | header: My Company | footer: Page {{page}}\ntitle: Test",
    );
    const html = renderPrint(doc);
    // Should use @top-center and @bottom-center for backward compat
    expect(html).toContain("@top-center");
    expect(html).toContain("My Company");
    expect(html).toContain("@bottom-center");
  });

  it("collectPrintLayout returns correct layout from document", () => {
    const doc = parseIntentText(`
page: | size: A4
header: | left: L | center: C
footer: | right: R
watermark: DRAFT | angle: -30
break: | before: section
break: | keep: table
`);
    const layout = collectPrintLayout(doc);
    expect(layout.page?.type).toBe("page");
    expect(layout.header?.properties?.left).toBe("L");
    expect(layout.footer?.properties?.right).toBe("R");
    expect(layout.watermark?.content).toBe("DRAFT");
    expect(layout.breaks).toHaveLength(2);
  });

  it("documentToSource round-trips header, footer, watermark", () => {
    const source = `title: Test
page: | size: A4
header: | left: Acme | center: CONFIDENTIAL | right: 2026 | skip-first: true
footer: | left: Ref | center: Page 1 | right: Date
watermark: DRAFT | color: #00000015 | angle: -45 | size: 80pt`;
    const doc = parseIntentText(source);
    const output = documentToSource(doc);
    expect(output).toContain("header:");
    expect(output).toContain("footer:");
    expect(output).toContain("watermark:");
    expect(output).toContain("DRAFT");
    // Round-trip: parse the output and verify blocks
    const doc2 = parseIntentText(output);
    expect(doc2.blocks.find((b) => b.type === "header")).toBeDefined();
    expect(doc2.blocks.find((b) => b.type === "footer")).toBeDefined();
    expect(doc2.blocks.find((b) => b.type === "watermark")).toBeDefined();
  });
});
