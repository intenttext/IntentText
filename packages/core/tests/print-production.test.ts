// Production-printing guards: the behaviors an ERP relies on (invoices, receipts,
// statements). These lock parity with the editor and the security/robustness fixes
// so they can't silently regress.
import { describe, it, expect } from "vitest";
import {
  parseIntentText,
  parseAndMerge,
  renderHTML,
  renderPrint,
  cssContentValue,
  documentToSource,
} from "../src/index";

describe("print: metric totals (editor parity)", () => {
  // Assert on element markup (`…">`), not bare class names — DOCUMENT_CSS contains
  // every class as a selector, so `toContain("it-metric-row")` always matches.
  it("renders a plain metric as a label/value total row, not a KPI card", () => {
    const html = renderHTML(parseIntentText("metric: Subtotal | value: 16,500 QAR"));
    expect(html).toContain('<span class="it-metric-row__label">Subtotal</span>');
    expect(html).toContain('<span class="it-metric-row__value" dir="auto">16,500 QAR</span>');
    expect(html).not.toContain('<div class="it-metric '); // not the boxed KPI card element
  });

  it("emphasizes the grand total row", () => {
    const html = renderHTML(parseIntentText("metric: Total Due | value: 17,325 QAR"));
    expect(html).toContain('class="it-metric-row it-metric-row--total"');
  });

  it("still renders a KPI card when target/trend/period is present", () => {
    const html = renderHTML(
      parseIntentText("metric: Revenue | value: 90 | target: 100 | trend: up"),
    );
    expect(html).toContain('<div class="it-metric '); // boxed KPI card element
    expect(html).not.toContain('<span class="it-metric-row__label">');
  });
});

