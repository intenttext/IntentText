// Template mode: everything needed to author a merge template (.it with
// {{variables}} and each: table loops) and check it against real data —
// without leaving the editor.
//
//  • Variables  — every {{path}} used in the document, detected live.
//  • Sample data — a JSON object (persisted locally per file) used to test.
//  • Preview merged / PDF — runs the SAME parseAndMerge + renderPrint pipeline
//    the ERP/print integration uses, so what you test here is what production
//    produces.

import { useEffect, useMemo, useState } from "react";
import { parseAndMerge, renderPrint, documentToSource } from "@dotit/core";
import {
  extractTemplateVariables,
  buildSampleSkeleton,
} from "../visual/template-highlight";
import { printHtmlViaIframe } from "./print-iframe";

interface Props {
  content: string;
  theme: string;
  filename: string;
  onInsert: (text: string) => void;
}

export function TemplatePanel({ content, theme, filename, onInsert }: Props) {
  const storageKey = `it-template-data:${filename || "untitled"}`;
  const variables = useMemo(() => extractTemplateVariables(content), [content]);

  const [dataText, setDataText] = useState("");
  const [error, setError] = useState("");
  const [mergedPreview, setMergedPreview] = useState("");

  // Load persisted sample data (or build a skeleton from the variables).
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setDataText(saved);
    } else if (variables.length) {
      setDataText(JSON.stringify(buildSampleSkeleton(variables), null, 2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (dataText) localStorage.setItem(storageKey, dataText);
  }, [dataText, storageKey]);

  const parseData = (): Record<string, unknown> | null => {
    try {
      const v = JSON.parse(dataText || "{}");
      if (typeof v !== "object" || v === null || Array.isArray(v)) {
        setError("Sample data must be a JSON object.");
        return null;
      }
      setError("");
      return v as Record<string, unknown>;
    } catch (e) {
      setError(`Invalid JSON: ${(e as Error).message}`);
      return null;
    }
  };

  const previewMerged = () => {
    const data = parseData();
    if (!data) return;
    try {
      const merged = parseAndMerge(content, data, { missing: "keep" });
      setMergedPreview(documentToSource(merged));
    } catch (e) {
      setError(`Merge failed: ${(e as Error).message}`);
    }
  };

  const printMerged = () => {
    const data = parseData();
    if (!data) return;
    try {
      // The exact production pipeline: merge (blank missing fields on finished
      // documents) → print-ready HTML → PDF via the browser.
      const merged = parseAndMerge(content, data, { missing: "blank" });
      const html = renderPrint(merged, { theme });
      printHtmlViaIframe(html);
    } catch (e) {
      setError(`Print failed: ${(e as Error).message}`);
    }
  };

  const resetSkeleton = () =>
    setDataText(JSON.stringify(buildSampleSkeleton(variables), null, 2));

  return (
    <div className="template-panel">
      <h2 className="template-panel__title">Template</h2>
      <p className="template-panel__hint">
        Use <code>{"{{path.to.value}}"}</code> for merge fields and a table row
        with <code>each: items</code> to repeat per item. Test with sample data
        below — the preview uses the same merge engine production uses.
      </p>

      <div className="template-panel__section">
        <div className="template-panel__label">
          Variables{" "}
          <span className="template-panel__count">{variables.length}</span>
        </div>
        {variables.length === 0 ? (
          <div className="template-panel__empty">
            No variables yet — click one below to insert a starter, or type{" "}
            <code>{"{{customer.name}}"}</code> in the document.
          </div>
        ) : (
          <div className="template-panel__vars">
            {variables.map((v) => (
              <button
                key={v}
                className="template-panel__var"
                title="Insert at cursor"
                onClick={() => onInsert(`{{${v}}}`)}
              >
                {v}
              </button>
            ))}
          </div>
        )}
        <div className="template-panel__quick">
          {["customer.name", "invoice.number", "totals.total"].map((v) => (
            <button
              key={v}
              className="template-panel__var template-panel__var--ghost"
              onClick={() => onInsert(`{{${v}}}`)}
            >
              + {v}
            </button>
          ))}
        </div>
      </div>

      <div className="template-panel__section">
        <div className="template-panel__label">
          Sample data (JSON)
          <button className="template-panel__mini" onClick={resetSkeleton}>
            Rebuild from variables
          </button>
        </div>
        <textarea
          className="template-panel__json"
          value={dataText}
          onChange={(e) => setDataText(e.target.value)}
          spellCheck={false}
          placeholder='{ "customer": { "name": "Acme" } }'
        />
        {error && <div className="template-panel__error">{error}</div>}
      </div>

      <div className="template-panel__actions">
        <button className="btn-primary" onClick={printMerged}>
          🖨 PDF with data
        </button>
        <button className="btn-secondary" onClick={previewMerged}>
          Preview merged .it
        </button>
      </div>

      {mergedPreview && (
        <div className="template-panel__section">
          <div className="template-panel__label">
            Merged result
            <button
              className="template-panel__mini"
              onClick={() => setMergedPreview("")}
            >
              Hide
            </button>
          </div>
          <pre className="template-panel__preview">{mergedPreview}</pre>
        </div>
      )}
    </div>
  );
}
