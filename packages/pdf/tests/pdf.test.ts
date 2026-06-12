import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { verifyDocument, parseIntentText } from "@dotit/core";
import { issueDocument, issuePDF, htmlToPDF } from "../src/index";

const TEMPLATE = `page: | size: A4 | footer: {{invoice.number}} · Page {{page}}
title: Invoice {{invoice.number}}
summary: {{company.name}} → {{customer.name}}
section: Items
| Description | Qty | Total | each: items |
| {{item.description}} | {{item.qty}} | {{item.total}} |
section: Totals
metric: Subtotal | value: {{totals.subtotal}}
metric: Total Due | value: {{totals.due}}
section: Notes
text: {{invoice.notes}}`;

const DATA = {
  invoice: { number: "INV-9" },
  company: { name: "Jadwal" },
  customer: { name: "Acme" },
  items: [
    { description: "Dev", qty: 1, total: "1,000" },
    { description: "Design", qty: 2, total: "500" },
  ],
  totals: { subtotal: "1,500", due: "1,575" },
};

describe("issueDocument (merge → seal → print HTML, no Chrome)", () => {
  it("returns a sealed source that verifies intact", () => {
    const issued = issueDocument(TEMPLATE, DATA, { signer: "Jadwal Billing", role: "Finance" });
    expect(issued.hash).toMatch(/^sha256:/);
    const v = verifyDocument(issued.source);
    expect(v.frozen).toBe(true);
    expect(v.intact).toBe(true);
    expect(v.signers?.[0]?.signer).toBe("Jadwal Billing");
  });

  it("detects tampering on the stored artifact", () => {
    const issued = issueDocument(TEMPLATE, DATA, { signer: "Jadwal Billing" });
    const tampered = issued.source.replace("1,575", "9,999");
    expect(verifyDocument(tampered).intact).toBe(false);
  });

  it("blanks missing fields by default (finished documents)", () => {
    const issued = issueDocument(TEMPLATE, { ...DATA, invoice: { number: "INV-9" } }, {
      signer: "Jadwal Billing",
    });
    // invoice.notes is missing → must not leak the {{token}} into the document
    expect(issued.source).not.toContain("{{invoice.notes}}");
    expect(issued.html).not.toContain("{{invoice.notes}}");
  });

  it("keeps the sealed source queryable", () => {
    const issued = issueDocument(TEMPLATE, DATA, { signer: "Jadwal Billing" });
    const doc = parseIntentText(issued.source);
    const collect = (blocks: ReturnType<typeof parseIntentText>["blocks"]): number =>
      blocks.reduce(
        (n, b) => n + (b.type === "metric" ? 1 : 0) + (b.children ? collect(b.children) : 0),
        0,
      );
    expect(collect(doc.blocks)).toBe(2);
  });

  it("produces print HTML with page counters and totals rows", () => {
    const issued = issueDocument(TEMPLATE, DATA, { signer: "Jadwal Billing" });
    expect(issued.html).toContain("counter(page)");
    expect(issued.html).toContain('it-metric-row__value">1,575');
  });
});

describe("htmlToPDF / issuePDF (Chrome required)", () => {
  // Real end-to-end: uses puppeteer-core + a system Chrome. Skipped when absent (CI).
  const chrome = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
  ].find((p) => p && existsSync(p));

  it.skipIf(!chrome)("issuePDF returns real PDF bytes for the sealed document", async () => {
    const out = await issuePDF(TEMPLATE, DATA, {
      signer: "Jadwal Billing",
      executablePath: chrome,
    });
    expect(out.pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(out.pdf.length).toBeGreaterThan(5_000);
    expect(verifyDocument(out.source).intact).toBe(true);
  }, 60_000);

  it.skipIf(!chrome)("htmlToPDF renders arbitrary print HTML", async () => {
    const pdf = await htmlToPDF("<!doctype html><html><body><h1>Hi</h1></body></html>", {
      executablePath: chrome,
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 60_000);
});
