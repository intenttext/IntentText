import { describe, it, expect } from "vitest";
import { queryBlocks } from "../src/query";
import { IntentDocument, IntentBlock } from "../src/types";

// "Query your documents like a database" is a core promise. Block properties are
// always strings, and the old compareValues only subtracted when BOTH sides were JS
// numbers — so money/metric amounts fell through to `new Date()` (misreading "30" as
// a year) then localeCompare (lexical "100" < "20"). A bank filtering `amount>10000`
// or ranking "top 5 invoices" silently got the WRONG rows. These are the red-team cases.

const metric = (
  id: string,
  name: string,
  value: string,
  unit = "QAR",
): IntentBlock => ({
  id,
  type: "metric",
  content: name,
  properties: { value, unit },
});

const task = (id: string, name: string, due: string): IntentBlock => ({
  id,
  type: "task",
  content: name,
  properties: { due },
});

const doc = (blocks: IntentBlock[]): IntentDocument =>
  ({ blocks }) as IntentDocument;

const names = (r: { blocks: IntentBlock[] }) => r.blocks.map((b) => b.content);

describe("C-2: numeric / money range queries", () => {
  it("value>50 returns the large amount only (not lexical/date garbage)", () => {
    const d = doc([metric("a", "A", "9"), metric("b", "B", "100"), metric("c", "C", "20")]);
    expect(
      names(queryBlocks(d, { where: [{ field: "value", operator: ">", value: "50" }] })),
    ).toEqual(["B"]);
  });

  it('value>100 does not wrongly include "30" (was coerced via new Date)', () => {
    const d = doc([metric("a", "Year", "2024"), metric("b", "Thirty", "30")]);
    expect(
      names(queryBlocks(d, { where: [{ field: "value", operator: ">", value: "100" }] })),
    ).toEqual(["Year"]);
  });

  it("handles thousands separators and K/M/B magnitude suffixes", () => {
    const d = doc([
      metric("a", "Big", "1,000,000"),
      metric("b", "Small", "500"),
      metric("c", "Mid", "3.80M"),
    ]);
    expect(
      names(queryBlocks(d, { where: [{ field: "value", operator: ">", value: "1000" }] })).sort(),
    ).toEqual(["Big", "Mid"]);
    // 3.80M (3,800,000) > 1,000,000, but 1,000,000 is not > 1,000,000
    expect(
      names(queryBlocks(d, { where: [{ field: "value", operator: ">", value: "1000000" }] })),
    ).toEqual(["Mid"]);
  });

  it("compares percent values numerically", () => {
    const d = doc([metric("a", "VAT", "5%", "%"), metric("b", "Fee", "12%", "%")]);
    expect(
      names(queryBlocks(d, { where: [{ field: "value", operator: ">=", value: "10" }] })),
    ).toEqual(["Fee"]);
  });
});

describe("C-2: numeric sort", () => {
  it("sorts numbers numerically, not lexically", () => {
    const d = doc([metric("a", "9", "9"), metric("b", "100", "100"), metric("c", "20", "20")]);
    expect(names(queryBlocks(d, { sort: [{ field: "value", direction: "asc" }] }))).toEqual([
      "9",
      "20",
      "100",
    ]);
    expect(names(queryBlocks(d, { sort: [{ field: "value", direction: "desc" }] }))).toEqual([
      "100",
      "20",
      "9",
    ]);
  });

  it("top-2 largest invoices (sort desc + limit) surfaces the right rows", () => {
    const d = doc([
      metric("a", "Inv-A", "1,200"),
      metric("b", "Inv-B", "9,999"),
      metric("c", "Inv-C", "300"),
      metric("d", "Inv-D", "45,000"),
    ]);
    expect(
      names(queryBlocks(d, { sort: [{ field: "value", direction: "desc" }], limit: 2 })),
    ).toEqual(["Inv-D", "Inv-B"]);
  });
});

describe("C-2: genuine dates still work (no regression)", () => {
  it("sorts an ISO date column chronologically", () => {
    const d = doc([
      task("a", "late", "2026-03-05"),
      task("b", "early", "2026-02-20"),
      task("c", "mid", "2026-02-28"),
    ]);
    expect(names(queryBlocks(d, { sort: [{ field: "due", direction: "asc" }] }))).toEqual([
      "early",
      "mid",
      "late",
    ]);
  });

  it("date < comparison still filters correctly", () => {
    const d = doc([task("a", "x", "2026-03-05"), task("b", "y", "2026-02-20")]);
    expect(
      names(queryBlocks(d, { where: [{ field: "due", operator: "<", value: "2026-03-01" }] })),
    ).toEqual(["y"]);
  });
});
