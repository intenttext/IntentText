import { useEffect, useState } from "react";
import { verifyDocument, type VerifyResult } from "@intenttext/core";

interface Props {
  content: string;
  onClose: () => void;
}

export function VerifyModal({ content, onClose }: Props) {
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const r = verifyDocument(content);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [content]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>🔍 Verify Document</h2>

        {error && (
          <p style={{ color: "var(--error)", fontSize: 13 }}>{error}</p>
        )}

        {result && !result.frozen && (
          <div style={{ padding: 16, textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
              This document has not been sealed yet.
            </p>
          </div>
        )}

        {result && result.frozen && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: 12,
                borderRadius: 8,
                background: result.intact
                  ? "rgba(34,197,94,0.1)"
                  : "rgba(239,68,68,0.1)",
                border: `1px solid ${result.intact ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
              }}
            >
              <span style={{ fontSize: 24 }}>
                {result.intact ? "✅" : "❌"}
              </span>
              <div>
                <strong style={{ color: result.intact ? "#22c55e" : "#ef4444" }}>
                  {result.intact ? "Document Intact" : "Document Tampered"}
                </strong>
                <br />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {result.intact
                    ? "Content hash matches — no unauthorized changes"
                    : "Hash mismatch — content was modified after sealing"}
                </span>
              </div>
            </div>

            {result.frozenAt && (
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Sealed At
                </label>
                <p style={{ margin: "4px 0 0", fontSize: 13 }}>
                  {result.frozenAt}
                </p>
              </div>
            )}

            {result.signers && result.signers.length > 0 && (
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Signers
                </label>
                {result.signers.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "baseline",
                      marginTop: 4,
                      fontSize: 13,
                    }}
                  >
                    <span>🖊️ {s.signer}</span>
                    {s.role && (
                      <span style={{ color: "var(--text-muted)" }}>
                        ({s.role})
                      </span>
                    )}
                    {s.at && (
                      <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                        {s.at}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {result.hash && (
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Content Hash
                </label>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 11,
                    fontFamily: "monospace",
                    wordBreak: "break-all",
                    color: "var(--text-muted)",
                  }}
                >
                  {result.hash}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
