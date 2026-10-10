// Print fidelity for business papers (invoices, vouchers, statements): the frame,
// the money columns and the letterhead must print as authored, in Arabic (RTL) and
// English. Fixtures in tests/print-fixtures/ are fictional invoices shaped like the
// papers an ERP prints. These are the CI-safe proofs; print-chrome.test.ts proves
// the same documents through real Chrome when one is available.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseIntentText,
  parseAndMerge,
  documentToSource,
  renderHTML,
  renderPrint,
  convertIntentTextToMarkdown,
} from "../src/index";
import { getBuiltinTheme, generateThemeCSS } from "../src/theme";
import type { IntentTheme } from "../src/theme";
import type { IntentBlock } from "../src/types";
import * as legacy from "dotit-core-legacy";

const fixture = (name: string) =>
  readFileSync(join(__dirname, "print-fixtures", name), "utf8");

const PAPERS = [
  { lang: "ar", src: fixture("invoice-ar.it") },
  { lang: "en", src: fixture("invoice-en.it") },
];

function tables(src: string): IntentBlock[] {
  const out: IntentBlock[] = [];
  const walk = (bs: IntentBlock[]) => {
    for (const b of bs) {
      if (b.type === "table") out.push(b);
      if (b.children) walk(b.children);
    }
  };
  walk(parseIntentText(src).blocks);
  return out;
}

function inlineTypes(content: string): string[] {
  const b = parseIntentText(`text: ${content}`).blocks[0];
  return (b.inline ?? []).filter((n) => n.type !== "text").map((n) => `${n.type}:${n.value}`);
}

describe("print: a full-width frame stays inside the page area (#1)", () => {
  // Chrome snaps the printed page area to whole device pixels and can cut the last
  // pixel at its inline end, taking a 100%-wide table's right border with it — in
  // Arabic and English alike. The print container keeps a 1px inline gutter.
  for (const { lang, src } of PAPERS) {
    it(`keeps a 1px inline gutter around the printed document (${lang})`, () => {
      const html = renderPrint(parseIntentText(src));
      expect(html).toContain(".intent-document{max-width:none;margin:0;padding:0 1px;}");
    });
  }
});

describe("print: column alignment from the separator row (#2)", () => {
  for (const { lang, src } of PAPERS) {
    it(`reads |---:| into a per-column alignment (${lang})`, () => {
      const [, items, totals] = tables(src);
      expect(items.table?.align).toEqual([null, null, "right", "right", "right"]);
      expect(totals.table?.align).toEqual([null, "right"]);
    });

    it(`aligns the header and every cell of an aligned column (${lang})`, () => {
      const html = renderPrint(parseIntentText(src));
      expect(html).toMatch(/<th class="intent-table-th it-col-right" scope="col" dir="auto">/);
      expect(html).toContain('<td class="intent-table-td it-col-right" dir="auto">11,245.00</td>');
      expect(html).toContain('<td class="intent-table-td it-col-right" dir="auto">3,211.50</td>');
      // An unaligned column keeps the exact markup it always had.
      expect(html).toContain('<td class="intent-table-td" dir="auto">INV-0042</td>');
    });

    it(`keeps the separator through serialize and re-parse (${lang})`, () => {
      const out = documentToSource(parseIntentText(src));
      expect(out).toContain("|---|---|---:|---:|---:|");
      expect(out).toContain("|---|---:|");
      expect(tables(out).map((t) => t.table?.align)).toEqual(
        tables(src).map((t) => t.table?.align),
      );
    });
  }

  it("a plain separator carries no alignment and serializes as before", () => {
    const src = "headers: a | b\n|---|---|\n| 1 | 2 |\n";
    const [t] = tables(src);
    expect(t.table?.align).toBeUndefined();
    expect(documentToSource(parseIntentText(src))).toBe("headers: a | b\nrow: 1 | 2\n");
  });

  it("left and center map like GFM", () => {
    const [t] = tables("| a | b | c | d |\n| :--- | :---: | ---: | --- |\n| 1 | 2 | 3 | 4 |\n");
    expect(t.table?.align).toEqual(["left", "center", "right", null]);
  });

  it("survives an each: template merge — one separator, not one per item", () => {
    const template = [
      "headers: # | Item | Total | each: items |",
      "|---|---|---:|",
      "| {{item.n}} | {{item.name}} | {{item.total}} |",
    ].join("\n");
    const merged = parseAndMerge(template, {
      items: [
        { n: 1, name: "Chair", total: "325.50" },
        { n: 2, name: "Desk", total: "11,245.00" },
      ],
    });
    const out = documentToSource(merged);
    expect(out.match(/\|---\|---\|---:\|/g)).toHaveLength(1);
    expect(tables(out)[0].table?.align).toEqual([null, null, "right"]);
    expect(renderHTML(merged)).toContain('<td class="intent-table-td it-col-right" dir="auto">11,245.00</td>');
  });

  it("exports the alignment to Markdown", () => {
    const md = convertIntentTextToMarkdown(PAPERS[1].src);
    expect(md).toContain("| --- | --- | ---: | ---: | ---: |");
  });
});

