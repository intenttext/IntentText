#!/usr/bin/env node
/**
 * gen-pdfa-sample.mjs — render a sample .it to PDF/A for the veraPDF CI gate.
 *
 *   node scripts/gen-pdfa-sample.mjs <icc-profile-path> <out.pdf>
 *
 * Needs a Chrome (puppeteer) and a standard sRGB ICC profile. The CI workflow
 * downloads both, runs this, then validates <out.pdf> with veraPDF.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { renderPDF } from "../dist/index.js";

const [iccPath, outPath = "out-pdfa.pdf"] = process.argv.slice(2);
if (!iccPath) {
  console.error("usage: gen-pdfa-sample.mjs <icc-profile-path> [out.pdf]");
  process.exit(1);
}

const iccProfile = new Uint8Array(readFileSync(iccPath));

const source = `title: Archival Invoice INV-2026-001
meta: | author: Jadwal | type: invoice
section: Bill To
text: Dalil Technology LLC
section: Items
table:
headers: Description | Amount
row: Consulting | 1,200.00
row: Total | 1,200.00
text: Thank you for your business.`;

const pdf = await renderPDF(source, {
  theme: "corporate",
  pdfA: { iccProfile, conformance: "3B", title: "Archival Invoice INV-2026-001", author: "Jadwal" },
});

writeFileSync(outPath, pdf);
console.log(`wrote ${outPath} (${pdf.length} bytes) — validate with veraPDF --flavour 3b`);
