// TrustDialogs — native-feeling sheets for the trust lifecycle:
// sign / approve / seal (cryptographic, via @dotit/core) / verify.

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BadgeCheck, Lock, PenLine, ShieldCheck, X } from "lucide-react";
import type { VerifyResult } from "@dotit/core";
import * as trust from "../lib/trust";

export type TrustDialogKind = "sign" | "approve" | "seal" | "verify" | null;

function Dialog(props: {
  title: string;
  icon: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className="dialog-backdrop" onMouseDown={props.onClose}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <span className="dialog-title">
            {props.icon}
            {props.title}
          </span>
          <button className="icon-btn" onClick={props.onClose}>
            <X size={15} />
          </button>
        </div>
        <div className="dialog-body">{props.children}</div>
      </div>
    </div>
  );
}

export function TrustDialogs(props: {
  kind: TrustDialogKind;
  content: string;
  onApply: (next: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const { kind, content, onApply, onClose } = props;
  const [name, setName] = useState(
    () => localStorage.getItem("dotit.identity.name") ?? "",
  );
  const [role, setRole] = useState(
    () => localStorage.getItem("dotit.identity.role") ?? "",
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sealedHash, setSealedHash] = useState<string | null>(null);

  // Reset transient state whenever a dialog opens.
  useEffect(() => {
    setError(null);
    setSealedHash(null);
    setNote("");
  }, [kind]);

  const verifyResult: VerifyResult | null = useMemo(() => {
    if (kind !== "verify") return null;
    try {
      return trust.verify(content);
    } catch (err) {
      return {
        intact: false,
        frozen: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [kind, content]);

  if (!kind) return null;

  const rememberIdentity = () => {
    localStorage.setItem("dotit.identity.name", name.trim());
    localStorage.setItem("dotit.identity.role", role.trim());
  };

  const identityFields = (
    <>
      <label className="field">
        <span>Name</span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Smith"
        />
      </label>
      <label className="field">
        <span>Role (optional)</span>
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="CFO"
        />
      </label>
    </>
  );

  if (kind === "sign") {
    return (
      <Dialog title="Sign Document" icon={<PenLine size={16} />} onClose={onClose}>
        <p className="dialog-note">
          Adds a <code>sign:</code> block with today&apos;s date. Signing
          records intent — sealing makes the document tamper-evident.
        </p>
        {identityFields}
        {error && <div className="dialog-error">{error}</div>}
        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!name.trim()}
            onClick={async () => {
              rememberIdentity();
              await onApply(trust.addSignature(content, name.trim(), role));
              onClose();
            }}
          >
            Sign
          </button>
        </div>
      </Dialog>
    );
  }

  if (kind === "approve") {
    return (
      <Dialog
        title="Add Approval"
        icon={<BadgeCheck size={16} />}
        onClose={onClose}
      >
        <p className="dialog-note">
          Adds an <code>approve:</code> block recording a review decision.
        </p>
        {identityFields}
        <label className="field">
          <span>Note (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reviewed Q2 figures"
          />
        </label>
        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!name.trim()}
            onClick={async () => {
              rememberIdentity();
              await onApply(trust.addApproval(content, name.trim(), role, note));
              onClose();
            }}
          >
            Approve
          </button>
        </div>
      </Dialog>
    );
  }

  if (kind === "seal") {
    return (
      <Dialog title="Seal Document" icon={<Lock size={16} />} onClose={onClose}>
        {sealedHash ? (
          <>
            <p className="dialog-note ok">
              Document sealed. It is now read-only and tamper-evident.
            </p>
            <div className="hash-box">{sealedHash}</div>
            <div className="dialog-actions">
              <button className="btn primary" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="dialog-note">
              Sealing computes a content hash, signs it, and freezes the
              document. Further edits will fail verification.
            </p>
            {identityFields}
            {error && <div className="dialog-error">{error}</div>}
            <div className="dialog-actions">
              <button className="btn" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn primary"
                disabled={!name.trim()}
                onClick={async () => {
                  rememberIdentity();
                  try {
                    const result = trust.seal(content, name.trim(), role);
                    if (!result.success) {
                      setError(result.error ?? "Seal failed.");
                      return;
                    }
                    await onApply(result.source);
                    setSealedHash(result.hash);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : String(err));
                  }
                }}
              >
                Seal
              </button>
            </div>
          </>
        )}
      </Dialog>
    );
  }

  // verify
  return (
    <Dialog
      title="Verify Document"
      icon={<ShieldCheck size={16} />}
      onClose={onClose}
    >
      {verifyResult && (
        <>
          <div
            className={`verify-status ${
              verifyResult.frozen
                ? verifyResult.intact
                  ? "ok"
                  : "bad"
                : "neutral"
            }`}
          >
            {!verifyResult.frozen
              ? "Document is not sealed — nothing to verify against."
              : verifyResult.intact
                ? "Seal intact — content matches the sealed hash."
                : "TAMPERED — content does not match the sealed hash."}
          </div>
          {verifyResult.frozenAt && (
            <div className="verify-row">
              <span>Sealed at</span>
              <span>{verifyResult.frozenAt}</span>
            </div>
          )}
          {verifyResult.hash && (
            <div className="verify-row">
              <span>Hash</span>
              <span className="mono">{verifyResult.hash.slice(0, 24)}…</span>
            </div>
          )}
          {verifyResult.signers?.map((s, i) => (
            <div className="verify-row" key={i}>
              <span>
                {s.signer}
                {s.role ? ` (${s.role})` : ""}
              </span>
              <span className={s.valid ? "ok" : "bad"}>
                {s.valid ? "valid" : "invalid"}
                {s.signedCurrentVersion ? "" : " · earlier version"}
              </span>
            </div>
          ))}
          {verifyResult.error && (
            <div className="dialog-error">{verifyResult.error}</div>
          )}
          {verifyResult.warning && (
            <div className="dialog-note">{verifyResult.warning}</div>
          )}
        </>
      )}
      <div className="dialog-actions">
        <button className="btn primary" onClick={onClose}>
          Close
        </button>
      </div>
    </Dialog>
  );
}