describe("print: the table-header rule is a theme key (#7)", () => {
  // `body.it-print th{border-bottom:2px solid #000}` outranks `style: table-header`
  // and `style: table`, so a coloured frame printed a black header rule. The theme's
  // print block can now set the rule; absent, the CSS is untouched.
  const themed = (print: Record<string, string>): IntentTheme => {
    const base = getBuiltinTheme("corporate")!;
    return { ...base, print: { ...base.print, ...print } };
  };

  for (const { lang, src } of PAPERS) {
    it(`prints the given width and colour under the header (${lang})`, () => {
      const html = renderPrint(parseIntentText(src), {
        theme: themed({ "table-header-rule-width": "1px", "table-header-rule-color": "#b8c2c7" }),
      });
      expect(html).toContain("body.it-print .intent-table th{border-bottom:1px solid #b8c2c7;}");
    });

    it(`the web stylesheet gets the same rule (${lang})`, () => {
      const html = renderHTML(parseIntentText(src), {
        theme: themed({ "table-header-rule-width": "1px", "table-header-rule-color": "#b8c2c7" }),
      });
      expect(html).toContain(".intent-document .intent-table th{border-bottom:1px solid #b8c2c7;}");
    });

    it(`without the keys the CSS has no such rule (${lang})`, () => {
      for (const html of [renderPrint(parseIntentText(src)), renderHTML(parseIntentText(src))]) {
        expect(html).not.toContain(".intent-table th{border-bottom");
      }
    });
  }

  it("either key alone turns it on; the other defaults (1px, the theme's border colour)", () => {
    const theme = getBuiltinTheme("corporate")!;
    expect(generateThemeCSS(themed({ "table-header-rule-width": "0.5pt" }), "print")).toContain(
      `body.it-print .intent-table th{border-bottom:0.5pt solid ${theme.colors.border};}`,
    );
    expect(generateThemeCSS(themed({ "table-header-rule-color": "#0f4c5c" }), "web")).toContain(
      ".intent-document .intent-table th{border-bottom:1px solid #0f4c5c;}",
    );
  });

  it("the colour may name a theme colour", () => {
    const theme = getBuiltinTheme("corporate")!;
    expect(generateThemeCSS(themed({ "table-header-rule-color": "heading" }), "print")).toContain(
      `border-bottom:1px solid ${theme.colors.heading};}`,
    );
  });

  it("a value cannot end its declaration", () => {
    const css = generateThemeCSS(themed({ "table-header-rule-width": "1px;}body{background:red" }), "print");
    expect(css).not.toContain("}body{background");
  });

  it("a column the separator aligned still beats a document-wide style: rule", () => {
    const html = renderPrint(parseIntentText(PAPERS[1].src));
    expect(html).toContain(
      ".intent-table th.it-col-right,.intent-table td.it-col-right{text-align:right;font-variant-numeric:tabular-nums;}",
    );
  });
});

describe("print: the running header/footer font is a theme key (#4)", () => {
  // Margin boxes inherit from the page context, not from body.it-print or
  // .intent-document, so they print in the browser's default serif unless the theme
  // names a font: `print["header-family"]` / `["footer-family"]` (a stack, or "body").
  const themed = (print: Record<string, string>): IntentTheme => {
    const base = getBuiltinTheme("corporate")!;
    return { ...base, print: { ...base.print, ...print } };
  };

  for (const { lang, src } of PAPERS) {
    it(`"body" gives the margin boxes the theme's body font (${lang})`, () => {
      const html = renderPrint(parseIntentText(src), {
        theme: themed({ "header-family": "body", "footer-family": "body" }),
      });
      expect(html).toMatch(/@page\{@top-left\{[^}]*font-family:var\(--it-font-body\);\}@top-center/);
      expect(html).toMatch(/@page\{@bottom-left\{[^}]*font-family:var\(--it-font-body\);\}@bottom-center/);
      expect(html).not.toContain("@page{font-family:");
    });

    it(`a CSS stack is used as written, header and footer apart (${lang})`, () => {
      const html = renderPrint(parseIntentText(src), {
        theme: themed({ "footer-family": "'Noto Naskh Arabic', serif" }),
      });
      expect(html).toMatch(/@page\{@bottom-left\{[^}]*font-family:'Noto Naskh Arabic', serif;\}/);
      expect(html).not.toMatch(/@top-left\{[^}]*font-family/);
    });
  }

  for (const [lang, src] of [
    ["ar", "page: | size: A4 | margin: 12mm\nfooter: | right: شركة الأفق · INV-0042 | left: صفحة {{page}}\nheader: | center: فاتورة\ntext: مرحبا"],
    ["en", "page: | size: A4 | margin: 12mm\nfooter: | left: Horizon Trading Co. | right: Page {{page}}\nheader: | center: Invoice\ntext: Hello"],
  ] as const) {
    it(`no family key: the CSS is exactly 3.8.0's (${lang})`, () => {
      const now = renderPrint(parseIntentText(src));
      expect(now).not.toMatch(/@(top|bottom)-[a-z]+\{[^}]*font-family/);
      expect(now).not.toContain("@page{font-family:");
      expect(now.replace("padding:0 1px;}", "padding:0;}")).toBe(
        legacy.renderPrint(legacy.parseIntentText(src)),
      );
    });
  }

  it("a family alone (no size or colour) still emits the margin-box rule", () => {
    const theme: IntentTheme = { ...getBuiltinTheme("minimal")!, print: { "footer-family": "body" } };
    expect(generateThemeCSS(theme, "print")).toContain(
      "@page{@bottom-left{font-family:var(--it-font-body);}@bottom-center{font-family:var(--it-font-body);}@bottom-right{font-family:var(--it-font-body);}}",
    );
    expect(generateThemeCSS(theme, "web")).not.toContain("font-family:var(--it-font-body);}@bottom");
  });

  it("a family cannot end its declaration", () => {
    const css = generateThemeCSS(themed({ "footer-family": "x;}body{background:red" }), "print");
    expect(css).toContain("font-family:xbodybackground:red;");
    expect(css).not.toContain("}body{background");
  });
});