describe("print: running header/footer", () => {
  it("maps {{page}} / {{pages}} to CSS counters (not literal text)", () => {
    const html = renderPrint(
      parseIntentText("page: | size: A4 | footer: INV-1 · Page {{page}} of {{pages}}\ntitle: T"),
    );
    expect(html).toContain("counter(page)");
    expect(html).toContain("counter(pages)");
    expect(html).not.toMatch(/content:[^;]*\{\{page\}\}/);
  });

  it("CSS-escapes hostile footer text (no attribute/HTML-entity leakage)", () => {
    const v = cssContentValue('Ref "A\\B"');
    expect(v).toBe('"Ref \\"A\\\\B\\""');
    expect(v).not.toContain("&quot;");
  });

  it("content-only header:/footer: blocks render in the center zone (llms.txt + editor parity)", () => {
    const html = renderPrint(
      parseIntentText("title: T\nheader: ACME Corp\nfooter: Page {{page}} of {{pages}}"),
    );
    expect(html).toMatch(/@top-center\{content:"ACME Corp"/);
    expect(html).toMatch(/@bottom-center\{content:"Page " counter\(page\)/);
  });

  it("zone properties take precedence over block content", () => {
    const html = renderPrint(
      parseIntentText("title: T\nheader: Ignored | center: Wins"),
    );
    expect(html).toMatch(/@top-center\{content:"Wins"/);
    expect(html).not.toContain('"Ignored"');
  });
});

describe("print: injection safety (merged data)", () => {
  it("escapes body content", () => {
    const html = renderHTML(parseAndMerge("text: {{v}}", { v: "<img src=x onerror=alert(1)>" }));
    expect(html).not.toContain("<img src=x onerror");
    expect(html).toContain("&lt;img");
  });

  it("does not let a style-prop value break out of the style attribute", () => {
    const html = renderHTML(
      parseAndMerge("text: hi | color: {{c}}", { c: 'red" onmouseover="alert(1)' }),
    );
    expect(html).not.toMatch(/style="[^"]*"\s+onmouseover=/);
    expect(html).toContain("&quot;");
  });

  it("preserves a valid quoted font-family", () => {
    const html = renderHTML(parseIntentText("text: hi | family: Times New Roman | color: #c00"));
    expect(html).toContain("font-family: Times New Roman");
    expect(html).toContain("color: #c00");
  });
});

describe("merge: missing field handling", () => {
  const t = "text: Phone {{customer.phone}} / {{customer.email}}";
  it('keeps the marker by default', () => {
    expect(parseAndMerge(t, { customer: { email: "a@b.c" } }).blocks[0].content).toBe(
      "Phone {{customer.phone}} / a@b.c",
    );
  });
  it('blanks the marker in "blank" mode', () => {
    expect(
      parseAndMerge(t, { customer: { email: "a@b.c" } }, { missing: "blank" }).blocks[0].content,
    ).toBe("Phone  / a@b.c");
  });
  it("never crashes on missing/odd data", () => {
    expect(() => parseAndMerge("text: {{a.b.c}} | each: items", {})).not.toThrow();
    expect(() => parseAndMerge("| {{x}} | each: items |", { items: "notarray" })).not.toThrow();
  });
});

describe("print: multi-page + RTL robustness", () => {
  it("repeats the table header across pages and avoids splitting rows", () => {
    let rows = "";
    for (let i = 0; i < 80; i++) rows += `| Item ${i} | ${i} |\n`;
    const html = renderPrint(parseIntentText(`| A | B |\n${rows}`));
    expect(html).toMatch(/table-header-group/);
    expect(html).toMatch(/break-inside:\s*avoid/);
  });

  it("propagates dir=rtl to the printed document", () => {
    const html = renderPrint(parseIntentText("meta: | dir: rtl\ntitle: فاتورة"));
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("فاتورة");
  });
});

describe("two-sided rows (end:) + Word-parity spacing", () => {
  it("end: renders a flex split row (content start, value end)", () => {
    const html = renderPrint(
      parseIntentText("text: Customer Name | end: 2026-06-12"),
    );
    expect(html).toContain('class="intent-text it-split"');
    expect(html).toMatch(
      /it-split-main">Customer Name<\/span><span class="it-split-end" dir="auto">2026-06-12</,
    );
  });

  it("end: works on title/section and HTML-escapes the value", () => {
    const html = renderPrint(
      parseIntentText('title: INVOICE | end: <b>#INV-1</b>\nsection: Items | end: QAR'),
    );
    expect(html).toMatch(/intent-title[^"]*it-split/);
    expect(html).toMatch(/intent-section[^"]*it-split/);
    expect(html).toContain("&lt;b&gt;#INV-1&lt;/b&gt;");
  });

  it("leading/space-before/space-after map to CSS per block and via style:", () => {
    const html = renderPrint(
      parseIntentText(
        "style: text | leading: 1.9\ntext: A | space-before: 6px | space-after: 24px",
      ),
    );
    expect(html).toContain("margin-top: 6px");
    expect(html).toContain("margin-bottom: 24px");
    expect(html).toMatch(/\.intent-text\{[^}]*line-height: 1\.9/);
  });

  it("document CSS uses logical properties (RTL-native)", () => {
    const html = renderPrint(parseIntentText("title: عقد\nquote: نص"));
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("border-inline-start");
    expect(html).not.toMatch(/[{;]text-align:left/);
    expect(html).not.toMatch(/[{;]border-left:/);
  });

  it("end: round-trips through the serializer", () => {
    const src = "text: Customer | end: 2026-06-12";
    expect(documentToSource(parseIntentText(src)).trim()).toBe(src);
  });
});

describe("bidi isolation (mixed Arabic/English/numbers)", () => {
  const quotation = [
    "عنوان: عرض سعر — تأثيث المكتب الرئيسي",
    "أعمدة: الوصف | الكمية | الإجمالي",
    "صف: كرسي مكتب تنفيذي | 12 | 10,200 QAR",
    "مؤشر: الإجمالي المستحق | value: 10,200 QAR",
    "مهمة: اعتماد العرض | owner: أحمد | due: 2026-06-20",
  ].join("\n");

  it("isolates every mixed-direction value (WhatsApp-style dir=auto)", () => {
    const html = renderHTML(parseIntentText(quotation));
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('<td class="intent-table-td" dir="auto">10,200 QAR');
    expect(html).toMatch(/intent-task-due" dir="auto">2026-06-20/);
    expect(html).toMatch(/intent-task-owner" dir="auto">أحمد/);
    expect(html).toMatch(/dir="auto">10,200 QAR/);
  });

  it("explicit dir: on meta/بيانات overrides auto-detection both ways", () => {
    expect(
      parseIntentText("بيانات: | dir: rtl\ntitle: English Doc").metadata.language,
    ).toBe("rtl");
    expect(
      parseIntentText("meta: | dir: ltr\nعنوان: عربي").metadata.language,
    ).toBe("ltr");
  });
});
