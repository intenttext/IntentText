import { useState } from "react";
import {
  parseIntentText,
  renderPrint,
  listBuiltinThemes,
  cssContentValue,
} from "@dotit/core";
import { getPageGeometry } from "../visual/page-geometry";
import { printHtmlViaIframe } from "./print-iframe";

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

interface Props {
  content: string;
  theme: string;
  onThemeChange: (theme: string) => void;
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

export function PrintBar({ content, theme, onThemeChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [printMode, setPrintMode] = useState<"normal" | "minimal-ink">(
    "normal",
  );

  const themes = listBuiltinThemes() as string[];

  const exportPDF = () => {
    try {
      // WYSIWYG: print the editor's own rendered content + stylesheets so the PDF
      // matches the on-screen view. Falls back to core renderPrint in source mode.
      let full = buildWysiwygPrint(content, printMode);
      if (!full) {
        const doc = parseIntentText(content);
        full = renderPrint(doc, { theme });
        if (printMode === "minimal-ink") full = injectCss(full, MINIMAL_INK_CSS);
      }
      printHtmlViaIframe(full);
    } catch {
      /* ignore */
    }
  };

  const exportHTML = () => {
    try {
      let full = buildWysiwygPrint(content, printMode);
      if (!full) {
        const doc = parseIntentText(content);
        full = renderPrint(doc, { theme });
        if (printMode === "minimal-ink") full = injectCss(full, MINIMAL_INK_CSS);
      }
      download(full, "document.html", "text/html");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={`print-bar ${expanded ? "expanded" : ""}`}>
      {/* ── Collapsed row ──────────────────── */}
      <div className="print-bar-row">
        <div className="print-bar-label">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Print &amp; Export
        </div>

        <div className="print-bar-controls">
          <label className="print-bar-theme">
            Theme:
            <select
              value={theme}
              onChange={(e) => onThemeChange(e.target.value)}
            >
              {themes.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <button
            className="print-bar-btn"
            onClick={exportPDF}
            title="Print / Export PDF"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            PDF
          </button>
          <button
            className="print-bar-btn"
            onClick={exportHTML}
            title="Export HTML"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            HTML
          </button>
        </div>

        <button
          className="print-bar-toggle"
          onClick={() => setExpanded(!expanded)}
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "▼" : "▲"}
        </button>
      </div>

      {/* ── Expanded content ───────────────── */}
      {expanded && (
        <div className="print-bar-expanded">
          <div className="print-bar-section">
            <div className="print-bar-section-title">Print Mode</div>
            <div className="panel-radio-group">
              <label className="panel-radio">
                <input
                  type="radio"
                  name="printMode"
                  checked={printMode === "normal"}
                  onChange={() => setPrintMode("normal")}
                />
                Normal
              </label>
              <label className="panel-radio">
                <input
                  type="radio"
                  name="printMode"
                  checked={printMode === "minimal-ink"}
                  onChange={() => setPrintMode("minimal-ink")}
                />
                Minimal ink
              </label>
            </div>
          </div>

          <div className="print-bar-section">
            <div className="print-bar-section-title">Actions</div>
            <div className="print-bar-action-row">
              <button className="btn-primary" onClick={exportPDF}>
                🖨 Print
              </button>
              <button className="btn-primary" onClick={exportPDF}>
                📄 Export PDF
              </button>
              <button className="btn-primary" onClick={exportHTML}>
                &lt;/&gt; Export HTML
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