describe("print: contact data prints as written when the author asks (#3)", () => {
  // Nothing changes by default (an email is still read for a mention, as in 3.8.0);
  // the author escapes the marks, or the ERP merges with `literal`, and the paper
  // prints as written. contactLinks: false prints `contact:` values as text.
  const escaped = (src: string) =>
    src
      .replace("info@example.qa", "info\\@example.qa")
      .replace("#12", "\\#12")
      .replace("ref_no_2026", "ref\\_no\\_2026");

  it("by default an email is a mention and #12 a tag, as in 3.8.0", () => {
    expect(inlineTypes("Email info@example.qa now")).toEqual(["mention:example"]);
    expect(inlineTypes("Building #12")).toEqual(["tag:12"]);
    expect(inlineTypes("ask @ali please")).toEqual(["mention:ali"]);
  });

  it("escapes print an email, a number and an underscore name as written", () => {
    expect(inlineTypes("Email info\\@example.qa now")).toEqual([]);
    expect(inlineTypes("البريد info\\@example.qa · هاتف")).toEqual([]);
    expect(inlineTypes("Building \\#12, Corniche Street")).toEqual([]);
    expect(inlineTypes("ref\\_no\\_2026")).toEqual([]);
    expect(inlineTypes("filed under #doha-branch")).toEqual(["tag:doha-branch"]);
  });

  it("a run of escaped underscores is a fill-in blank, printed as written", () => {
    const html = renderHTML(parseIntentText("text: Signature: \\_\\_\\_\\_\\_\\_ | align: right"));
    expect(html).toContain("Signature: ______</p>");
  });

  for (const { lang, src } of PAPERS) {
    it(`the escaped letterhead prints with no inline marks (${lang})`, () => {
      const html = renderPrint(parseIntentText(escaped(src)));
      expect(html).not.toContain('<span class="intent-inline-mention">');
      expect(html).not.toContain('<span class="intent-inline-tag">');
      expect(html).not.toMatch(/<em[ >]/);
      expect(html).toContain("info@example.qa");
    });

    it(`the unescaped letterhead renders as it did in 3.8.0 (${lang})`, () => {
      const html = renderPrint(parseIntentText(src));
      expect(html).toContain("intent-inline-mention");
    });

    it(`contactLinks: false prints contact: values as text in the document's direction (${lang})`, () => {
      const html = renderPrint(parseIntentText(src), { contactLinks: false });
      expect(html).toContain('<div class="it-contact-email"><span dir="auto">info@example.qa</span></div>');
      expect(html).toContain('<div class="it-contact-phone"><span dir="auto">+974 4400 0001</span></div>');
      expect(html).not.toContain("mailto:");
    });
  }
});

describe("print: the column-alignment CSS only ships with an aligned table (#2)", () => {
  const RULE = ".intent-table th.it-col-right,.intent-table td.it-col-right{text-align:right;font-variant-numeric:tabular-nums;}";
  const plain = "headers: a | b\nrow: 1 | 2\n";
  const nested = "section: S\nheaders: a | b\n| :--- | ---: |\nrow: 1 | 2\n";

  for (const render of [renderHTML, renderPrint]) {
    for (const { lang, src } of PAPERS) {
      it(`${render.name} emits the it-col rules for an aligned table (${lang})`, () => {
        expect(render(parseIntentText(src))).toContain(RULE);
      });
    }

    it(`${render.name} emits no it-col rule for a document with no aligned table`, () => {
      expect(render(parseIntentText(plain))).not.toContain("it-col-");
      expect(render(parseIntentText("headers: a | b\n|---|---|\nrow: 1 | 2\n"))).not.toContain("it-col-");
    });

    it(`${render.name} finds an aligned table nested in a section`, () => {
      expect(render(parseIntentText(nested))).toContain(".intent-table th.it-col-left");
    });
  }
});
