import { useEffect, useState } from "react";
import { parseHistorySection } from "@intenttext/core";

interface Props {
  content: string;
  onClose: () => void;
}

interface Revision {
  version?: string;
  date?: string;
  author?: string;
  section?: string;
  was?: string;
  now?: string;
  ref?: string;
  note?: string;
}

export function HistoryModal({ content, onClose }: Props) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const history = parseHistorySection(content);
      setRevisions(Array.isArray(history) ? history : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [content]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560 }}
      >
        <h2>📜 Revision History</h2>

        {error && (
          <p style={{ color: "var(--error)", fontSize: 13 }}>{error}</p>
        )}

        {revisions.length === 0 && !error && (
          <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", padding: 16 }}>
            No revision history found in this document.
          </p>
        )}

        {revisions.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              maxHeight: 400,
              overflowY: "auto",
            }}
          >
            {revisions.map((rev, i) => (
              <div
                key={i}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: "var(--bg-app)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <strong style={{ fontSize: 13 }}>
                    {rev.version || `Revision ${revisions.length - i}`}
                  </strong>
                  {rev.date && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {rev.date}
                    </span>
                  )}
                </div>
                {rev.author && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 4px" }}>
                    By {rev.author}
                  </p>
                )}
                {rev.section && (
                  <p style={{ fontSize: 12, margin: "0 0 4px" }}>
                    <strong>Section:</strong> {rev.section}
                  </p>
                )}
                {rev.was && (
                  <p
                    style={{
                      fontSize: 12,
                      margin: "0 0 2px",
                      color: "#ef4444",
                      textDecoration: "line-through",
                    }}
                  >
                    {rev.was}
                  </p>
                )}
                {rev.now && (
                  <p style={{ fontSize: 12, margin: "0 0 2px", color: "#22c55e" }}>
                    {rev.now}
                  </p>
                )}
                {rev.ref && (
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0" }}>
                    Ref: {rev.ref}
                  </p>
                )}
                {rev.note && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0", fontStyle: "italic" }}>
                    {rev.note}
                  </p>
                )}
              </div>
            ))}
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
