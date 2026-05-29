import { useState } from "react";
import type { TrustState } from "../hooks/useTrustState";
import type { VerifyResult } from "@intenttext/core";

/* ─── Lifecycle step config ────────────────────────────────── */
const STEPS = [
  { key: "draft", label: "Draft", color: "#6b7280" },
  { key: "tracked", label: "Tracked", color: "#2563eb" },
  { key: "approved", label: "Approved", color: "#16a34a" },
  { key: "signed", label: "Signed", color: "#7c3aed" },
  { key: "sealed", label: "Sealed", color: "#d97706" },
] as const;

function stepIndex(lifecycle: TrustState["lifecycle"]): number {
  return STEPS.findIndex((s) => s.key === lifecycle);
}

interface Props {
  trust: TrustState;
  onTrack: (id?: string) => void;
  onApprove: (by: string, role: string, note?: string) => void;
  onSign: (by: string, role: string) => void;
  onSeal: (
    signer: string,
    role?: string,
  ) => { success: boolean; error: string | null };
  onVerify: () => VerifyResult | null;
  onAmend: (
    section: string,
    was: string,
    now: string,
    by: string,
    ref?: string,
  ) => void;
}

export function TrustPanel({
  trust,
  onTrack,
  onApprove,
  onSign,
  onSeal,
  onVerify,
  onAmend,
}: Props) {
  const currentIdx = stepIndex(trust.lifecycle);
  const [view, setView] = useState<"main" | "amend">("main");

  // Form states
  const [trackId, setTrackId] = useState("");
  const [approveName, setApproveName] = useState("");
  const [approveRole, setApproveRole] = useState("");
  const [approveNote, setApproveNote] = useState("");
  const [signName, setSignName] = useState("");
  const [signRole, setSignRole] = useState("");
  const [sealName, setSealName] = useState("");
  const [sealRole, setSealRole] = useState("");
  const [sealConfirm, setSealConfirm] = useState(false);
  const [sealError, setSealError] = useState("");

  // Verify
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  // Amend
  const [amendSection, setAmendSection] = useState("");
  const [amendWas, setAmendWas] = useState("");
  const [amendNow, setAmendNow] = useState("");
  const [amendBy, setAmendBy] = useState("");
  const [amendRef, setAmendRef] = useState("");

  const handleVerify = () => {
    const r = onVerify();
    setVerifyResult(r);
  };

  const handleSeal = () => {
    if (!sealName.trim()) {
      setSealError("Name is required");
      return;
    }
    const result = onSeal(sealName.trim(), sealRole.trim() || undefined);
    if (!result.success) {
      setSealError(result.error || "Seal failed");
    } else {
      setSealConfirm(false);
      setSealError("");
    }
  };

  const handleAmend = () => {
    if (
      !amendSection.trim() ||
      !amendWas.trim() ||
      !amendNow.trim() ||
      !amendBy.trim()
    )
      return;
    onAmend(
      amendSection.trim(),
      amendWas.trim(),
      amendNow.trim(),
      amendBy.trim(),
      amendRef.trim() || undefined,
    );
    setAmendSection("");
    setAmendWas("");
    setAmendNow("");
    setAmendBy("");
    setAmendRef("");
    setView("main");
  };

  if (view === "amend") {
    return (
      <div className="side-panel trust-panel">
        <div className="side-panel-header">
          <span className="side-panel-title">Amendment</span>
        </div>
        <div className="side-panel-body">
          <p className="trust-desc">
            The document is sealed. Amendments are formal and recorded — the
            original seal is preserved.
          </p>

          <label className="panel-label">Section being amended *</label>
          <input
            className="panel-input"
            value={amendSection}
            onChange={(e) => setAmendSection(e.target.value)}
            placeholder="e.g. Section 3.1"
          />

          <label className="panel-label">Original text *</label>
          <textarea
            className="panel-textarea"
            rows={2}
            value={amendWas}
            onChange={(e) => setAmendWas(e.target.value)}
            placeholder="Was…"
          />

          <label className="panel-label">New text *</label>
          <textarea
            className="panel-textarea"
            rows={2}
            value={amendNow}
            onChange={(e) => setAmendNow(e.target.value)}
            placeholder="Now…"
          />

          <label className="panel-label">Reference</label>
          <input
            className="panel-input"
            value={amendRef}
            onChange={(e) => setAmendRef(e.target.value)}
            placeholder="Amendment #1"
          />

          <label className="panel-label">Amended by *</label>
          <input
            className="panel-input"
            value={amendBy}
            onChange={(e) => setAmendBy(e.target.value)}
            placeholder="Full name"
          />

          <div className="trust-actions">
            <button className="btn-secondary" onClick={() => setView("main")}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={
                !amendSection.trim() ||
                !amendWas.trim() ||
                !amendNow.trim() ||
                !amendBy.trim()
              }
              onClick={handleAmend}
            >
              Record Amendment
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="side-panel trust-panel">
      <div className="side-panel-header">
        <span className="side-panel-title">Trust</span>
      </div>
      <div className="side-panel-body">
        {/* ── Lifecycle Tracker ───────────────── */}
        <div className="trust-lifecycle">
          <div className="trust-lifecycle-label">Document Status</div>
          {STEPS.map((step, i) => {
            const isComplete = i < currentIdx;
            const isCurrent = i === currentIdx;
            return (
              <div
                key={step.key}
                className={`trust-step ${isComplete ? "complete" : ""} ${isCurrent ? "current" : ""}`}
              >
                <div
                  className="trust-step-dot"
                  style={{
                    borderColor: i <= currentIdx ? step.color : "#d1d5db",
                    background: i <= currentIdx ? step.color : "transparent",
                  }}
                >
                  {isComplete && (
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="#fff">
                      <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                    </svg>
                  )}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className="trust-step-line"
                    style={{
                      background: i < currentIdx ? step.color : "#e5e7eb",
                    }}
                  />
                )}
                <span
                  className="trust-step-label"
                  style={{
                    color: i <= currentIdx ? step.color : "#9ca3af",
                    fontWeight: isCurrent ? 600 : 400,
                  }}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── Sealed State ──────────────────── */}
        {trust.isSealed && (
          <div className="trust-sealed-card">
            <div className="trust-sealed-badge">
              <svg
                viewBox="0 0 16 16"
                width="14"
                height="14"
                fill="currentColor"
                style={{ verticalAlign: "middle", marginRight: 4 }}
              >
                <path d="M8 1a4 4 0 00-4 4v2H3a1 1 0 00-1 1v6a1 1 0 001 1h10a1 1 0 001-1V8a1 1 0 00-1-1h-1V5a4 4 0 00-4-4zm-2 4a2 2 0 114 0v2H6V5z" />
              </svg>
              DOCUMENT SEALED
            </div>
            {trust.sealedBy && (
              <div className="trust-sealed-detail">
                Sealed by: {trust.sealedBy}
              </div>
            )}
            {trust.sealedAt && (
              <div className="trust-sealed-detail">Date: {trust.sealedAt}</div>
            )}
            {trust.sealHash && (
              <div className="trust-sealed-detail trust-hash">
                Hash: {trust.sealHash.slice(0, 12)}…
                <button
                  className="panel-chip"
                  onClick={() => navigator.clipboard.writeText(trust.sealHash!)}
                  title="Copy hash"
                >
                  Copy
                </button>
              </div>
            )}

            <button className="trust-verify-btn" onClick={handleVerify}>
              ✓ Verify Seal
            </button>
            {verifyResult && (
              <div
                className={`trust-verify-result ${verifyResult.intact ? "pass" : "fail"}`}
              >
                {verifyResult.intact
                  ? "✓ Seal is valid — document has not been modified"
                  : "✗ Seal verification failed — document may have been modified"}
              </div>
            )}

            <button
              className="trust-amend-btn"
              onClick={() => setView("amend")}
            >
              Amend Document
            </button>
          </div>
        )}

        {/* ── Track (Draft → Tracked) ───────── */}
        {trust.lifecycle === "draft" && (
          <div className="trust-action-card">
            <div className="trust-action-title">Start Tracking</div>
            <p className="trust-desc">
              Track this document to enable version history and the approval
              workflow.
            </p>
            <label className="panel-label">Document ID (optional)</label>
            <input
              className="panel-input"
              value={trackId}
              onChange={(e) => setTrackId(e.target.value)}
              placeholder="Auto-generated if empty"
            />
            <button
              className="btn-primary trust-action-btn"
              onClick={() => {
                onTrack(trackId.trim() || undefined);
                setTrackId("");
              }}
            >
              Start Tracking
            </button>
          </div>
        )}

        {/* ── Approve (Tracked → Approved) ──── */}
        {trust.isTracked && !trust.isSealed && (
          <div className="trust-action-card">
            <div className="trust-action-title">Approval</div>

            {trust.approvals.length > 0 && (
              <div className="trust-list">
                {trust.approvals.map((a, i) => (
                  <div key={i} className="trust-list-item trust-list-approve">
                    <span className="trust-list-check">✓</span>
                    <span>{a.by}</span>
                    {a.role && (
                      <span className="trust-list-role">— {a.role}</span>
                    )}
                    {a.at && <span className="trust-list-date">{a.at}</span>}
                  </div>
                ))}
              </div>
            )}

            <label className="panel-label">Approved by *</label>
            <input
              className="panel-input"
              value={approveName}
              onChange={(e) => setApproveName(e.target.value)}
              placeholder="Full name"
            />
            <label className="panel-label">Role *</label>
            <input
              className="panel-input"
              value={approveRole}
              onChange={(e) => setApproveRole(e.target.value)}
              placeholder="e.g. Legal Counsel"
            />
            <label className="panel-label">Note (optional)</label>
            <input
              className="panel-input"
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              placeholder="Optional note"
            />
            <button
              className="btn-primary trust-action-btn"
              disabled={!approveName.trim() || !approveRole.trim()}
              onClick={() => {
                onApprove(
                  approveName.trim(),
                  approveRole.trim(),
                  approveNote.trim() || undefined,
                );
                setApproveName("");
                setApproveRole("");
                setApproveNote("");
              }}
            >
              {trust.approvals.length > 0
                ? "Add Another Approval"
                : "Record Approval"}
            </button>
          </div>
        )}

        {/* ── Sign (Approved → Signed) ──────── */}
        {trust.approvals.length > 0 && !trust.isSealed && (
          <div className="trust-action-card">
            <div className="trust-action-title">Signature</div>

            {trust.signatures.length > 0 && (
              <div className="trust-list">
                {trust.signatures.map((s, i) => (
                  <div key={i} className="trust-list-item trust-list-sign">
                    <span className="trust-list-check">✒</span>
                    <span>{s.by}</span>
                    {s.role && (
                      <span className="trust-list-role">— {s.role}</span>
                    )}
                    {s.at && <span className="trust-list-date">{s.at}</span>}
                  </div>
                ))}
              </div>
            )}

            <label className="panel-label">Your Name *</label>
            <input
              className="panel-input"
              value={signName}
              onChange={(e) => setSignName(e.target.value)}
              placeholder="Full name"
            />
            <label className="panel-label">Your Role *</label>
            <input
              className="panel-input"
              value={signRole}
              onChange={(e) => setSignRole(e.target.value)}
              placeholder="e.g. CEO"
            />
            <button
              className="btn-primary trust-action-btn"
              disabled={!signName.trim() || !signRole.trim()}
              onClick={() => {
                onSign(signName.trim(), signRole.trim());
                setSignName("");
                setSignRole("");
              }}
            >
              {trust.signatures.length > 0 ? "Add Signature" : "Sign Document"}
            </button>
          </div>
        )}

        {/* ── Seal (Signed → Sealed) ──────── */}
        {trust.signatures.length > 0 && !trust.isSealed && (
          <div className="trust-action-card trust-seal-card">
            <div className="trust-action-title">Seal Document</div>
            <p className="trust-desc">
              Sealing will lock this document. Content cannot be changed after
              sealing. Use Amend to make formal changes.
            </p>

            {!sealConfirm ? (
              <button
                className="trust-seal-btn"
                onClick={() => setSealConfirm(true)}
              >
                <svg
                  viewBox="0 0 16 16"
                  width="12"
                  height="12"
                  fill="currentColor"
                  style={{ verticalAlign: "middle", marginRight: 4 }}
                >
                  <path d="M8 1a4 4 0 00-4 4v2H3a1 1 0 00-1 1v6a1 1 0 001 1h10a1 1 0 001-1V8a1 1 0 00-1-1h-1V5a4 4 0 00-4-4zm-2 4a2 2 0 114 0v2H6V5z" />
                </svg>
                Seal Document
              </button>
            ) : (
              <div className="trust-seal-confirm">
                <p className="trust-desc" style={{ fontWeight: 500 }}>
                  Once sealed, content is locked. All changes must go through
                  the formal amendment process.
                </p>
                <label className="panel-label">Your Name *</label>
                <input
                  className="panel-input"
                  value={sealName}
                  onChange={(e) => setSealName(e.target.value)}
                  placeholder="Full name"
                  autoFocus
                />
                <label className="panel-label">Role</label>
                <input
                  className="panel-input"
                  value={sealRole}
                  onChange={(e) => setSealRole(e.target.value)}
                  placeholder="e.g. CEO"
                />
                {sealError && <p className="trust-error">{sealError}</p>}
                <div className="trust-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setSealConfirm(false);
                      setSealError("");
                    }}
                  >
                    Cancel
                  </button>
                  <button className="trust-seal-btn" onClick={handleSeal}>
                    Seal Document
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── History ────────────────────────── */}
        {(trust.approvals.length > 0 ||
          trust.signatures.length > 0 ||
          trust.isSealed ||
          trust.amendments.length > 0) && (
          <div className="trust-history">
            <div className="trust-action-title">History</div>
            <div className="trust-history-list">
              {trust.amendments.map((am, i) => (
                <div key={`am-${i}`} className="trust-history-item">
                  <span
                    className="trust-history-icon"
                    style={{ color: "#f97316" }}
                  >
                    ✎
                  </span>
                  Amendment — {am.by} {am.at && `— ${am.at}`}
                </div>
              ))}
              {trust.isSealed && (
                <div className="trust-history-item">
                  <span
                    className="trust-history-icon"
                    style={{ color: "#d97706" }}
                  >
                    <svg
                      viewBox="0 0 16 16"
                      width="12"
                      height="12"
                      fill="currentColor"
                    >
                      <path d="M8 1a4 4 0 00-4 4v2H3a1 1 0 00-1 1v6a1 1 0 001 1h10a1 1 0 001-1V8a1 1 0 00-1-1h-1V5a4 4 0 00-4-4zm-2 4a2 2 0 114 0v2H6V5z" />
                    </svg>
                  </span>
                  Sealed — {trust.sealedBy}{" "}
                  {trust.sealedAt && `— ${trust.sealedAt}`}
                </div>
              )}
              {[...trust.signatures].reverse().map((s, i) => (
                <div key={`sig-${i}`} className="trust-history-item">
                  <span
                    className="trust-history-icon"
                    style={{ color: "#7c3aed" }}
                  >
                    ✒
                  </span>
                  Signed — {s.by} {s.at && `— ${s.at}`}
                </div>
              ))}
              {[...trust.approvals].reverse().map((a, i) => (
                <div key={`app-${i}`} className="trust-history-item">
                  <span
                    className="trust-history-icon"
                    style={{ color: "#16a34a" }}
                  >
                    ✓
                  </span>
                  Approved — {a.by} {a.at && `— ${a.at}`}
                </div>
              ))}
              {trust.isTracked && trust.trackBlock && (
                <div className="trust-history-item">
                  <span
                    className="trust-history-icon"
                    style={{ color: "#2563eb" }}
                  >
                    ●
                  </span>
                  Tracked {trust.trackBlock.at && `— ${trust.trackBlock.at}`}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
