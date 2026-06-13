import { useState } from "react";
import type { VerifyReport } from "./verify";
import { truncateMiddle } from "./verify";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="copybtn"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          },
          () => {},
        );
      }}
      aria-label="Copy full value to clipboard"
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}

const VERDICT_COPY: Record<
  VerifyReport["verdict"],
  { icon: string; title: (r: VerifyReport) => string; sub: string }
> = {
  verified: {
    icon: "✓",
    title: (r) =>
      `Verified — content intact, ${r.signatures.validCount} signature${
        r.signatures.validCount === 1 ? "" : "s"
      } valid`,
    sub: "This document's content has not changed since it was signed/sealed.",
  },
  unsealed: {
    icon: "⚠",
    title: () => "Unsealed document — integrity is not locked",
    sub: "No seal or signature is present, so this page cannot prove the content is unchanged.",
  },
  modified: {
    icon: "✗",
    title: () => "Modified since sealing",
    sub: "The current content does not match the hash recorded in the seal.",
  },
  invalid: {
    icon: "✗",
    title: () => "Signature invalid",
    sub: "At least one cryptographic signature does not match the current content.",
  },
};

export function VerdictBanner({ report }: { report: VerifyReport }) {
  const c = VERDICT_COPY[report.verdict];
  return (
    <div
      className={`verdict ${report.verdict}`}
      role="status"
      aria-live="polite"
    >
      <span className="vicon" aria-hidden>
        {c.icon}
      </span>
      <span className="vtext">
        <span className="vtitle">{c.title(report)}</span>
        <span className="vsub">{c.sub}</span>
      </span>
    </div>
  );
}

export function ResultCard({ report }: { report: VerifyReport }) {
  const { integrity, signatures } = report;
  const cryptoSigs = signatures.signatures.filter((s) => s.cryptographic);

  // Integrity mark
  let intMark = "warn";
  let intText = "Not sealed";
  if (integrity.sealed && integrity.intact) {
    intMark = "pass";
    intText = "Intact";
  } else if (integrity.sealed && !integrity.intact) {
    intMark = "fail";
    intText = "MODIFIED since sealing";
  }

  // Signatures mark
  let sigMark = "off";
  if (cryptoSigs.length > 0) {
    sigMark = signatures.allSignaturesValid ? "pass" : "fail";
  }

  return (
    <div className="card" aria-label="Verification result">
      {/* Layer 1 — Content Integrity */}
      <section className="layer">
        <div className="layer-head">
          <span className={`mark ${intMark}`} aria-hidden>
            {intMark === "pass" ? "✓" : intMark === "fail" ? "✗" : "⚠"}
          </span>
          <span>Content Integrity</span>
          <span className="phase-tag">Local seal</span>
        </div>
        <div className="layer-body">
          <div className="kv">
            <span className="k">Status</span>
            <span className="v" style={{ fontWeight: 600 }}>
              {intText}
              {integrity.sealed
                ? integrity.intact
                  ? " ✓"
                  : " ✗"
                : ""}
            </span>
          </div>
          {integrity.sealed && integrity.frozenAt && (
            <div className="kv">
              <span className="k">Sealed</span>
              <span className="v">{integrity.frozenAt}</span>
            </div>
          )}
          <div className="kv">
            <span className="k">sha256</span>
            <span className="v hashline">
              {truncateMiddle(integrity.hash, 10, 8)}
              <CopyButton value={integrity.hash} />
            </span>
          </div>
          {!integrity.sealed && (
            <p style={{ margin: "6px 0 0" }}>
              This document is not sealed, so there is no frozen hash to compare
              against. The hash above is computed live from the content you
              loaded.
            </p>
          )}
        </div>
      </section>

      {/* Layer 2 — Signatures (Ed25519) */}
      <section className="layer">
        <div className="layer-head">
          <span className={`mark ${sigMark}`} aria-hidden>
            {sigMark === "pass" ? "✓" : sigMark === "fail" ? "✗" : "—"}
          </span>
          <span>Signatures (Ed25519)</span>
          <span className="phase-tag">Phase 2</span>
        </div>
        <div className="layer-body">
          {signatures.signatures.length === 0 ? (
            <p style={{ margin: 0 }}>No signatures on this document.</p>
          ) : (
            <>
              <p style={{ margin: "0 0 6px" }}>
                {signatures.validCount} of {cryptoSigs.length} cryptographic
                signature
                {cryptoSigs.length === 1 ? "" : "s"} valid.
              </p>
              {signatures.signatures.map((s, i) => (
                <div className="sig" key={i}>
                  <span>
                    <span className="who">{s.signer}</span>
                    {s.role ? <span className="meta"> · {s.role}</span> : null}
                    {s.at ? (
                      <span className="meta">
                        {" "}
                        · {s.at.slice(0, 10)}
                      </span>
                    ) : null}
                    {s.cryptographic && s.publicKey ? (
                      <div className="pk">
                        key ed25519:{truncateMiddle(s.publicKey, 8, 6)}
                      </div>
                    ) : null}
                  </span>
                  <span className="spacer" />
                  {!s.cryptographic ? (
                    <span
                      className="badge neutral"
                      title="This line has no Ed25519 signature — it is a text approval only."
                    >
                      text approval
                    </span>
                  ) : s.valid ? (
                    <span className="badge valid">✓ Valid</span>
                  ) : (
                    <span
                      className="badge invalid"
                      title={s.reason ?? "Invalid"}
                    >
                      ✗ Invalid
                    </span>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </section>

      {/* Layer 3 — UTS Certified (placeholder) */}
      <section className="layer muted">
        <div className="layer-head">
          <span className="mark off" aria-hidden>
            ○
          </span>
          <span>UTS Certified</span>
          <span className="phase-tag">Phase 3</span>
        </div>
        <div className="layer-body">
          Not present. A UTS-signed timestamp would prove <em>when</em> this
          document existed and bind the signing key to a verified identity.
        </div>
      </section>

      {/* Layer 4 — Public Anchor (placeholder) */}
      <section className="layer muted">
        <div className="layer-head">
          <span className="mark off" aria-hidden>
            ○
          </span>
          <span>Public Anchor</span>
          <span className="phase-tag">Phase 4</span>
        </div>
        <div className="layer-body">
          Not present. An optional public-chain anchor would prove the document's
          existence is permanent and tamper-evident even to its issuer.
        </div>
      </section>
    </div>
  );
}
