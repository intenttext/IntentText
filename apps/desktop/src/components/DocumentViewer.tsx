// DocumentViewer — the "opens like a PDF" read-only paper view. This is the
// DEFAULT when you click a .it file: the document is rendered through core's
// renderPrint (the same engine the PDF export uses) into a sandboxed iframe, so
// it looks exactly like the printed/exported page — clean, paginated, themed —
// without leaking the document's stylesheet into the app chrome. An Edit button
// (in the host) switches to the @dotit/editor for editing.

import { useMemo } from "react";
import { parseIntentText, renderPrint } from "@dotit/core";

export function DocumentViewer(props: { content: string; theme: string }) {
  const { content, theme } = props;

  const html = useMemo(() => {
    try {
      const doc = parseIntentText(content);
      const page = renderPrint(doc, { theme });
      // Center the rendered page on a neutral "desk" and give it a paper shadow,
      // so a single page reads like an opened PDF rather than a raw web page.
      const deskCss = `
        <style>
          html,body{margin:0;background:transparent;}
          body{display:flex;justify-content:center;padding:28px 0 48px;}
        </style>`;
      return page.includes("</head>")
        ? page.replace("</head>", `${deskCss}</head>`)
        : `${deskCss}${page}`;
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
