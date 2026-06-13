// TrustControl — the single, self-explanatory trust menu in the ribbon.
//
// One button shows the document's current STATE; clicking opens a small popover
// with exactly the actions that make sense for that state:
//
//   Draft        →  [Sign]  [Seal]
//   Signed by N  →  [Sign]  [Seal]   (lists who signed)
//   🔒 Sealed    →  [Verify]  [Unseal]   (verified ✓, hash on expand)
//
// Every action calls a core 1.2.0 API that is idempotent on the source string,
// so repeat clicks never corrupt the document. Rapid clicks are debounced.

import { useState, useRef, useEffect, useCallback } from "react";
import {
  signDocument,
  sealDocument,
  unsealDocument,
  verifyDocument,
  isSealed as coreIsSealed,
} from "@dotit/core";
import { ShieldCheck, PenTool, FileLock2, LockOpen, ChevronDown } from "lucide-react";
import type { TrustState } from "./trust-state";
import { sourceToDoc, docToSource } from "./bridge";

// Seal/sign over the EXACT bytes the editor saves. The visual editor serializes
// through the bridge on every edit (docToSource), so we normalize first — that
// way the hash covers the canonical form and an immediately-sealed document
// verifies intact even after later round-trips (e.g. blank-line collapsing).
function normalizeSource(source: string): string {
  try {
    const round = docToSource(sourceToDoc(source));
    // Only adopt the normalized form when it's parseable & non-empty — never
    // risk losing content to a bridge edge case.
    return round.trim() ? round : source;
  } catch {
    return source;
  }
}

interface Props {
  /** Current .it source. */
  content: string;
  /** Apply a new source produced by a trust action. */
  onChange: (source: string) => void;
  /** Trust snapshot (drives the button label + which actions show). */
  trust: TrustState;
  /** verifyDocument().intact — null when not sealed. */
  intact: boolean | null;
}

const SIGNER_KEY = "dotit.editor.lastSigner";
const ROLE_KEY = "dotit.editor.lastRole";

export function TrustControl({ content, onChange, trust, intact }: Props) {
  const [open, setOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signer, setSigner] = useState(
    () => localStorage.getItem(SIGNER_KEY) || "",
  );
  const [role, setRole] = useState(() => localStorage.getItem(ROLE_KEY) || "");
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const lastClickRef = useRef(0);

  // Debounce: ignore a second click within 400ms (the core APIs are already
  // idempotent — this just stops the UI flicker from frantic double-clicks).
  const debounced = useCallback((fn: () => void) => {
    const now = Date.now();
    if (now - lastClickRef.current < 400) return;
    lastClickRef.current = now;
    fn();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSigning(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const sealed = trust.isSealed || coreIsSealed(content);

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
      // Idempotent: res.note === "already-signed" → source unchanged, no spam.
      if (res.source && res.source !== content) onChange(res.source);
      localStorage.setItem(SIGNER_KEY, name);
      if (role.trim()) localStorage.setItem(ROLE_KEY, role.trim());
    } finally {
      setBusy(false);
      setSigning(false);
      setOpen(false);
    }
  }, [content, onChange, signer, role]);

  const doSeal = useCallback(() => {
    const name =
      signer.trim() || trust.signatures[0]?.by || "Document owner";
    setBusy(true);
    try {
      // Sealing must NEVER add a signature — signing is a separate explicit
      // action. We pass skipSign:true so Seal only writes the freeze: line over
      // the exact current bytes. (Without it, core appends a `sign:` line for
      // `name`, duplicating the signature of someone who already signed.)
      const res = sealDocument(normalizeSource(content), {
        signer: name,
        role: role.trim() || trust.signatures[0]?.role || undefined,
        skipSign: true,
      });
      // Idempotent: error "already-sealed" → leave source as-is.
      if (res.source && res.source !== content && !res.error) {
        onChange(res.source);
      }
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }, [content, onChange, signer, role, trust.signatures]);

  const doUnseal = useCallback(() => {
    setBusy(true);
    try {
      // unsealDocument returns the new source string directly.
      const next = unsealDocument(content);
      if (typeof next === "string" && next !== content) onChange(next);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }, [content, onChange]);

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

  // ── Button face: state at a glance ──────────────────────────
  let faceIcon = <PenTool size={15} />;
  let faceLabel = "Draft";
  let faceClass = "trust-face--draft";
  if (sealed) {
    faceIcon = <FileLock2 size={15} />;
    faceLabel = intact === false ? "Sealed · changed!" : "Sealed";
    faceClass =
      intact === false ? "trust-face--broken" : "trust-face--sealed";
  } else if (trust.signatures.length > 0) {
    faceIcon = <ShieldCheck size={15} />;
    faceLabel = `Signed · ${trust.signatures.length}`;
    faceClass = "trust-face--signed";
  }

  return (
    <div className="trust-control" ref={rootRef}>
      <button
        className={`docs-tb-btn trust-face ${faceClass}`}
        onClick={() => {
          setOpen((o) => !o);
          setSigning(false);
          if (sealed) doVerify();
        }}
        title="Document trust — sign, seal, verify"
      >
        <span className="trust-face__icon">{faceIcon}</span>
        <span className="ribbon-btn-text">{faceLabel}</span>
        {sealed && intact === true && (
          <span className="trust-face__ok" title="Hash verified">
            ✓
          </span>
        )}
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className="trust-popover">
          {/* Current state line */}
          <div className="trust-popover__state">
            {sealed ? (
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
                    .map((s) => (s.role ? `${s.by} (${s.role})` : s.by))
                    .join(" · ")}
                </div>
                <div className="trust-popover__warn">
                  ⚠ Still editable — editing will break{" "}
                  {trust.signatures.length} signature
                  {trust.signatures.length === 1 ? "" : "s"}. Seal to lock it.
                </div>
              </>
            ) : (
              <>
                <strong>Draft</strong>
                <div className="trust-popover__meta">
                  Not signed or sealed yet.
                </div>
              </>
            )}
          </div>

          {/* Plain-words explainer + (?) help toggle */}
          <button
            className="trust-popover__help-toggle"
            onClick={() => setShowHelp((h) => !h)}
          >
            (?) what does this mean
          </button>
          {showHelp && (
            <div className="trust-popover__help">
              <p>
                <b>Sign</b> adds your name to the document. It stays editable —
                but changing it afterwards invalidates the signatures.
              </p>
              <p>
                <b>Seal</b> freezes the document with a tamper-evident hash and
                makes it <b>read-only</b>. <b>Unseal</b> makes it editable again.
              </p>
              <p>
                <b>Verify</b> recomputes the hash and confirms the content still
                matches the seal.
              </p>
            </div>
          )}

          <div className="trust-popover__divider" />

          {/* Actions for the current state */}
          {sealed ? (
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
      )}
    </div>
  );
}
