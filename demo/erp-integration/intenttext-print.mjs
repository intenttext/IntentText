// ─────────────────────────────────────────────────────────────────────────────
// intenttext-print — the entire ERP print integration. Copy this file into Jadwal.
//
//   npm i @intenttext/core      ← the one and only dependency
//
// A template is a plain `.it` string (authored in the .it editor, stored as a string
// field in your print-template collection). Merge it with an invoice/report data
// object and you get HTML or a print-ready document — no template engine, no PDF
// library, no viewer to build. Works in the browser AND in Node (same code).
// ─────────────────────────────────────────────────────────────────────────────

import { parseAndMerge, renderHTML, renderPrint } from "@intenttext/core";

/**
 * Merge `data` into the `.it` template and return a full, self-contained HTML
 * document (inline CSS, themed). Use this to preview/show the result in a page.
 *
 * @param {string} templateSource  the `.it` template text (e.g. Mongo doc `.source`)
 * @param {object} data            the invoice/report data (any nested JSON)
 * @param {{theme?: string}} [opts] theme name: corporate | legal | editorial | ...
 * @returns {string} a complete <html> document
 */
export function renderDocumentHTML(templateSource, data, opts = {}) {
  const doc = parseAndMerge(templateSource, data);
  return renderHTML(doc, { theme: opts.theme || "corporate" });
}

/**
 * Same merge, but returns print-optimized HTML: @page size/margins, running
 * header/footer with page numbers, page-break control. Feed this to a print
 * dialog (browser) or a headless renderer (server) to get a PDF.
 */
export function renderDocumentPrintHTML(templateSource, data, opts = {}) {
  const doc = parseAndMerge(templateSource, data);
  return renderPrint(doc, { theme: opts.theme || "corporate" });
}

/**
 * BROWSER ONLY — open the native print dialog (→ "Save as PDF") for the given
 * HTML. Zero extra dependencies: it prints exactly what you see. This is the
 * whole "Print" button. Pass the output of renderDocumentPrintHTML().
 */
export function printHTML(html) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:210mm;height:297mm;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  let printed = false;
  const go = () => {
    if (printed) return;
    printed = true;
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } finally {
      setTimeout(() => iframe.remove(), 1000);
    }
  };
  iframe.onload = () => setTimeout(go, 120);

  const idoc = iframe.contentWindow.document;
  idoc.open();
  idoc.write(html);
  idoc.close();
  if (idoc.readyState === "complete") setTimeout(go, 250);
}

/** Convenience: merge + open the print dialog in one call (browser). */
export function printDocument(templateSource, data, opts = {}) {
  printHTML(renderDocumentPrintHTML(templateSource, data, opts));
}
