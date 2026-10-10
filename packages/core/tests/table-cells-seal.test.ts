// Empty cells and `|` / `\` in table cells (3.9.0, item 8). An ERP merges a template,
// serializes it, seals that source, and later re-parses the sealed source to print. A row
// with an empty value or a value containing a pipe used to shift its columns there. The
// fix is opt-in on parse (`keepEmptyCells`) and changes the serializer only for cells that
// carry `|`/`\` or rows that end empty; legacy-output.test.ts proves nothing else moves.
import { describe, it, expect } from "vitest";
import {
  parseIntentText,
  parseAndMerge,
  documentToSource,
  sealDocument,
  verifyDocument,
  computeDocumentHash,
  renderPrint,
} from "../src/index";
import * as legacy from "dotit-core-legacy";

const KEEP = { keepEmptyCells: true };

function tableOf(src: string, opts?: { keepEmptyCells?: boolean }) {
  const doc = parseIntentText(src, opts);
  const walk = (bs: any[]): any => {
    for (const b of bs) {
      if (b.table) return b.table;
      if (b.children) {
        const t = walk(b.children);
        if (t) return t;
      }
    }
    return null;
  };
  return walk(doc.blocks) as { headers?: string[]; rows: string[][] };
}

/** The cells of every <tr> in the rendered HTML, in order, as plain text. */
function renderedRows(html: string): string[][] {
  const rows: string[][] = [];
  for (const tr of html.match(/<tr[\s>][\s\S]*?<\/tr>/g) ?? []) {
    const cells = [...tr.matchAll(/<t[dh](?:\s[^>]*)?>([\s\S]*?)<\/t[dh]>/g)].map((m) =>
      m[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim(),
    );
    rows.push(cells);
  }
  return rows;
}

describe("parse: keepEmptyCells", () => {
  it("default (false) is the 3.8 behaviour: every empty cell is dropped", () => {
    expect(tableOf("headers: A | B | C\nrow: 1 | | 3").rows[0]).toEqual(["1", "3"]);
    expect(tableOf("headers: A | B | C\nrow: 1 | 2 | | |").rows[0]).toEqual(["1", "2"]);
  });

  it("keeps inner empty cells, in English and Arabic", () => {
    expect(tableOf("headers: A | B | C\nrow: 1 | | 3", KEEP).rows[0]).toEqual(["1", "", "3"]);
    expect(tableOf("headers: الصنف | الملاحظة | المبلغ\nrow: حبر | | 40", KEEP).rows[0]).toEqual([
      "حبر",
      "",
      "40",
    ]);
    expect(tableOf("headers: A | B | C\nrow: | 2 | 3", KEEP).rows[0]).toEqual(["", "2", "3"]);
  });

  it("a single trailing delimiter on headers:/row: produces no cell", () => {
    const t = tableOf("headers: # | Item | each: items |\nrow: 1 | x |", KEEP);
    expect(t.headers).toEqual(["#", "Item", "each: items"]);
    expect(t.rows[0]).toEqual(["1", "x"]);
  });

  it("the outer delimiters of a | … | row produce no cell, inner empties are kept", () => {
    const t = tableOf("| A | B | C |\n| --- | --- | --- |\n| 1 | | 3 |\n| | 5 | |", KEEP);
    expect(t.headers).toEqual(["A", "B", "C"]);
    expect(t.rows).toEqual([
      ["1", "", "3"],
      ["", "5", ""],
    ]);
  });

  it("an explicitly empty last cell is written as a doubled trailing delimiter", () => {
    expect(tableOf("headers: A | B\nrow: 1 | |", KEEP).rows[0]).toEqual(["1", ""]);
    expect(tableOf("headers: A | B\nrow: |", KEEP).rows[0]).toEqual([""]);
    expect(tableOf("headers: A | B\nrow: ", KEEP).rows[0]).toEqual([]);
  });

  it("`\\|` stays one cell and `\\\\` is a backslash, with or without the option", () => {
    for (const o of [undefined, KEEP]) {
      expect(tableOf("headers: A | B\nrow: a\\|b | c\\\\d", o).rows[0]).toEqual(["a|b", "c\\d"]);
    }
  });
});

describe("serialize: escaping and empty last cells", () => {
  const roundTrip = (rows: string[][], headers = ["A", "B", "C"]) => {
    const doc = parseIntentText("headers: A | B | C\nrow: 1 | 2 | 3");
    doc.blocks[0].table = { headers, rows };
    const src = documentToSource(doc);
    return { src, rows: tableOf(src, KEEP).rows, headers: tableOf(src, KEEP).headers };
  };

  it("escapes | and \\ in cells (English and Arabic) so they re-parse unchanged", () => {
    const rows = [
      ["debit|credit", "C:\\temp", "x"],
      ["شركة|الأفق", "مسار\\ملف", "y"],
    ];
    const r = roundTrip(rows);
    expect(r.src).toContain("debit\\|credit");
    expect(r.src).toContain("C:\\\\temp");
    expect(r.rows).toEqual(rows);
    // and under the DEFAULT parse too (these have no empties)
    expect(tableOf(r.src).rows).toEqual(rows);
  });

  it("headers are escaped too", () => {
    const r = roundTrip([["1", "2", "3"]], ["a|b", "الاسم\\", "c"]);
    expect(r.headers).toEqual(["a|b", "الاسم\\", "c"]);
  });

  it("writes rows whose last cell is empty so they re-parse to the same cells", () => {
    const rows = [
      ["1", "2", ""],
      ["1", "", ""],
      ["", "", ""],
      ["", "2", "3"],
      ["", "", "3"],
    ];
    const r = roundTrip(rows);
    expect(r.rows).toEqual(rows);
  });

  it("rows with neither a pipe/backslash nor an empty last cell are byte-identical to 3.8.0", () => {
    const src = "headers: A | B\nrow: 1 | 2\nrow: شركة الأفق | example.qa";
    const a = documentToSource(parseIntentText(src));
    const b = legacy.documentToSource(legacy.parseIntentText(src));
    expect(a).toBe(b);
    expect(a).toBe(src);
  });
});

// ---- the ERP flow: merge → serialize → seal → parse → print ----------------------------

const TPL_EN = [
  "title: Statement {{client}}",
  "",
  "section: Account",
  "headers: Date | Document | Note | Amount | each: lines |",
  "row: {{line.date}} | {{line.doc}} | {{line.note}} | {{line.amount}} |",
].join("\n");

const DATA_EN = {
  client: "Horizon Co.",
  lines: [
    { date: "2026-07-01", doc: "INV-1001", note: "debit|credit", amount: "100" },
    { date: "2026-07-02", doc: "", note: "opening balance", amount: "50" },
    { date: "2026-07-03", doc: "INV-1003", note: "", amount: "75" },
    { date: "2026-07-04", doc: "", note: "path C:\\data", amount: "" },
  ],
};

const TPL_AR = [
  "title: كشف حساب {{client}}",
  "",
  "section: الحساب",
  "headers: التاريخ | المستند | الملاحظة | المبلغ | each: lines |",
  "row: {{line.date}} | {{line.doc}} | {{line.note}} | {{line.amount}} |",
].join("\n");

const DATA_AR = {
  client: "شركة الأفق",
  lines: [
    { date: "2026-07-01", doc: "ف-1001", note: "مدين|دائن", amount: "١٠٠" },
    { date: "2026-07-02", doc: "", note: "رصيد افتتاحي", amount: "٥٠" },
    { date: "2026-07-03", doc: "ف-1003", note: "", amount: "٧٥" },
    { date: "2026-07-04", doc: "", note: "مسار C:\\بيانات", amount: "" },
  ],
};

const CASES = [
  { name: "English", tpl: TPL_EN, data: DATA_EN, dir: "ltr" },
  { name: "Arabic", tpl: TPL_AR, data: DATA_AR, dir: "rtl" },
];

function expectedRows(data: typeof DATA_EN): string[][] {
  return data.lines.map((l) => [l.date, l.doc, l.note, l.amount]);
}

describe("the ERP round trip puts every value in its column", () => {
  for (const c of CASES) {
    it(`${c.name}: merge → serialize → seal → parse(keepEmptyCells) → renderPrint`, () => {
      const merged = parseAndMerge(c.tpl, c.data, KEEP);
      // the merged model is already right
      const mergedTable = merged.blocks.flatMap((b: any) => [b, ...(b.children ?? [])]).find((b: any) => b.table)!
        .table!;
      expect(mergedTable.rows).toEqual(expectedRows(c.data));

      const source = documentToSource(merged);
      const sealed = sealDocument(source, { signer: c.name === "Arabic" ? "شركة الأفق" : "Horizon Co." }).source;
      expect(verifyDocument(sealed).intact).toBe(true);

      const reparsed = tableOf(sealed, KEEP);
      expect(reparsed.rows).toEqual(expectedRows(c.data));
      expect(reparsed.headers!.length).toBe(4);

      const html = renderPrint(parseIntentText(sealed, KEEP));
      const rows = renderedRows(html).filter((r) => r.length === 4);
      expect(rows.slice(1)).toEqual(expectedRows(c.data));
      for (const r of rows) expect(r.length).toBe(4);
    });

    it(`${c.name}: without the option the same sealed source shifts columns (the 3.8 defect)`, () => {
      const source = documentToSource(parseAndMerge(c.tpl, c.data, KEEP));
      const shifted = tableOf(source).rows;
      expect(shifted).not.toEqual(expectedRows(c.data));
    });
  }

  it("merged cells (< and ^) keep working next to kept empty cells", () => {
    const t = tableOf("headers: A | B | C\nrow: x | | z\nrow: ^ | < | w", KEEP);
    expect(t.rows[0]).toEqual(["x", "", "z"]);
    expect(t.rows[1]).toEqual(["^", "<", "w"]);
    const html = renderPrint(parseIntentText("headers: A | B | C\nrow: x | | z\nrow: ^ | < | w", KEEP));
    expect(html).toContain("rowspan");
  });
});

// ---- cross-version seal safety (dotit-core-legacy = @dotit/core 3.8.0) ------------------

/** Sources: hand-written rows, rows the NEW serializer writes, rows the 3.8.0 one wrote. */
function sourcesFor(c: (typeof CASES)[number]): { label: string; src: string }[] {
  const out: { label: string; src: string }[] = [];
  const newSrc = documentToSource(parseAndMerge(c.tpl, c.data, KEEP));
  out.push({ label: "new serializer", src: newSrc });
  const oldSrc = legacy.documentToSource(legacy.parseAndMerge(c.tpl, c.data));
  out.push({ label: "3.8.0 serializer", src: oldSrc });
  out.push({
    label: "hand-written empties and escapes",
    src: [
      `title: ${c.data.client}`,
      "headers: A | B | C",
      "row: 1 | | 3",
      "row: 1 | 2 | |",
      "row: a\\|b | c\\\\d | e",
      "| x | | y |",
      "| --- | --- | --- |",
    ].join("\n"),
  });
  out.push({
    label: "plain",
    src: `title: ${c.data.client}\n\nheaders: A | B\nrow: ${c.data.client} | example.qa\n`,
  });
  return out;
}

describe("cross-version seals: 3.8.0 ⇄ new", () => {
  let checked = 0;
  for (const c of CASES) {
    for (const { label, src } of sourcesFor(c)) {
      it(`${c.name} / ${label}: same hash; sealed by either verifies under both`, () => {
        // the hash is a function of the source text alone
        expect(computeDocumentHash(src)).toBe(legacy.computeDocumentHash(src));

        const signer = c.data.client;
        const byLegacy = legacy.sealDocument(src, { signer }).source;
        const byNew = sealDocument(src, { signer }).source;

        expect(verifyDocument(byLegacy).intact).toBe(true);
        expect(legacy.verifyDocument(byLegacy).intact).toBe(true);
        expect(verifyDocument(byNew).intact).toBe(true);
        expect(legacy.verifyDocument(byNew).intact).toBe(true);

        checked++;
      });
    }
  }

  it("covers every source of both languages", () => {
    expect(checked).toBe(CASES.length * 4);
  });
});
