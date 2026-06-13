import { useMemo } from "react";

/**
 * Render the document into a sandboxed iframe. We use `srcDoc` + a strict
 * `sandbox` attribute (no scripts, no top navigation) so the verifier can SEE
 * the .it document — the "opens like a PDF" experience — without the document's
 * own markup being able to run code or touch the host page.
 */
export function Preview({ html }: { html: string }) {
  // `html` is already a complete self-contained document from core's renderPrint
  // (CSS embedded) — use it directly so the preview matches the PDF exactly.
  const srcDoc = useMemo(() => html, [html]);

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
