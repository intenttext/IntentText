// Print / export engine for the editor.
//
// The UI for these actions lives in the ribbon (visual/DocsToolbar.tsx) and the
// top toolbar's source-mode export buttons — this module owns the WYSIWYG print
// path and the document export functions they trigger.

import {
  parseIntentText,
  renderPrint,
  listBuiltinThemes,
  cssContentValue,
} from "@dotit/core";
import { getPageGeometry } from "../visual/page-geometry";
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
 * the visual editor isn't mounted (source mode) — caller falls back to renderPrint.
 */
function buildWysiwygPrint(content: string, printMode: string): string | null {
  const tiptap = document.querySelector(".docs-page .tiptap");
  if (!tiptap) return null;

  const clone = tiptap.cloneNode(true) as HTMLElement;
  // Page-break spacers are a screen affordance; print paginates natively via @page.
  clone.querySelectorAll("[data-it-spacer]").forEach((e) => e.remove());
  const bodyHtml = clone.innerHTML;

  // Copy the editor's stylesheets (bundled global.css + injected theme) verbatim.
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

  let pageCss = `@page{size:${sizeCss};margin:${marginCss};}`;
  if (g.header)
    pageCss += `@page{@top-center{content:${cssContent(g.header)};font:10px -apple-system,sans-serif;color:#9aa0a6;}}`;
  if (g.footer)
    pageCss += `@page{@bottom-center{content:${cssContent(g.footer)};font:10px -apple-system,sans-serif;color:#9aa0a6;}}`;

  // Strip the on-screen sheet chrome so only the page content prints.
  const overrides = `
    html,body{margin:0;background:#fff;}
    .docs-page,.docs-page.docs-sheet{box-shadow:none;border-radius:0;margin:0;width:auto;min-height:0;padding:0;background:#fff;}
    .docs-page .tiptap{padding:0;}
    [data-it-spacer]{display:none!important;}
    ${printMode === "minimal-ink" ? MINIMAL_INK_CSS : ""}
  `;

  return `<!doctype html><html><head><meta charset="utf-8">${styles}<style>${pageCss}${overrides}</style></head><body><div class="docs-page docs-sheet"><div class="tiptap">${bodyHtml}</div></div></body></html>`;
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
 *  core renderPrint otherwise (source mode). */
function buildPrintHtml(
  content: string,
  theme: string,
  printMode: PrintMode,
): string {
  let full = buildWysiwygPrint(content, printMode);
  if (!full) {
    const doc = parseIntentText(content);
    full = renderPrint(doc, { theme });
    if (printMode === "minimal-ink") full = injectCss(full, MINIMAL_INK_CSS);
  }
  return full;
}

/** Print / save-as-PDF via the browser's print dialog. */
export function exportDocumentPDF(
  content: string,
  theme: string,
  printMode: PrintMode = "normal",
) {
  try {
    printHtmlViaIframe(buildPrintHtml(content, theme, printMode));
  } catch {
    /* ignore */
  }
}

/** Download the print-ready HTML document. */
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
