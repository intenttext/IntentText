import { useMemo } from "react";
import { DOCUMENT_CSS } from "./verify";

/**
 * Render the document into a sandboxed iframe. We use `srcDoc` + a strict
 * `sandbox` attribute (no scripts, no top navigation) so the verifier can SEE
 * the .it document — the "opens like a PDF" experience — without the document's
 * own markup being able to run code or touch the host page.
 */
export function Preview({ html }: { html: string }) {
  const srcDoc = useMemo(() => {
    return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  html,body{margin:0;background:#fff;}
  body{padding:8px 4px;}
  ${DOCUMENT_CSS}
</style></head><body>${html}</body></html>`;
  }, [html]);

  return (
    <div className="preview-wrap">
      <div className="preview-head">
        <span aria-hidden>📄</span>
        <span>Document preview</span>
        <span
          style={{ marginLeft: "auto", fontWeight: 400, fontSize: "0.78rem" }}
        >
          rendered locally · sandboxed
        </span>
      </div>
      <iframe
        className="preview-frame"
        title="Document preview"
        sandbox=""
        srcDoc={srcDoc}
        onLoad={(e) => {
          // Auto-size the frame to its content height.
          const f = e.currentTarget;
          try {
            const h = f.contentWindow?.document.body.scrollHeight;
            if (h) f.style.height = `${h + 24}px`;
          } catch {
            /* cross-origin guard — ignore */
          }
        }}
      />
    </div>
  );
}
