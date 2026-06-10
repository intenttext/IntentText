// ─────────────────────────────────────────────────────────────────────────────
// OPTIONAL — server-side PDF *files* (for emailing / archiving invoices).
// Only needed if you want a real PDF buffer on the server. For an interactive
// "Print" button, prefer the zero-dependency browser path in intenttext-print.mjs.
//
//   npm i puppeteer        ← only this extra dep, only if you use this file
// ─────────────────────────────────────────────────────────────────────────────

import { renderDocumentPrintHTML } from "./intenttext-print.mjs";

/**
 * Merge + render the template, then produce a PDF buffer via headless Chrome.
 * @returns {Promise<Buffer>} the PDF bytes — write to disk, attach to an email, etc.
 */
export async function renderDocumentPDF(templateSource, data, opts = {}) {
  const html = renderDocumentPrintHTML(templateSource, data, opts);
  const puppeteer = (await import("puppeteer")).default;
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    // preferCSSPageSize honors the document's `page:` size/margins from the .it.
    return await page.pdf({ printBackground: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
  }
}
