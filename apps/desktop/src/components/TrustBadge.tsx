// TrustBadge — the always-visible, live trust indicator in the header, plus its
// click-through trust PANEL. Both render from a single `TrustStatus` computed by
// evaluateTrust() on the CURRENT document content, so the badge updates the
// instant the content changes (editing a signed doc flips it to red "Signature
// broken" with no dialog). The panel mirrors the verify portal's layered,
// honest breakdown: Content Integrity, Signatures, UTS Certified.

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import type { TrustStatus } from "../lib/trust-status";
import { truncateMiddle } from "../lib/trust-status";

function Mark({ kind }: { kind: "pass" | "fail" | "warn" | "off" }) {
  const ch =
    kind === "pass" ? "✓" : kind === "fail" ? "✗" : kind === "warn" ? "⚠" : "—";
  return (
    <span className={`tp-mark ${kind}`} aria-hidden>
      {ch}
    </span>
  );
}

/** Layer 1 — Content Integrity (seal). */
function IntegrityLayer({ status }: { status: TrustStatus }) {
  let mark: "pass" | "fail" | "warn" = "warn";
  let text = "Not sealed";
  if (status.sealed && status.intact) {
    mark = "pass";
    text = "Sealed — intact ✓";
  } else if (status.sealed && !status.intact) {
    mark = "fail";
    text = "Modified after sealing ✗";
  }
  return (
    <section className="tp-layer">
      <div className="tp-layer-head">
        <Mark kind={mark} />
        <span>Content Integrity</span>
      </div>
      <div className="tp-layer-body">
        <div className="tp-kv">
          <span className="tp-k">Status</span>
          <span className="tp-v strong">{text}</span>
        </div>
        {status.sealed && status.frozenAt && (
          <div className="tp-kv">
            <span className="tp-k">Sealed</span>
            <span className="tp-v">{status.frozenAt}</span>
          </div>
        )}
        {status.hash && (
          <div className="tp-kv">
            <span className="tp-k">sha256</span>
            <span className="tp-v mono">{truncateMiddle(status.hash, 10, 8)}</span>
          </div>
        )}
        {!status.sealed && (
          <p className="tp-note">
            Not sealed — there is no frozen hash to compare against. The hash
            above is computed live from the current content.
          </p>
        )}
      </div>
    </section>
  );
}

