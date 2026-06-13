import { useMemo, useState } from "react";
import type { VerifyReport } from "./verify";
import { truncateMiddle, verifiedSeal } from "./verify";

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
    title: (r) => {
      const cert = r.certifications.find((c) => c.valid);
      if (cert) {
        const who = cert.entity
          ? `${cert.entity}${cert.account ? ` (${cert.account})` : ""}`
          : cert.account;
        return `Verified — UTS certified${who ? ` for ${who}` : ""}, content intact`;
      }
      return `Verified — content intact, ${r.signatures.validCount} signature${
        r.signatures.validCount === 1 ? "" : "s"
      } valid`;
    },
    sub: "This document's content has not changed since it was signed/sealed/certified.",
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
    title: (r) =>
      r.certifications.some((c) => !c.signatureValid)
        ? "Certification broken — content changed"
        : "Signature invalid",
    sub: "At least one cryptographic signature or UTS certification does not match the current content.",
  },
};

export function VerdictBanner({ report }: { report: VerifyReport }) {
  const c = VERDICT_COPY[report.verdict];
  // The Hash-Based Ambient Seal, tinted by the VERIFIED tier — not the document's
  // claim. A failed trust layer renders gray/"UNVERIFIED", never green or gold.
  const seal = useMemo(() => verifiedSeal(report), [report]);
  return (
    <div
      className={`verdict ${report.verdict}`}
      role="status"
      aria-live="polite"
    >
      <div
        className={`verdict-seal${seal.broken ? " broken" : ""}`}
        title={`Ambient seal · verified tier: ${seal.tier}`}
        aria-hidden
        dangerouslySetInnerHTML={{ __html: seal.svg }}
      />
      <span className="vicon" aria-hidden>
        {c.icon}
      </span>
      <span className="vtext">
        <span className="vtitle">{c.title(report)}</span>
        <span className="vsub">{c.sub}</span>
        <span className="vseal-note">
          {seal.broken
            ? "Seal shown gray — this document's trust layer did not verify."
            : "This seal is rendered live from the document's verified hash and tier."}
        </span>
      </span>
    </div>
  );
}

/**
 * Layer 3 — UTS Certified. Honest, layered states:
 *   - no certify: line at all → greyed "Not present" (the only muted state)
 *   - valid + trusted          → ✓ Certified (green): issuer, account, timestamp
 *   - signatureValid && !trusted → ⚠ signature valid but issuer key unrecognized
 *   - !signatureValid          → ✗ tampered: content changed after certification
 */
function CertifiedLayer({ report }: { report: VerifyReport }) {
  const certs = report.certifications;

  // No certify: line → the muted "not present" placeholder.
  if (certs.length === 0) {
    return (
      <section className="layer muted">
        <div className="layer-head">
          <span className="mark off" aria-hidden>
            ○
          </span>
          <span>UTS Certified</span>
          <span className="phase-tag">Phase 3</span>
        </div>
        <div className="layer-body">
          Not present. A UTS-signed certification would prove <em>when</em> this
          document existed and that it was certified under a known account.
        </div>
      </section>
    );
  }

  // Worst state across all certify: lines drives the header mark.
  const anyTampered = certs.some((c) => !c.signatureValid);
  const anyUntrusted = certs.some((c) => c.signatureValid && !c.trusted);
  const allValid = certs.every((c) => c.valid);
  const headMark = anyTampered ? "fail" : allValid ? "pass" : anyUntrusted ? "warn" : "fail";

  return (
    <section className="layer">
      <div className="layer-head">
        <span className={`mark ${headMark}`} aria-hidden>
          {headMark === "pass" ? "✓" : headMark === "warn" ? "⚠" : "✗"}
        </span>
        <span>UTS Certified</span>
        <span className="phase-tag">Phase 3</span>
      </div>
      <div className="layer-body">
        {certs.map((c, i) => {
          if (!c.signatureValid) {
            return (
              <div className="sig" key={i}>
                <span>
                  <span className="who">{c.issuer}</span>
                  {c.account ? (
                    <span className="meta"> · {c.account}</span>
                  ) : null}
                  <div className="pk">
                    content changed after certification
                  </div>
                </span>
                <span className="spacer" />
                <span
                  className="badge invalid"
                  title={c.reason ?? "Signature does not match current content"}
                >
                  ✗ Tampered
                </span>
              </div>
            );
          }
          if (!c.trusted) {
            return (
              <div className="sig" key={i}>
                <span>
                  <span className="who">{c.issuer}</span>
                  {c.account ? (
                    <span className="meta"> · {c.account}</span>
                  ) : null}
                  {c.at ? (
                    <span className="meta"> · {c.at.slice(0, 10)}</span>
                  ) : null}
                  {c.publicKey ? (
                    <div className="pk">
                      key ed25519:{truncateMiddle(c.publicKey, 8, 6)}
                    </div>
                  ) : null}
                </span>
                <span className="spacer" />
                <span
                  className="badge warn"
                  title="The signature is cryptographically valid, but this key is not a recognized UTS key."
                >
                  ⚠ Issuer key not recognized
                </span>
              </div>
            );
          }
          // valid + trusted. When the account is KYC-verified, `entity` is the
          // verified legal name (folded into the signature) — show it first.
          return (
            <div className="sig" key={i}>
              <span>
                <span className="who">{c.issuer}</span>
                {c.entity ? (
                  <span className="meta"> — {c.entity}</span>
                ) : null}
                {c.account ? (
                  <span className="meta">
                    {c.entity ? ` (${c.account})` : ` · account: ${c.account}`}
                  </span>
                ) : null}
                {c.at ? (
                  <span className="meta"> · {c.at.slice(0, 19).replace("T", " ")} UTC</span>
                ) : null}
                {c.publicKey ? (
                  <div className="pk">
                    key ed25519:{truncateMiddle(c.publicKey, 8, 6)}
                  </div>
                ) : null}
              </span>
              <span className="spacer" />
              <span className="badge valid">
                {c.entity ? "✓ Certified · identity verified" : "✓ Certified"}
              </span>
            </div>
          );
        })}
        {anyUntrusted && !anyTampered ? (
          <p style={{ margin: "8px 0 0" }}>
            The signature verifies, but the issuer key is not one this portal
            recognizes as UTS. A forged "UTS" line signed with a different key
            looks like this.
          </p>
        ) : null}
      </div>
    </section>
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

      {/* Layer 3 — UTS Certified */}
      <CertifiedLayer report={report} />

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
