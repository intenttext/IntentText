import { useState } from "react";
import {
  convertMarkdownToIntentText,
  convertHtmlToIntentText,
} from "@intenttext/core";

interface Props {
  onApply: (content: string) => void;
  onClose: () => void;
}

type Tab = "markdown" | "html";

export function ConvertModal({ onApply, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("markdown");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");

  const handleConvert = () => {
    setError("");
    try {
      let result: string;
      if (tab === "markdown") {
        result = convertMarkdownToIntentText(input);
      } else {
        result = convertHtmlToIntentText(input);
      }
      setOutput(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleUse = () => {
    if (output) {
      onApply(output);
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 640, width: "90vw" }}
      >
        <h2>🔄 Convert to Dotit (.it)</h2>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            className={tab === "markdown" ? "btn-primary" : "btn-secondary"}
            onClick={() => {
              setTab("markdown");
              setOutput("");
              setError("");
            }}
          >
            Markdown
          </button>
          <button
            className={tab === "html" ? "btn-primary" : "btn-secondary"}
            onClick={() => {
              setTab("html");
              setOutput("");
              setError("");
            }}
          >
            HTML
          </button>
        </div>

        <label>Paste {tab === "markdown" ? "Markdown" : "HTML"} below</label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            tab === "markdown"
              ? "# My Document\n\nSome paragraph text..."
              : "<h1>My Document</h1>\n<p>Some paragraph text...</p>"
          }
          style={{
            width: "100%",
            height: 160,
            resize: "vertical",
            fontFamily: "monospace",
            fontSize: 12,
            background: "var(--bg-app)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: 8,
          }}
        />

        <button
          className="btn-primary"
          onClick={handleConvert}
          style={{ marginTop: 8 }}
        >
          Convert
        </button>

        {error && (
          <p style={{ color: "var(--error)", fontSize: 13, marginTop: 8 }}>
            {error}
          </p>
        )}

        {output && (
          <>
            <label style={{ marginTop: 12 }}>Result (.it)</label>
            <textarea
              value={output}
              readOnly
              style={{
                width: "100%",
                height: 160,
                resize: "vertical",
                fontFamily: "monospace",
                fontSize: 12,
                background: "var(--bg-app)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: 8,
              }}
            />
          </>
        )}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {output && (
            <button className="btn-primary" onClick={handleUse}>
              Use in Editor
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