/** Layer 2 — Signatures (Ed25519). */
function SignatureLayer({ status }: { status: TrustStatus }) {
  const crypto = status.signatures.filter((s) => s.cryptographic);
  let mark: "pass" | "fail" | "off" = "off";
  if (crypto.length > 0) mark = status.allSignaturesValid ? "pass" : "fail";
  return (
    <section className="tp-layer">
      <div className="tp-layer-head">
        <Mark kind={mark} />
        <span>Signatures</span>
      </div>
      <div className="tp-layer-body">
        {status.signatures.length === 0 ? (
          <p className="tp-note">No signatures on this document.</p>
        ) : (
          <>
            <p className="tp-note">
              {status.validSignatureCount} of {crypto.length} cryptographic
              signature{crypto.length === 1 ? "" : "s"} valid.
            </p>
            {status.signatures.map((s, i) => (
              <div className="tp-sig" key={i}>
                <span className="tp-sig-who">
                  <span className="who">{s.signer}</span>
                  {s.role ? <span className="meta"> · {s.role}</span> : null}
                  {s.at ? <span className="meta"> · {s.at.slice(0, 10)}</span> : null}
                  {s.cryptographic && s.publicKey ? (
                    <span className="pk">key {truncateMiddle(s.publicKey, 8, 6)}</span>
                  ) : null}
                </span>
                {!s.cryptographic ? (
                  <span
                    className="tp-badge neutral"
                    title="No Ed25519 signature — a text approval only."
                  >
                    text approval
                  </span>
                ) : s.valid ? (
                  <span className="tp-badge valid">✓ Valid</span>
                ) : (
                  <span className="tp-badge invalid" title={s.reason ?? "Invalid"}>
                    ✗ Broken
                  </span>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}

/** Layer 3 — UTS Certified. */
function CertifiedLayer({ status }: { status: TrustStatus }) {
  const certs = status.certifications;
  if (certs.length === 0) {
    return (
      <section className="tp-layer muted">
        <div className="tp-layer-head">
          <Mark kind="off" />
          <span>UTS Certified</span>
        </div>
        <div className="tp-layer-body">
          <p className="tp-note">Not certified.</p>
        </div>
      </section>
    );
  }
  const anyTampered = certs.some((c) => !c.signatureValid);
  const anyUntrusted = certs.some((c) => c.signatureValid && !c.trusted);
  const allValid = certs.every((c) => c.valid);
  const head: "pass" | "fail" | "warn" = anyTampered
    ? "fail"
    : allValid
      ? "pass"
      : anyUntrusted
        ? "warn"
        : "fail";
  return (
    <section className="tp-layer">
      <div className="tp-layer-head">
        <Mark kind={head} />
        <span>UTS Certified</span>
      </div>
      <div className="tp-layer-body">
        {certs.map((c, i) => {
          if (!c.signatureValid) {
            return (
              <div className="tp-sig" key={i}>
                <span className="tp-sig-who">
                  <span className="who">{c.issuer}</span>
                  {c.account ? <span className="meta"> · {c.account}</span> : null}
                  <span className="pk">content changed after certification</span>
                </span>
                <span className="tp-badge invalid" title={c.reason ?? "Tampered"}>
                  ✗ Tampered
                </span>
              </div>
            );
          }
          if (!c.trusted) {
            return (
              <div className="tp-sig" key={i}>
                <span className="tp-sig-who">
                  <span className="who">{c.issuer}</span>
                  {c.account ? <span className="meta"> · {c.account}</span> : null}
                  {c.publicKey ? (
                    <span className="pk">key {truncateMiddle(c.publicKey, 8, 6)}</span>
                  ) : null}
                </span>
                <span
                  className="tp-badge warn"
                  title="Signature valid, but this key is not a recognized UTS key."
                >
                  ⚠ Key not recognized
                </span>
              </div>
            );
          }
          return (
            <div className="tp-sig" key={i}>
              <span className="tp-sig-who">
                <span className="who">{c.issuer}</span>
                {c.entity ? <span className="meta"> — {c.entity}</span> : null}
                {c.account ? (
                  <span className="meta">
                    {c.entity ? ` (${c.account})` : ` · ${c.account}`}
                  </span>
                ) : null}
                {c.at ? (
                  <span className="meta">
                    {" "}
                    · {c.at.slice(0, 19).replace("T", " ")} UTC
                  </span>
                ) : null}
                {c.publicKey ? (
                  <span className="pk">key {truncateMiddle(c.publicKey, 8, 6)}</span>
                ) : null}
              </span>
              <span className="tp-badge valid">
                {c.entity ? "✓ Certified · identity verified" : "✓ Certified"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function TrustPanel({
  status,
  onClose,
}: {
  status: TrustStatus;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    // Defer click listener so the opening click doesn't immediately close it.
    const t = setTimeout(() => document.addEventListener("mousedown", onClick), 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
      document.removeEventListener("mousedown", onClick);
    };
  }, [onClose]);

  return (
    <div className="trust-panel" ref={ref} role="dialog" aria-label="Trust status">
      <div className="tp-head">
        <span className="tp-head-title">
          <ShieldCheck size={15} /> Trust status
        </span>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>
      </div>
      <div className={`tp-verdict ${status.tone}`} role="status">
        {status.verdict}
      </div>
      <div className="tp-layers">
        <IntegrityLayer status={status} />
        <SignatureLayer status={status} />
        <CertifiedLayer status={status} />
      </div>
      {status.error && <div className="tp-error">{status.error}</div>}
    </div>
  );
}

/**
 * The header badge. Always visible while a doc is open, recomputed from the
 * live `status` on every render. Click toggles the panel.
 */
export function TrustBadge({
  status,
  open,
  onToggle,
}: {
  status: TrustStatus;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className={`trust-badge tone-${status.tone}${open ? " open" : ""}`}
      onClick={onToggle}
      title="Trust status — click for details"
      aria-expanded={open}
    >
      <span className="tb-icon" aria-hidden>
        {status.icon}
      </span>
      <span className="tb-label">{status.label}</span>
      {status.certified && (
        <span className="tb-cert" title={`UTS Certified${status.certifiedEntity ? ` — ${status.certifiedEntity}` : ""}`}>
          ★ Certified
        </span>
      )}
    </button>
  );
}

// Re-export the standalone popover wrapper used by App: badge + panel together.
export function TrustWidget({ status }: { status: TrustStatus }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="trust-widget">
      <TrustBadge status={status} open={open} onToggle={() => setOpen((v) => !v)} />
      {open && <TrustPanel status={status} onClose={() => setOpen(false)} />}
    </div>
  );
}
