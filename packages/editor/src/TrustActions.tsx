// TrustActions — the trust action body (sign / seal / verify / unseal), shown
// inside the single trust control's popover (the TrustBanner chip). Extracted so
// there is ONE trust UI with all the functionality; the parent owns open/close.
//
// Every action calls a core API that is idempotent on the source string, so repeat
// clicks never corrupt the document. Rapid clicks are debounced.

import { useState, useRef, useEffect, useCallback } from "react";
import {
  signDocument,
  sealDocument,
  unsealDocument,
  verifyDocument,
  isSealed as coreIsSealed,
  isTemplate,
} from "@dotit/core";
import { ShieldCheck, PenTool, FileLock2, LockOpen } from "lucide-react";
import type { TrustState } from "./trust-state";
import { sourceToDoc, docToSource } from "./bridge";

// Seal/sign over the EXACT bytes the editor saves (normalize through the bridge
// first so an immediately-sealed doc verifies intact after later round-trips).
function normalizeSource(source: string): string {
  try {
    const round = docToSource(sourceToDoc(source));
    return round.trim() ? round : source;
  } catch {
    return source;
  }
}

const SIGNER_KEY = "dotit.editor.lastSigner";
const ROLE_KEY = "dotit.editor.lastRole";

export interface TrustActionsProps {
  content: string;
  onChange: (source: string) => void;
  trust: TrustState;
  intact: boolean | null;
  /** Called after an action closes the menu (parent collapses the popover). */
  onDone?: () => void;
}

