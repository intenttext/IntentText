import { useState } from "react";
import { verifyDocument } from "@intenttext/core";

interface Props {
  content: string;
  onApply: (content: string) => void;
  onClose: () => void;
}

export function AmendModal({ content, onApply, onClose }: Props) {
  const [section, setSection] = useState("");
  const [was, setWas] = useState("");
  const [now, setNow] = useState("");
  const [ref, setRef] = useState("");
  const [error, setError] = useState("");

  const handleAmend = () => {
    if (!section.trim() || !was.trim() || !now.trim()) {
      setError("Section, Was, and Now fields are all required");
      return;
    }
    try {
      const verify = verifyDocument(content) as { frozen?: boolean };
      if (!verify.frozen) {
        setError("Document is not sealed — amend is only for sealed documents");
        return;
      }
      // Build the amended source by appending an amendment block
      const amendmentLine = `amendment: ${section.trim()} | was: ${was.trim()} | now: ${now.trim()}${ref.trim() ? ` | ref: ${ref.trim()}` : ""}`;
      const updated = content.trimEnd() + "\n" + amendmentLine + "\n";
      onApply(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>✏️ Amend Sealed Document</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          Create a tracked amendment to a sealed document. The original seal
          remains intact — changes are recorded in the revision history.
        </p>

        <label>Section *</label>
        <input
          type="text"
          value={section}
          onChange={(e) => setSection(e.target.value)}
          placeholder="Which section was amended"
          autoFocus
        />

        <label>Was *</label>
        <input
          type="text"
          value={was}
          onChange={(e) => setWas(e.target.value)}
          placeholder="Original text"
        />

        <label>Now *</label>
        <input
          type="text"
          value={now}
          onChange={(e) => setNow(e.target.value)}
          placeholder="New / corrected text"
        />

        <label>Reference</label>
        <input
          type="text"
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="e.g. Board Resolution §4.2"
        />

        {error && (
          <p style={{ color: "var(--error)", fontSize: 13 }}>{error}</p>
        )}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleAmend}>
            Record Amendment
          </button>
        </div>
      </div>
    </div>
  );
}
