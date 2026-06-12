import { useEffect, useState } from "react";
import { parseIntentText } from "@dotit/core";
import type { RevisionEntry } from "@dotit/core";

interface Props {
  content: string;
  onClose: () => void;
}

const CHANGE_COLOR: Record<RevisionEntry["change"], string> = {
  added: "#22c55e",
  removed: "#ef4444",
  modified: "#f59e0b",
  moved: "#3b82f6",
};

export function HistoryModal({ content, onClose }: Props) {
  const [revisions, setRevisions] = useState<RevisionEntry[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      // Parse with the history section attached, then read its revisions.
      // parseHistorySection expects only the raw below-boundary text, so going
      // through the parser (which finds the boundary) is the correct path.
      const doc = parseIntentText(content, { includeHistorySection: true });
      const revs = doc.history?.revisions ?? [];
      // Newest first.
      setRevisions([...revs].reverse());
      setError("");
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
        <h2>Revision History</h2>

        {error && (
          <p style={{ color: "var(--error)", fontSize: 13 }}>{error}</p>
        )}

        {revisions.length === 0 && !error && (
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              textAlign: "center",
              padding: 16,
            }}
          >
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
                key={`${rev.id}-${i}`}
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
                    alignItems: "center",
                    marginBottom: 8,
                    gap: 8,
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: 0.4,
                        padding: "2px 6px",
                        borderRadius: 4,
                        color: "#fff",
                        background: CHANGE_COLOR[rev.change] ?? "#6b7280",
                      }}
                    >
                      {rev.change}
                    </span>
                    <strong style={{ fontSize: 13 }}>
                      {rev.version ? `v${rev.version}` : `Revision ${i + 1}`}
                    </strong>
                    {rev.block && (
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {rev.block}
                      </span>
                    )}
                  </span>
                  {rev.at && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {rev.at}
                    </span>
                  )}
                </div>
                {rev.by && (
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      margin: "0 0 4px",
                    }}
                  >
                    By {rev.by}
                  </p>
                )}
                {rev.section && (
                  <p style={{ fontSize: 12, margin: "0 0 4px" }}>
                    <strong>Section:</strong> {rev.section}
                  </p>
                )}
                {rev.wasSection && rev.nowSection && (
                  <p style={{ fontSize: 12, margin: "0 0 4px" }}>
                    <strong>Moved:</strong> {rev.wasSection} → {rev.nowSection}
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
                  <p
                    style={{
                      fontSize: 12,
                      margin: "0 0 2px",
                      color: "#22c55e",
                    }}
                  >
                    {rev.now}
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