export function TrustActions({
  content,
  onChange,
  trust,
  intact,
  onDone,
}: TrustActionsProps) {
  const [showHelp, setShowHelp] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signer, setSigner] = useState(
    () => localStorage.getItem(SIGNER_KEY) || "",
  );
  const [role, setRole] = useState(() => localStorage.getItem(ROLE_KEY) || "");
  const [busy, setBusy] = useState(false);
  const lastClickRef = useRef(0);

  const debounced = useCallback((fn: () => void) => {
    const now = Date.now();
    if (now - lastClickRef.current < 400) return;
    lastClickRef.current = now;
    fn();
  }, []);

  const sealed = trust.isSealed || coreIsSealed(content);
  const template = isTemplate(content);

  const [verifyResult, setVerifyResult] = useState<ReturnType<
    typeof verifyDocument
  > | null>(null);
  const doVerify = useCallback(() => {
    try {
      setVerifyResult(verifyDocument(content));
    } catch {
      setVerifyResult(null);
    }
  }, [content]);

  // Verify automatically when opened on a sealed document.
  useEffect(() => {
    if (sealed) doVerify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSign = useCallback(() => {
    const name = signer.trim();
    if (!name) return;
    setBusy(true);
    try {
      const base = normalizeSource(content);
      const res = signDocument(base, {
        signer: name,
        role: role.trim() || undefined,
      });
      if (res.source && res.source !== content) onChange(res.source);
      localStorage.setItem(SIGNER_KEY, name);
      if (role.trim()) localStorage.setItem(ROLE_KEY, role.trim());
    } finally {
      setBusy(false);
      setSigning(false);
      onDone?.();
    }
  }, [content, onChange, signer, role, onDone]);

  const doSeal = useCallback(() => {
    const name = signer.trim() || trust.signatures[0]?.by || "Document owner";
    setBusy(true);
    try {
      const res = sealDocument(normalizeSource(content), {
        signer: name,
        role: role.trim() || trust.signatures[0]?.role || undefined,
        skipSign: true,
      });
      if (res.source && res.source !== content && !res.error) {
        onChange(res.source);
      }
    } finally {
      setBusy(false);
      onDone?.();
    }
  }, [content, onChange, signer, role, trust.signatures, onDone]);

  const doUnseal = useCallback(() => {
    setBusy(true);
    try {
      const next = unsealDocument(content);
      if (typeof next === "string" && next !== content) onChange(next);
    } finally {
      setBusy(false);
      onDone?.();
    }
  }, [content, onChange, onDone]);

  return (
    <div className="trust-actions">
      {/* Current state line */}
      <div className="trust-popover__state">
        {template ? (
          <>
            <strong>📐 Template — not part of trust</strong>
            <div className="trust-popover__meta">
              A blueprint with fill-in slots, outside the trust workflow.
            </div>
            <div className="trust-popover__warn">
              Merge it with data to produce a signable document, then seal or sign
              the result.
            </div>
          </>
        ) : sealed ? (
          <>
            <strong>🔒 Sealed — read-only</strong>
            <div className="trust-popover__meta">
              {trust.sealedBy && <>by {trust.sealedBy}</>}
              {trust.sealedAt && <> on {trust.sealedAt}</>}
            </div>
          </>
        ) : trust.signatures.length > 0 ? (
          <>
            <strong>Signed · {trust.signatures.length}</strong>
            <div className="trust-popover__meta">
              {trust.signatures
                .map((sig) => (sig.role ? `${sig.by} (${sig.role})` : sig.by))
                .join(" · ")}
            </div>
            <div className="trust-popover__warn">
              ⚠ Still editable — editing will break {trust.signatures.length}{" "}
              signature{trust.signatures.length === 1 ? "" : "s"}. Seal to lock it.
            </div>
          </>
        ) : (
          <>
            <strong>Draft</strong>
            <div className="trust-popover__meta">Not signed or sealed yet.</div>
          </>
        )}
      </div>

      <button
        className="trust-popover__help-toggle"
        onClick={() => setShowHelp((h) => !h)}
      >
        (?) what does this mean
      </button>
      {showHelp && (
        <div className="trust-popover__help">
          <p>
            <b>Sign</b> adds your name to the document. It stays editable — but
            changing it afterwards invalidates the signatures.
          </p>
          <p>
            <b>Seal</b> freezes the document with a tamper-evident hash and makes
            it <b>read-only</b>. <b>Unseal</b> makes it editable again.
          </p>
          <p>
            <b>Verify</b> recomputes the hash and confirms the content still
            matches the seal.
          </p>
        </div>
      )}

      <div className="trust-popover__divider" />

      {template ? (
        <>
          <button
            className="trust-popover__action"
            disabled
            title="Templates can't be sealed — merge first."
          >
            <PenTool size={14} /> Sign
          </button>
          <button
            className="trust-popover__action trust-popover__action--primary"
            disabled
            title="Templates can't be sealed — merge first."
          >
            <FileLock2 size={14} /> Seal (freeze)
          </button>
        </>
      ) : sealed ? (
        <>
          <div className="trust-popover__verify">
            {verifyResult ? (
              verifyResult.intact ? (
                <span className="trust-verify--ok">
                  ✓ Verified — content matches the seal
                </span>
              ) : (
                <span className="trust-verify--bad">
                  ⚠ Hash mismatch — content changed after sealing
                </span>
              )
            ) : null}
            {verifyResult?.hash && (
              <details className="trust-popover__hash">
                <summary>Show hash</summary>
                <code>{verifyResult.hash}</code>
              </details>
            )}
          </div>
          <button
            className="trust-popover__action"
            onClick={() => debounced(doVerify)}
            disabled={busy}
          >
            <ShieldCheck size={14} /> Re-verify
          </button>
          <button
            className="trust-popover__action trust-popover__action--warn"
            onClick={() => debounced(doUnseal)}
            disabled={busy}
            title="Remove the freeze lock (keeps signatures) and make the document editable again"
          >
            <LockOpen size={14} /> Unseal (make editable)
          </button>
        </>
      ) : signing ? (
        <div className="trust-sign-form">
          <input
            className="trust-sign-input"
            placeholder="Your name"
            value={signer}
            autoFocus
            onChange={(e) => setSigner(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") doSign();
              if (e.key === "Escape") setSigning(false);
            }}
          />
          <input
            className="trust-sign-input"
            placeholder="Role (optional, e.g. CEO)"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") doSign();
              if (e.key === "Escape") setSigning(false);
            }}
          />
          <div className="trust-sign-actions">
            <button
              className="trust-popover__action trust-popover__action--primary"
              onClick={doSign}
              disabled={busy || !signer.trim()}
            >
              <PenTool size={14} /> Add signature
            </button>
            <button
              className="trust-popover__action"
              onClick={() => setSigning(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            className="trust-popover__action"
            onClick={() => setSigning(true)}
            disabled={busy}
            title="Add a signature line (does not freeze the document)"
          >
            <PenTool size={14} /> Sign
          </button>
          <button
            className="trust-popover__action trust-popover__action--primary"
            onClick={() => debounced(doSeal)}
            disabled={busy}
            title="Freeze the document with a tamper-evident hash. It becomes read-only until unsealed."
          >
            <FileLock2 size={14} /> Seal (freeze)
          </button>
        </>
      )}
    </div>
  );
}
