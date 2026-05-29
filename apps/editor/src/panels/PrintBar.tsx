import { useState } from "react";
import {
  parseIntentText,
  renderHTML,
  generateThemeCSS,
  getBuiltinTheme,
  listBuiltinThemes,
} from "@intenttext/core";

interface Props {
  content: string;
  theme: string;
  onThemeChange: (theme: string) => void;
}

const EDITOR_PAGE_MARGIN_MM = 25.4;

function buildPrintCss(themeCss: string, printMode: "normal" | "minimal-ink") {
  return `
@page { size: A4; margin: ${EDITOR_PAGE_MARGIN_MM}mm; }
html, body { margin: 0; padding: 0; }
body {
  font-family: "Inter", "Segoe UI", sans-serif;
  font-size: 15px;
  line-height: 1.7;
  color: #202124;
}
p:empty::after { content: '\\00a0'; white-space: pre; }
h1 { font-size: 28px; font-weight: 700; line-height: 1.3; letter-spacing: -0.5px; margin: 0 0 4px; }
h2 { font-size: 22px; font-weight: 600; line-height: 1.3; margin: 24px 0 4px; padding-bottom: 4px; border-bottom: 1px solid #dadce0; }
h3 { font-size: 17px; font-weight: 600; line-height: 1.3; margin: 16px 0 2px; }
p { margin: 4px 0; }
.it-summary { color: #5f6368; font-size: 16px; line-height: 1.5; margin: 0 0 8px; }
.it-callout { padding: 12px 16px; border-radius: 8px; margin: 8px 0; }
.it-divider { border: none; border-top: 1px solid #dadce0; margin: 16px 0; }
pre { background: #f8f9fa; padding: 12px 16px; border-radius: 8px; font-size: 13px; line-height: 1.6; overflow-x: auto; }
blockquote { border-left: 3px solid #9aa0a6; padding-left: 16px; margin: 12px 0; color: #3c4043; font-style: italic; }
h1, h2, h3, p, pre, blockquote, .it-callout, .it-generic, .it-doc-generic { page-break-inside: avoid; break-inside: avoid; }
${printMode === "minimal-ink" ? ".it-callout{background:none!important;border:1px solid #ccc!important}" : ""}
${themeCss}
`;
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
      const doc = parseIntentText(content);
      const html = renderHTML(doc, { theme });
      const t = getBuiltinTheme(theme);
      const css = t ? generateThemeCSS(t) : "";
      const preservedHtml = html.replace(/<p><\/p>/g, "<p>&nbsp;</p>");
      const full = `<!doctype html><html><head><style>${buildPrintCss(css, printMode)}</style></head><body>${preservedHtml}</body></html>`;

      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;left:-9999px;width:0;height:0";
      document.body.appendChild(iframe);
      iframe.contentDocument!.open();
      iframe.contentDocument!.write(full);
      iframe.contentDocument!.close();
      setTimeout(() => {
        iframe.contentWindow!.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 300);
    } catch {
      /* ignore */
    }
  };

  const exportHTML = () => {
    try {
      const doc = parseIntentText(content);
      const html = renderHTML(doc, { theme });
      const t = getBuiltinTheme(theme);
      const css = t ? generateThemeCSS(t) : "";
      const preservedHtmlExport = html.replace(/<p><\/p>/g, "<p>&nbsp;</p>");
      const full = `<!doctype html>
<html>
<head>
<style>${buildPrintCss(css, printMode)}</style>
</head>
<body>
${preservedHtmlExport}
</body>
</html>`;
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
