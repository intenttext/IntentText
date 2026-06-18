// tables-chips — editing a table cell or a meta/metric/style chip must round-trip
// to valid .it. The node-views write the edit back to a node attr (table → `rows`,
// chips → `raw`); this guards that docToSource re-emits the edited value correctly,
// and that the chip lines round-trip byte-for-byte when untouched.

import { describe, it, expect } from "vitest";
import { parseIntentText } from "@dotit/core";
import { sourceToDoc, docToSource } from "../src/bridge";

const round = (src: string) => docToSource(sourceToDoc(src));

describe("tables — cell edits serialize back to | a | b |", () => {
  const SRC = "section: Items\n| Description | Qty | Total |\n| Dev | 1 | 12000 |";

  it("a table round-trips unchanged", () => {
    expect(round(SRC)).toContain("| Description | Qty | Total |");
    expect(round(SRC)).toContain("| Dev | 1 | 12000 |");
  });

  it("an edited rows attr re-emits the new cell text", () => {
    // What the cell node-view's commit() produces: a new `rows` attr.
    const edited = {
      type: "doc",
      content: [
        {
          type: "itTable",
          attrs: {
            rows: JSON.stringify([
              ["Description", "Qty", "Total"],
              ["Design", "8", "3600"], // edited row
            ]),
          },
        },
      ],
    };
    const src = docToSource(edited);
    expect(src).toContain("| Design | 8 | 3600 |");
    // and it re-parses as a table
    expect(round(src)).toContain("| Design | 8 | 3600 |");
  });
});

describe("chips — meta / metric / style round-trip and edit via `raw`", () => {
  const cases: Record<string, string> = {
    meta: "meta: | type: invoice | id: INV-001 | version: 2",
    metric: "metric: Subtotal | value: 16500 | unit: QAR",
    style: "style: section | color: #0a7 | weight: 600",
  };

  for (const [name, src] of Object.entries(cases)) {
    it(`${name}: round-trips byte-for-byte when untouched`, () => {
      expect(round(src)).toBe(src);
    });
  }

  it("editing a chip's `raw` attr re-emits the new line verbatim", () => {
    // What the chip node-view's commit() produces: a new `raw` attr.
    const edited = {
      type: "doc",
      content: [
        {
          type: "itMetric",
          attrs: { raw: "metric: Subtotal | value: 18000 | unit: QAR" },
        },
      ],
    };
    const src = docToSource(edited);
    expect(src).toBe("metric: Subtotal | value: 18000 | unit: QAR");
    // re-parses as a metric with the new value
    const block = parseIntentText(src).blocks[0];
    expect(block.type).toBe("metric");
    expect(block.properties?.value).toBe("18000");
  });
});
