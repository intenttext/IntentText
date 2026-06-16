import { describe, it, expect } from "vitest";
import { renderHTML, parseIntentText } from "../src/index";

function html(src: string) {
  return renderHTML(parseIntentText(src));
}

describe("complex tables — merged cells", () => {
  it("`<` merges a cell into the one on its left (colspan)", () => {
    const src = `table:
headers: A | B | C
row: spans two | < | third
row: x | y | z`;
    const out = html(src);
    expect(out).toContain('colspan="2"');
    expect(out).toContain(">spans two</td>");
    // the continuation cell is consumed (no stray cell)
    expect(out).not.toMatch(/<td[^>]*>\s*&lt;\s*<\/td>/);
  });

  it("`^` merges a cell into the one above (rowspan)", () => {
    const src = `table:
headers: Item | Qty
row: Widget | 3
row: ^ | 5`;
    const out = html(src);
    expect(out).toContain('rowspan="2"');
    expect(out).toContain(">Widget</td>");
    // second row emits only the Qty cell (the ^ is consumed)
    const rows = out.match(/<tr class="intent-row">[\s\S]*?<\/tr>/g) || [];
    expect(rows).toHaveLength(2);
    expect(rows[1]).toContain(">5</td>");
    expect(rows[1]).not.toContain("^");
  });

  it("an empty cell is NOT a merge", () => {
    const src = `table:
headers: A | B
row:  | filled`;
    const out = html(src);
    // two cells, first empty — no colspan/rowspan
    expect(out).not.toContain("colspan");
    expect(out).not.toContain("rowspan");
  });
});
