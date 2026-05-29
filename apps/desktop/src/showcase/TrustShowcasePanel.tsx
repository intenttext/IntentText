import { useMemo, useState } from "react";
import type { VerifyResult } from "@intenttext/core";
import type { TrustState } from "../hooks/useTrustState";
import type { DemoDoc } from "./demoVault";

interface Props {
  mode: "search" | "trust" | "workflow";
  onModeChange: (mode: "search" | "trust" | "workflow") => void;
  trust: TrustState;
  demoDocs: DemoDoc[];
  activeDocId: string;
  onSelectDoc: (docId: string) => void;
  content: string;
  onContentChange: (next: string) => void;
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

function withTamper(content: string): string {
  const target = "agreement";
  const i = content.toLowerCase().indexOf(target);
  if (i >= 0) {
    return content.slice(0, i) + "agxeement" + content.slice(i + target.length);
  }
  return content.replace(/([a-zA-Z])/, "x");
}

export function TrustShowcasePanel({
  mode,
  onModeChange,
  trust,
  demoDocs,
  activeDocId,
  onSelectDoc,
  content,
  onContentChange,
  onTrack,
  onApprove,
  onSign,
  onSeal,
  onVerify,
  onAmend,
}: Props) {
  const [verifyState, setVerifyState] = useState<VerifyResult | null>(null);
  const [tampered, setTampered] = useState(false);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [showAmend, setShowAmend] = useState(false);
  const [amendSection, setAmendSection] = useState("Payment Terms");
  const [amendWas, setAmendWas] = useState("30 days grace period");
  const [amendNow, setAmendNow] = useState("14 days grace period");
  const [amendBy, setAmendBy] = useState("Ahmed Al-Rashid");

  const contractDocs = useMemo(
    () => demoDocs.filter((d) => d.section === "contracts"),
    [demoDocs],
  );

  const events = [
    ...(trust.trackBlock
      ? [
          {
            label: "Tracked",
            by: trust.trackBlock.by || "system",
            at: trust.trackBlock.at || "-",
          },
        ]
      : []),
    ...trust.approvals.map((a) => ({
      label: "Approved",
      by: a.by || "-",
      at: a.at || "-",
    })),
    ...trust.signatures.map((s) => ({
      label: "Signed",
      by: s.by || "-",
      at: s.at || "-",
    })),
    ...(trust.isSealed
      ? [
          {
            label: "Sealed",
            by: trust.sealedBy || "system",
            at: trust.sealedAt || "-",
          },
        ]
      : []),
    ...trust.amendments.map((a) => ({
      label: "Amended",
      by: a.by || "-",
      at: a.at || "-",
    })),
  ];

  const runVerify = () => {
    setVerifyState(onVerify());
  };

  const simulateTamper = () => {
    if (!tampered) {
      setSnapshot(content);
      onContentChange(withTamper(content));
      setTampered(true);
      setTimeout(() => setVerifyState(onVerify()), 20);
    }
  };

  const restoreTamper = () => {
    if (snapshot != null) {
      onContentChange(snapshot);
    }
    setTampered(false);
    setSnapshot(null);
    setVerifyState(null);
  };

  return (
    <aside className="showcase-panel">
      <div className="showcase-panel-header">
        <h3>Document Trust</h3>
        <p>Track → approve → sign → seal → verify → amend timeline.</p>
        <div
          className="showcase-mode-switch"
          role="tablist"
          aria-label="Showcase modes"
        >
          <button
            className={mode === "search" ? "active" : ""}
            onClick={() => onModeChange("search")}
          >
            Search
          </button>
          <button
            className={mode === "trust" ? "active" : ""}
            onClick={() => onModeChange("trust")}
          >
            Trust
          </button>
          <button
            className={mode === "workflow" ? "active" : ""}
            onClick={() => onModeChange("workflow")}
          >
            Workflow
          </button>
        </div>
      </div>

      <div className="showcase-field">
        <label>Demo Document</label>
        <select
          value={activeDocId}
          onChange={(e) => {
            onSelectDoc(e.target.value);
            setTampered(false);
            setSnapshot(null);
            setVerifyState(null);
          }}
        >
          {contractDocs.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.section}/{doc.id}.it
            </option>
          ))}
        </select>
      </div>

      <div className="showcase-trust-state">
        <span className={`badge ${trust.isSealed ? "sealed" : "open"}`}>
          {trust.isSealed ? "SEALED" : "OPEN"}
        </span>
        <span>Lifecycle: {trust.lifecycle.toUpperCase()}</span>
      </div>

      <div className="showcase-timeline">
        {events.length === 0 && (
          <div className="showcase-empty">No trust events yet.</div>
        )}
        {events.map((e, i) => (
          <div key={`${e.label}-${i}`} className="timeline-item">
            <div className="timeline-dot" />
            <div className="timeline-body">
              <div className="timeline-title">{e.label}</div>
              <div className="timeline-meta">
                by {e.by} • {e.at}
              </div>
            </div>
          </div>
        ))}
      </div>

      {trust.sealHash && (
        <div className="showcase-hash">
          <label>Seal hash</label>
          <code>{trust.sealHash}</code>
        </div>
      )}

      {verifyState && (
        <div
          className={`showcase-verify-banner ${verifyState.intact ? "pass" : "fail"}`}
        >
          {verifyState.intact
            ? "Integrity verified: hash matches sealed content"
            : "Integrity failed: content changed after sealing"}
        </div>
      )}

      <div className="showcase-actions">
        {!trust.isTracked && (
          <button onClick={() => onTrack("DOC-SHOWCASE-001")}>
            Start Tracking
          </button>
        )}
        {!trust.isSealed && (
          <>
            <button onClick={() => onApprove("Sara Hassan", "Legal Counsel")}>
              Quick Approve
            </button>
            <button onClick={() => onSign("Ahmed Al-Rashid", "CEO")}>
              Quick Sign
            </button>
            <button onClick={() => onSeal("Ahmed Al-Rashid", "CEO")}>
              Seal Document
            </button>
          </>
        )}
        <button onClick={runVerify}>Verify Integrity</button>
        <button onClick={simulateTamper}>Simulate Tamper</button>
        {tampered && <button onClick={restoreTamper}>Restore Original</button>}
        <button onClick={() => setShowAmend((p) => !p)}>Add Amendment</button>
      </div>

      {showAmend && (
        <div className="showcase-amend-form">
          <label>Section</label>
          <input
            value={amendSection}
            onChange={(e) => setAmendSection(e.target.value)}
          />
          <label>Was</label>
          <input
            value={amendWas}
            onChange={(e) => setAmendWas(e.target.value)}
          />
          <label>Now</label>
          <input
            value={amendNow}
            onChange={(e) => setAmendNow(e.target.value)}
          />
          <label>By</label>
          <input value={amendBy} onChange={(e) => setAmendBy(e.target.value)} />
          <button
            onClick={() =>
              onAmend(amendSection, amendWas, amendNow, amendBy, "Amendment #1")
            }
          >
            Apply Amendment
          </button>
        </div>
      )}
    </aside>
  );
}
