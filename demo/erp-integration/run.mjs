// Runnable end-to-end demo of the Jadwal ERP integration.
//   pnpm demo:erp        (from the repo root)
//   node run.mjs         (from this folder)
//
// It simulates the whole flow with zero infrastructure: load a template (as if from
// the print-template Mongo collection), take an invoice (as if from Jadwal's invoices
// collection), merge + render, and write the HTML. Server PDF is one extra step
// (see intenttext-pdf.server.mjs) and is left out here so this runs with no extra deps.

import { readFileSync, writeFileSync } from "node:fs";
import { renderDocumentHTML, renderDocumentPrintHTML } from "./intenttext-print.mjs";

const here = (f) => new URL(f, import.meta.url);

// ── 1. The template — in Jadwal this is one Mongo document ───────────────────
//   db.collection("print-template").findOne({ key: "invtemplate", company: companyId })
//   → { key: "invtemplate", company, theme: "corporate", source: "<.it text>" }
// Here we read the same `.it` text from a file.
const printTemplate = {
  key: "invtemplate",
  theme: "corporate",
  source: readFileSync(here("invoice-template.it"), "utf8"),
};

// ── 2. The invoice — in Jadwal this is a row from your invoices collection ───
const invoice = JSON.parse(readFileSync(here("invoice-data.json"), "utf8"));

// ── 3. Render. One call each. ────────────────────────────────────────────────
const html = renderDocumentHTML(printTemplate.source, invoice, {
  theme: printTemplate.theme,
});
const printHtml = renderDocumentPrintHTML(printTemplate.source, invoice, {
  theme: printTemplate.theme,
});

writeFileSync(here("out.invoice.html"), html);
writeFileSync(here("out.invoice.print.html"), printHtml);

console.log("✓ Merged template + invoice data and rendered:");
console.log("    out.invoice.html        — web view (open in a browser)");
console.log("    out.invoice.print.html  — print view (Cmd/Ctrl+P → Save as PDF)");
console.log("\nIn Jadwal the same three calls power the Print button — no viewer needed.");
