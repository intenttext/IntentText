import { describe, it, expect } from "vitest";
import { convertHtmlToIntentText, parseIntentText } from "../src/index";

// The first table's {headers, rows} anywhere in the parsed document.
function firstTable(
  src: string,
): { headers?: string[]; rows: string[][] } | null {
  const doc = parseIntentText(src);
  const walk = (bs: Array<{ table?: unknown; children?: unknown[] }>): unknown => {
    for (const b of bs) {
      if (b.table) return b.table;
      if (b.children) {
        const t = walk(b.children as typeof bs);
        if (t) return t;
      }
    }
    return null;
  };
  return walk(doc.blocks) as { headers?: string[]; rows: string[][] } | null;
}

describe("#24: an HTML table cell with <br>/newline keeps its data row", () => {
  it("does not silently DROP the row (was: newline split the row → 0 rows)", () => {
    const html = `<table>
      <tr><th>Account</th><th>Detail</th></tr>
      <tr><td>DE89 3704</td><td>Line one<br>Line two</td></tr>
    </table>`;
    const t = firstTable(convertHtmlToIntentText(html));
    expect(t).toBeTruthy();
    expect(t!.rows.length).toBe(1); // the transaction row survived
    expect(t!.rows[0][0]).toBe("DE89 3704");
    expect(t!.rows[0][1]).toMatch(/Line one Line two/); // <br> collapsed to a space
  });
});

describe("#25: a literal pipe in a table cell does not shift columns", () => {
  it("HTML cell containing '|' round-trips as ONE cell", () => {
    const html = `<table>
      <tr><th>Note</th><th>Amount</th></tr>
      <tr><td>debit|credit</td><td>100</td></tr>
    </table>`;
    const it = convertHtmlToIntentText(html);
    expect(it).toContain("debit\\|credit"); // escaped in the emitted .it
    const t = firstTable(it);
    expect(t!.rows[0].length).toBe(2); // still 2 columns, not shifted to 3
    expect(t!.rows[0][0]).toBe("debit|credit"); // unescaped back to the literal pipe
    expect(t!.rows[0][1]).toBe("100");
  });

  it("parser unescapes \\| in a markdown-table row", () => {
    const t = firstTable("| Note | Amount |\n| --- | --- |\n| a\\|b | 5 |");
    expect(t!.rows[0]).toEqual(["a|b", "5"]);
  });
});
