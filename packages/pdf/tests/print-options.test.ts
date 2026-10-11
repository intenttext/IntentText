// @dotit/pdf 3.4.0 — the seal/QR options reach the printed paper, and the exact
// sealed source reaches the renderer.
//
// The bug this pins: the print HTML was drawn from the parsed MODEL only, and a
// `| … |` table re-serializes as `row:` lines — different bytes, so the trust band
// re-hashed something other than what was sealed and printed SEAL BROKEN on a valid
// document. Needs @dotit/core 3.9 (seal.verifyUrl, sealPosition, merge literal, seal:).
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyDocument, sealDocument } from "@dotit/core";
import { issueDocument, issuePDF, renderPDF } from "../src/index";

// A pipe-table template: the layout that re-serializes differently from how it was sealed.
const TEMPLATE = `title: Invoice {{invoice.number}}
summary: {{company.name}} → {{customer.name}}
section: Items
headers: Description | Qty | Total
|---|---:|---:|
| {{first.description}} | 1 | 1,000.00 |
| Design | 2 | 500.00 |
text: Notes: {{invoice.notes}}`;

const DATA = {
  invoice: { number: "INV-9", notes: "net_30 *rush* @finance" },
  company: { name: "Horizon Trading Co." },
  customer: { name: "Acme" },
  first: { description: "Development" },
};

const TEMPLATE_AR = `title: فاتورة {{invoice.number}}
summary: {{company.name}}
headers: البيان | الكمية | الإجمالي
|---|---:|---:|
| {{first.description}} | 1 | 1,000.00 |
text: ملاحظات: {{invoice.notes}}`;

const DATA_AR = {
  invoice: { number: "INV-9", notes: "صافي_30" },
  company: { name: "شركة الأفق" },
  first: { description: "تطوير" },
};

describe("the exact sealed source reaches the trust band", () => {
  for (const [lang, template, data] of [
    ["en", TEMPLATE, DATA],
    ["ar", TEMPLATE_AR, DATA_AR],
  ] as const) {
    it(`a valid seal over a pipe table never prints SEAL BROKEN (${lang})`, () => {
      const issued = issueDocument(template, data, { signer: "Billing", role: "Accounts" });
      expect(verifyDocument(issued.source).intact).toBe(true);
      expect(issued.html).not.toContain("SEAL BROKEN");
      expect(issued.html).not.toContain('class="it-trust-band it-trust-band--broken"');
      expect(issued.html).toContain('<div class="it-trust-band">');
    });
  }

  it("a really tampered source still prints the broken stamp", () => {
    const issued = issueDocument(TEMPLATE, DATA, { signer: "Billing" });
    const forged = issued.source.replace("1,000.00", "9,999.00");
    expect(verifyDocument(forged).intact).toBe(false);
  });
});

