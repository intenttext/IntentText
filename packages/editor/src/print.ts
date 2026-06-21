// Print / export engine for the editor.
//
// The UI for these actions lives in the ribbon (DocsToolbar.tsx); host apps can
// also call exportDocumentPDF / exportDocumentHTML directly — this module owns
// the WYSIWYG print path and the document export functions they trigger.

import {
  parseIntentText,
  renderPrint,
  listBuiltinThemes,
  cssContentValue,
  renderTrustBand,
  TRUST_BAND_CSS,
  trustBandPositionCss,
} from "@dotit/core";
import { getPageGeometry } from "./page-geometry";
import { printHtmlViaIframe } from "./print-iframe";

export type PrintMode = "normal" | "minimal-ink";

/** Inject extra CSS before </head> of an HTML document string. */
function injectCss(html: string, css: string): string {
  if (!css) return html;
  return html.includes("</head>")
    ? html.replace("</head>", `<style>${css}</style></head>`)
    : html;
}

const MINIMAL_INK_CSS =
  ".it-doc-callout{background:none!important;border:1px solid #ccc!important}";

// Header/footer CSS `content` value (maps {{page}}/{{pages}} → counters, CSS-escapes).
// Shared with core's renderPrint so the editor and core build running headers/footers
// identically — single source of truth.
const cssContent = cssContentValue;

/**
 * WYSIWYG print: render the editor's OWN content DOM with its OWN stylesheets, so the
 * PDF looks exactly like the visual editor. Page size / margins / running header+footer
 * come from the document's page:/header:/footer: blocks via @page. Returns null when
 * the visual editor isn't mounted — caller falls back to renderPrint.
 */
function buildWysiwygPrint(content: string, printMode: string): string | null {
  const tiptap = document.querySelector(".docs-page .tiptap");
  if (!tiptap) return null;

  const clone = tiptap.cloneNode(true) as HTMLElement;
  // Page-break spacers are a screen affordance; print paginates natively via @page.
  clone.querySelectorAll("[data-it-spacer]").forEach((e) => e.remove());
  // Comments (// lines) are an editing affordance only — never print them.
  clone
    .querySelectorAll('.it-doc-comment, [data-it-type="comment"]')
    .forEach((e) => e.remove());
  // The inline sign:/freeze: rows are redundant with the seal stamp (trust band) —
  // strip them from print so only the stamp certifies the document.
  clone
    .querySelectorAll('[data-trust="sign"], [data-trust="seal"], [data-trust="freeze"]')
    .forEach((e) => e.remove());
  const bodyHtml = clone.innerHTML;

  // Copy the page's stylesheets (the bundled editor CSS + injected theme) verbatim.
  const styles = Array.from(
    document.querySelectorAll('style, link[rel="stylesheet"]'),
  )
    .map((e) => e.outerHTML)
    .join("\n");

  // Use the SAME geometry the on-screen pages use (the doc's page: block parsed
  // by page-geometry.ts) — identical px numbers in @page is what makes the PDF
  // paginate exactly where the editor shows the breaks.
  const g = getPageGeometry(content);
  const sizeCss = g.autoHeight
    ? `${g.width}px auto`
    : `${g.width}px ${g.height}px`;
  const marginCss = `${g.marginTop}px ${g.marginRight}px ${g.marginBottom}px ${g.marginLeft}px`;

  const hSize = g.headerSize || "10pt";
  const fSize = g.footerSize || "10pt";
  let pageCss = `@page{size:${sizeCss};margin:${marginCss};}`;
  if (g.header)
    pageCss += `@page{@top-center{content:${cssContent(g.header)};font-family:-apple-system,sans-serif;font-size:${hSize};color:#9aa0a6;}}`;
  if (g.footer)
    pageCss += `@page{@bottom-center{content:${cssContent(g.footer)};font-family:-apple-system,sans-serif;font-size:${fSize};color:#9aa0a6;}}`;

  // Unified trust band (core) — pinned in the bottom margin so it repeats on every
  // printed page and never takes content space. Same band core's renderPrint uses.
  let bandHtml = "";
  try {
    bandHtml = renderTrustBand(content);
  } catch {
    /* no band */
  }
  // Shared band visual (single source of truth in core) + fixed positioning so it
  // pins in the bottom-right corner and repeats on every printed page.
  const bandCss = bandHtml ? TRUST_BAND_CSS + trustBandPositionCss("fixed") : "";

  // Strip the on-screen sheet chrome so only the page content prints.
  const overrides = `
    html,body{margin:0;background:#fff;}
    .docs-page,.docs-page.docs-sheet{box-shadow:none;border-radius:0;margin:0;width:auto;min-height:0;padding:0;background:#fff;}
    .docs-page .tiptap{padding:0;}
    [data-it-spacer]{display:none!important;}
    ${bandCss}
    ${printMode === "minimal-ink" ? MINIMAL_INK_CSS : ""}
  `;

  return `<!doctype html><html><head><meta charset="utf-8">${styles}<style>${pageCss}${overrides}</style></head><body><div class="docs-page docs-sheet"><div class="tiptap">${bandHtml}${bodyHtml}</div></div></body></html>`;
}

function download(data: string, filename: string, mime: string) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Build the print-ready HTML: WYSIWYG when the visual editor is mounted,
 *  core renderPrint otherwise (e.g. a source-mode export). */
function buildPrintHtml(
  content: string,
  theme: string,
  printMode: PrintMode,
  bare = false,
): string {
  // BARE prints the content-only projection through core's print engine (never the
  // styled WYSIWYG canvas), so "print" from the Bare view matches what's on screen.
  let full = bare ? "" : buildWysiwygPrint(content, printMode) || "";
  if (!full) {
    const doc = parseIntentText(content);
    full = renderPrint(doc, { theme, bare });
    if (printMode === "minimal-ink") full = injectCss(full, MINIMAL_INK_CSS);
  }
  return full;
}

/** Print / save-as-PDF via the browser's print dialog. Browser-only.
 *  `bare` prints the content-only (as-signed) projection. */
export function exportDocumentPDF(
  content: string,
  theme: string,
  printMode: PrintMode = "normal",
  bare = false,
) {
  try {
    printHtmlViaIframe(buildPrintHtml(content, theme, printMode, bare));
  } catch {
    /* ignore */
  }
}

/** Download the raw `.it` source as a file. This is the editor's "Save".
 *  Derives a filename from the document's meta id / title when available. */
export function downloadItFile(content: string, filename?: string) {
  try {
    let name = filename;
    if (!name) {
      try {
        const doc = parseIntentText(content);
        const meta = doc.blocks.find((b) => b.type === "meta");
        const id = meta?.properties?.id;
        const title =
          doc.blocks.find((b) => b.type === "title")?.content || "";
        const base = String(id || title || "document")
          .trim()
          .replace(/[^\w\-]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60) || "document";
        name = `${base}.it`;
      } catch {
        name = "document.it";
      }
    }
    download(content, name, "text/plain;charset=utf-8");
  } catch {
    /* ignore */
  }
}

/** Download the print-ready HTML document. Browser-only. */
export function exportDocumentHTML(
  content: string,
  theme: string,
  printMode: PrintMode = "normal",
) {
  try {
    download(
      buildPrintHtml(content, theme, printMode),
      "document.html",
      "text/html",
    );
  } catch {
    /* ignore */
  }
}

/** Built-in theme ids — for the ribbon's theme select. */
export function builtinThemes(): string[] {
  return listBuiltinThemes() as string[];
}
