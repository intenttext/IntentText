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
import type { IntentBlock } from "../src/types";

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

describe("print: style: rules win over the built-in table rules (#7)", () => {
  // `body.it-print th{border-bottom:2px solid #000}` outranked `style: table-header`
  // and `style: table`, so a coloured frame always printed a black header rule. Rules
  // are scoped under the document (as the editor scopes them), above the base CSS.
  for (const render of [renderHTML, renderPrint]) {
    it(`scopes style: rules under .intent-document (${render.name})`, () => {
      const html = render(parseIntentText(PAPERS[0].src));
      expect(html).toContain(
        ".intent-document .intent-table-th,.intent-document .intent-table-td{border: 1px solid #b8c2c7;}",
      );
      expect(html).toContain(
        ".intent-document .intent-table-th{color: #0f4c5c; background-color: #e6eef0;}",
      );
    });
  }

  it("a column the separator aligned still beats a document-wide style: rule", () => {
    const html = renderPrint(parseIntentText(PAPERS[1].src));
    expect(html).toContain(
      ".intent-table th.it-col-right,.intent-table td.it-col-right{text-align:right;font-variant-numeric:tabular-nums;}",
    );
  });
});

describe("print: the running header/footer print in the document's font (#4)", () => {
  // Margin boxes inherit from the page context, not from body.it-print or
  // .intent-document, so they printed in the browser's default serif.
  for (const { lang, src } of PAPERS) {
    it(`gives the page context the content's font (${lang})`, () => {
      expect(renderPrint(parseIntentText(src))).toContain("@page{font-family:var(--it-font-body);}");
    });
  }

  it("embedded PDF/A fonts still win over it", () => {
    const html = renderPrint(parseIntentText(PAPERS[0].src), { embedFonts: true });
    const theme = html.indexOf("@page{font-family:var(--it-font-body);}");
    const embedded = html.indexOf("@page{font-family:'IT Serif'");
    expect(theme).toBeGreaterThan(-1);
    expect(embedded).toBeGreaterThan(theme);
  });
});

describe("print: contact data prints as written (#3)", () => {
  it("an email is not a mention", () => {
    expect(inlineTypes("Email info@example.qa now")).toEqual([]);
    expect(inlineTypes("البريد info@example.qa · هاتف")).toEqual([]);
    expect(inlineTypes("first_last@example.qa")).toEqual([]);
    // A real mention still is one.
    expect(inlineTypes("ask @ali please")).toEqual(["mention:ali"]);
    expect(inlineTypes("@ali please")).toEqual(["mention:ali"]);
  });

  it("a number after # is not a tag, nor is a # inside a word", () => {
    expect(inlineTypes("Building #12, Corniche Street")).toEqual([]);
    expect(inlineTypes("Invoice #42")).toEqual([]);
    expect(inlineTypes("A#B")).toEqual([]);
    expect(inlineTypes("filed under #doha-branch")).toEqual(["tag:doha-branch"]);
  });

  it("an underscore inside a word is not italic", () => {
    expect(inlineTypes("ref_no_2026")).toEqual([]);
    expect(inlineTypes("https://example.qa/a_b_c")).toEqual([]);
    expect(inlineTypes("see _this_ now")).toEqual(["italic:this"]);
    expect(inlineTypes("_this_.")).toEqual(["italic:this"]);
  });

  it("a run of underscores is a fill-in blank, printed as written", () => {
    expect(inlineTypes("Authorised Signature: _________________________")).toEqual([]);
    const html = renderHTML(parseIntentText("text: Signature: __________ | align: right"));
    expect(html).toContain("Signature: __________</p>");
  });

  it("a date token inside an email is not a date", () => {
    expect(inlineTypes("info@today.example")).toEqual([]);
  });

  for (const { lang, src } of PAPERS) {
    it(`the letterhead prints with no inline marks (${lang})`, () => {
      const html = renderPrint(parseIntentText(src));
      expect(html).not.toContain('<span class="intent-inline-mention">');
      expect(html).not.toContain('<span class="intent-inline-tag">');
      expect(html).not.toMatch(/<em[ >]/);
    });

    it(`contact: values print as text in the document's direction (${lang})`, () => {
      const html = renderPrint(parseIntentText(src));
      expect(html).toContain("body.it-print .it-contact a{color:inherit;text-decoration:none;}");
      // The value is isolated, the line follows the document (RTL lines start right).
      expect(html).toContain(
        '<div class="it-contact-email"><a dir="auto" href="mailto:info@example.qa">info@example.qa</a></div>',
      );
      expect(html).toContain(
        '<div class="it-contact-phone"><a dir="auto" href="tel:+974 4400 0001">+974 4400 0001</a></div>',
      );
    });
  }
});