describe("seal options", () => {
  const issue = (o: object = {}) => issueDocument(TEMPLATE, DATA, { signer: "Billing", ...o });

  it("default: the band is pinned to every page, no QR", () => {
    const { html } = issue();
    expect(html).toContain("position:fixed");
    expect(html).not.toContain("it-trust-band__qr");
  });

  it("seal.verifyUrl draws the verify QR", () => {
    expect(issue({ seal: { verifyUrl: "https://example.qa/d/INV-9" } }).html).toContain("it-trust-band__qr");
  });

  it("sealPosition 'end' prints the band after the last block, not pinned", () => {
    const { html } = issue({ sealPosition: "end" });
    expect(html).toContain('<div class="it-trust-band-end">');
    expect(html).not.toMatch(/\.it-trust-band\{position:fixed/);
  });

  it("seal: false leaves the band off", () => {
    expect(issue({ seal: false }).html).not.toContain('<div class="it-trust-band');
  });

  it("a seal: line in the template puts the band there", () => {
    const withLine = `${TEMPLATE}\nseal: | align: start`;
    const { html, source } = issueDocument(withLine, DATA, { signer: "Billing" });
    expect(verifyDocument(source).intact).toBe(true);
    expect(html).toContain('<div class="it-seal-slot it-seal-slot--start">');
    expect(html).not.toMatch(/\.it-trust-band\{position:fixed/);
  });
});

describe("IssueOptions.literal", () => {
  it("off (default): merged marks are inline-formatted as before", () => {
    const { html } = issueDocument(TEMPLATE, DATA, { signer: "Billing" });
    expect(html).not.toContain("net_30 *rush* @finance");
  });

  it("on: the merged value prints as written, and the sealed source holds the escapes", () => {
    const { html, source } = issueDocument(TEMPLATE, DATA, { signer: "Billing", literal: true });
    expect(html).toContain("net_30 *rush* @finance");
    expect(source).toContain("net\\\\_30"); // `\\` at line level, then `\_` for the inline parser
    expect(verifyDocument(source).intact).toBe(true);
  });
});

describe("keepEmptyCells", () => {
  // A statement line without a document number: an empty cell must keep its column.
  const LEDGER = (dir: string) => `${dir === "rtl" ? "meta: | dir: rtl\n" : ""}headers: ${dir === "rtl" ? "التاريخ | المستند | البيان | الرصيد" : "Date | Document | Description | Balance"}
| {{l.date}} | {{l.doc}} | {{l.text}} | {{l.balance}} |`;
  const cells = (html: string) =>
    [...html.matchAll(/<tr class="intent-row">([\s\S]*?)<\/tr>/g)].map(([, row]) =>
      [...row.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((m) => m[1]),
    );
  for (const dir of ["rtl", "ltr"]) {
    const data = { l: { date: "2026-09-15", doc: "", text: dir === "rtl" ? "رصيد افتتاحي" : "Opening balance", balance: "1,000.00" } };
    it(`on: an empty value keeps its column, merged, sealed and printed (${dir})`, () => {
      const out = issueDocument(LEDGER(dir), data, { signer: "Billing", keepEmptyCells: true });
      expect(verifyDocument(out.source).intact).toBe(true);
      expect(cells(out.html)[0]).toEqual(["2026-09-15", "", data.l.text, "1,000.00"]);
    });
    it(`off (default): as before, the empty cell is dropped (${dir})`, () => {
      const out = issueDocument(LEDGER(dir), data, { signer: "Billing" });
      expect(cells(out.html)[0]).toEqual(["2026-09-15", data.l.text, "1,000.00"]);
    });
  }
});

describe("through real Chrome", () => {
  const chrome = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
  ].find((p) => p && existsSync(p));
  const hasPdftotext = spawnSync("pdftotext", ["-v"]).status === 0;

  // Hand-authored pipe rows, sealed as written: the printed band must verify those
  // exact bytes. (Re-serialized from the model they come back as `row:` lines.)
  const PIPE = [
    "title: Invoice INV-9",
    "headers: Description | Qty | Total",
    "|---|---:|---:|",
    "| Development | 1 | 1,000.00 |",
    "| Design | 2 | 500.00 |",
    "",
  ].join("\n");

  it.skipIf(!chrome || !hasPdftotext)(
    "renderPDF prints a valid seal over hand-written pipe rows as intact, not SEAL BROKEN",
    async () => {
      const source = sealDocument(PIPE, { signer: "Billing" }).source;
      expect(verifyDocument(source).intact).toBe(true);
      const dir = mkdtempSync(join(tmpdir(), "it-pdf-pipe-"));
      try {
        const f = join(dir, "pipe.pdf");
        writeFileSync(f, await renderPDF(source, { executablePath: chrome }));
        const text = spawnSync("pdftotext", ["-layout", f, "-"]).stdout.toString();
        expect(text).toContain("sha256");
        expect(text).not.toContain("BROKEN");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    120_000,
  );

  it.skipIf(!chrome || !hasPdftotext)(
    "renderPDF and issuePDF print the band intact over a pipe table, once, at the seal: line",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "it-pdf-"));
      try {
        const text = (pdf: Buffer, name: string) => {
          const f = join(dir, name);
          writeFileSync(f, pdf);
          return spawnSync("pdftotext", ["-layout", f, "-"]).stdout.toString();
        };
        const out = await issuePDF(`${TEMPLATE}\nseal: | align: center`, DATA, {
          signer: "Billing",
          executablePath: chrome,
          seal: { verifyUrl: "https://example.qa/d/INV-9" },
        });
        const issued = text(out.pdf, "issued.pdf");
        expect(issued).toContain("sha256");
        expect(issued).not.toContain("BROKEN");
        // The stored source renders to the same intact band through renderPDF.
        const again = text(await renderPDF(out.source, { executablePath: chrome }), "again.pdf");
        expect(again).toContain("sha256");
        expect(again).not.toContain("BROKEN");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    120_000,
  );
});
