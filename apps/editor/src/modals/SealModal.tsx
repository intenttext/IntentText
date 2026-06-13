import { useState } from "react";
import { sealDocument, isTemplate } from "@dotit/core";

interface Props {
  content: string;
  onApply: (content: string) => void;
  onClose: () => void;
}

export function SealModal({ content, onApply, onClose }: Props) {
  const [signer, setSigner] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");

  // A template (.it blueprint) is outside the trust workflow — sealing it would
  // hash placeholder text. Refuse and tell the user to merge first.
  const template = isTemplate(content);

  const handleSeal = () => {
    if (template) {
      setError("Templates can't be sealed — merge first.");
      return;
    }
    if (!signer.trim()) {
      setError("Signer name is required");
      return;
    }
    try {
      const result = sealDocument(content, {
        signer: signer.trim(),
        role: role.trim() || undefined,
      });
      if (result.success) {
        onApply(result.source);
        onClose();
      } else {
        setError("Seal failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Seal Document</h2>
        {template ? (
          <p
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              marginBottom: 16,
            }}
          >
            📐 This is a <strong>template</strong> — outside the trust workflow.
            Templates can't be sealed. Merge it with data to produce a signable
            document, then seal the result.
          </p>
        ) : (
          <p
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              marginBottom: 16,
            }}
          >
            Sealing creates a content hash that prevents tampering. No further
            edits are allowed without an amendment.
          </p>
        )}
        <label>Signer Name *</label>
        <input
          type="text"
          value={signer}
          onChange={(e) => setSigner(e.target.value)}
          placeholder="Full name"
          autoFocus
        />
        <label>Role</label>
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="e.g. Legal Counsel"
        />
        {error && (
          <p style={{ color: "var(--error)", fontSize: 13 }}>{error}</p>
        )}
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSeal}
            disabled={template}
            title={
              template ? "Templates can't be sealed — merge first." : undefined
            }
          >
            Seal Document
          </button>
        </div>
      </div>
    </div>
  );
}
