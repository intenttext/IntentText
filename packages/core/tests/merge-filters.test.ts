/**
 * merge-filters.test.ts — display filters in merge placeholders (G-15).
 *
 * "The ERP computes, `.it` formats": business math stays in the ERP; these `Intl`
 * filters only present the values it passes in. All fail soft (never break a merge).
 *
 * NOTE the syntax: `{{key|filter:arg}}` with NO spaces around the `|`. A space-pipe-
 * space (` | `) is `.it`'s reserved line-level property delimiter, so the parser would
 * split it before merge runs. Spaces at the braces are fine: `{{ key|filter:arg }}`.
 */
import { describe, it, expect } from "vitest";
import { parseAndMerge, documentToSource } from "../src/index";

const merged = (tpl: string, data: Record<string, unknown>): string =>
  documentToSource(parseAndMerge(tpl, data));

describe("G-15: merge display filters", () => {
  it("currency formats a number with grouping + symbol", () => {
    const out = merged("text: Total {{amount|currency:QAR}}", { amount: 1234.5 });
    expect(out).toContain("1,234.50");
    expect(out).toContain("QAR");
  });

  it("number applies fixed decimals + grouping; strips comma input", () => {
    expect(merged("text: {{n|number:2}}", { n: 1000 })).toContain("1,000.00");
    expect(merged("text: {{n|number}}", { n: "1,234.5" })).toContain("1,234.5");
  });

  it("percent treats the value as a fraction (Intl convention)", () => {
    expect(merged("text: VAT {{r|percent}}", { r: 0.05 })).toContain("5%");
  });

  it("date formats an ISO date (away from the raw string)", () => {
    const out = merged("text: Due {{d|date:long}}", { d: "2026-07-01" });
    expect(out).toContain("2026");
    expect(out).not.toContain("2026-07-01"); // it was formatted, not echoed raw
  });

  it("upper / lower string filters", () => {
    expect(merged("text: {{name|upper}}", { name: "acme" })).toContain("ACME");
    expect(merged("text: {{name|lower}}", { name: "ACME" })).toContain("acme");
  });

  it("spaces at the braces are fine (only spaces AROUND the pipe break it)", () => {
    expect(merged("text: {{ amount|currency:QAR }}", { amount: 50 })).toContain("QAR");
  });

  it("plain {{path}} (no filter) is unchanged", () => {
    expect(merged("text: Hi {{name}}", { name: "Ada" })).toContain("Hi Ada");
  });

  it("fails soft: a numeric filter on non-numeric data returns the value", () => {
    expect(merged("text: {{name|currency:USD}}", { name: "Ada" })).toContain("Ada");
  });

  it("fails soft: an unknown filter passes the value through", () => {
    expect(merged("text: {{name|bogus}}", { name: "Ada" })).toContain("Ada");
  });

  it("filters compose left-to-right", () => {
    expect(merged("text: {{c|trim|upper}}", { c: "  qar  " })).toContain("QAR");
  });
});
