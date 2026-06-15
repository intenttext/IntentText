// DocumentViewer — the "opens like a PDF" read-only paper view. This is the
// DEFAULT when you click a .it file: the document is rendered through core's
// renderPrint (the same engine the PDF export uses) into a sandboxed iframe,
// then laid out as a real PAGE sheet — the doc's page size (A4/Letter/…) as a
// centered white sheet with the page margins as padding and a paper shadow, on
// a neutral desk. So it reads like an opened PDF, not a full-width web page. An
// Edit button (in the host) switches to the @dotit/editor for editing.

import { useMemo } from "react";
import { parseIntentText, renderPrint } from "@dotit/core";
import { getPageGeometry } from "@dotit/editor";

export function DocumentViewer(props: { content: string; theme: string }) {
  const { content, theme } = props;

  const html = useMemo(() => {
    try {
      const doc = parseIntentText(content);
      const page = renderPrint(doc, { theme });
      const g = getPageGeometry(content);

      // renderPrint's @page margins only apply at print time; on screen the body
      // has no page box. So we draw the page ourselves: a fixed-width white sheet
      // (the doc's page width) with the page margins as padding and a shadow,
      // centred on a grey desk — the PDF look. Auto-height pages (receipts) grow
      // with content; fixed pages get a min-height so a short document still
      // shows a full page.
      const sizeRule = g.autoHeight ? "" : `min-height:${g.height}px;`;
      const sheetCss = `
        <style>
          html{background:#eceef1;}
          body{margin:0;padding:32px 0 64px;display:block;}
          body.it-print{
            width:${g.width}px;
            max-width:100%;
            margin:0 auto;
            background:#fff;
            box-sizing:border-box;
            padding:${g.marginTop}px ${g.marginRight}px ${g.marginBottom}px ${g.marginLeft}px;
            ${sizeRule}
            box-shadow:0 1px 3px rgba(0,0,0,.10), 0 10px 30px rgba(0,0,0,.13);
            border-radius:2px;
          }
          @media (max-width:${g.width + 40}px){
            body{padding:16px 0 40px;}
            body.it-print{width:auto;margin:0 12px;}
          }
        </style>`;
      return page.includes("</head>")
        ? page.replace("</head>", `${sheetCss}</head>`)
        : `${sheetCss}${page}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `<!doctype html><meta charset="utf-8"><body style="font:14px -apple-system,sans-serif;color:#b91c1c;padding:40px">Could not render document.<br><br><pre style="white-space:pre-wrap;color:#6b7280">${msg
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</pre></body>`;
    }
  }, [content, theme]);

  return (
    <div className="doc-viewer">
      <iframe
        className="doc-viewer-frame"
        title="Document preview"
        sandbox=""
        srcDoc={html}
      />
    </div>
  );
}
