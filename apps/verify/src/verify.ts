/**
 * verify.ts — the entire verification engine, run 100% in the browser.
 *
 * Nothing here makes a network call. The `.it` source string is handed to
 * @dotit/core (integrity / seal) and @dotit/sign (Ed25519 identity), both of
 * which compute hashes and verify signatures synchronously and offline. The
 * file the user drops never leaves the page.
 */
import {
  parseIntentText,
  renderPrint,
  verifyDocument,
  computeDocumentHash,
  renderSeal,
  isTemplate,
  type VerifyResult,
  type TrustTier,
} from "@dotit/core";

import {
  verifyDocumentSignatures,
  verifyCertifications,
  type FullVerifyResult,
  type SignatureCheck,
  type CertificationCheck,
} from "@dotit/sign";

import { trustedIssuers } from "./uts-trust";

export type { SignatureCheck, CertificationCheck };

export type Verdict = "verified" | "unsealed" | "modified" | "invalid";

export interface IntegrityResult {
  /** Document carries a freeze: seal (integrity is locked). */
  sealed: boolean;
  /** Hash matches the frozen hash → content intact. Only meaningful if sealed. */
  intact: boolean;
  /** sha256 of the current content (always computed). */
  hash: string;
  /** The hash recorded in the seal, if sealed. */
  frozenHash?: string;
  /** When the document was sealed, if sealed. */
  frozenAt?: string;
  /** Any error/warning surfaced by core's verifyDocument. */
  error?: string;
}

export interface VerifyReport {
  /** Did the source parse / verify at all? */
  ok: boolean;
  /**
   * True when the source is a TEMPLATE (.it blueprint) — outside the trust
   * workflow. There is nothing to verify; the UI short-circuits to a template
   * message instead of a pass/fail verdict.
   */
  template: boolean;
  parseError?: string;
  integrity: IntegrityResult;
  signatures: FullVerifyResult;
  /** One entry per `certify:` line, checked against trusted UTS key(s). */
  certifications: CertificationCheck[];
  /** Rendered, sandboxable HTML preview of the document. */
  previewHTML: string;
  /** The overall verdict for the top banner. */
  verdict: Verdict;
}

/**
 * The ambient seal for a VERIFIED report. Unlike core's sealForDocument (which
 * trusts the document's CLAIM), this reflects what actually verified here:
 *
 *   broken=true  — a present trust layer FAILED (modified seal / invalid signature
 *                  / tampered or untrusted certification). We do NOT paint such a
 *                  document blue/green/gold; the seal is gray "DRAFT", honest about
 *                  the fact that nothing here can be trusted.
 *   root-certified — a certification verified AND chains to the offline UTS root.
 *   certified      — a certification verified against a trusted UTS key (no chain).
 *   signed         — a seal is intact, or every cryptographic signature is valid.
 *   draft          — nothing to verify (unsealed, unsigned).
 *
 * The crown is always drawn from the live content hash, so a tampered document
 * also reads as a *different* seal than the original — visible tamper-evidence.
 */
export function verifiedSeal(report: VerifyReport): {
  svg: string;
  tier: TrustTier;
  broken: boolean;
} {
  const { integrity, signatures, certifications, verdict } = report;
  const validCert = certifications.find((c) => c.valid);
  const broken =
    verdict === "modified" ||
    verdict === "invalid" ||
    (integrity.sealed && !integrity.intact) ||
    certifications.some((c) => !c.signatureValid);

  let tier: TrustTier;
  let label: string | undefined;
  if (broken) {
    tier = "draft";
    label = "UNVERIFIED";
  } else if (validCert) {
    tier = validCert.chain ? "root-certified" : "certified";
  } else if (
    (integrity.sealed && integrity.intact) ||
    (signatures.validCount > 0 && signatures.allSignaturesValid)
  ) {
    tier = "signed";
    label = integrity.sealed ? "SEALED" : "SIGNED";
  } else {
    tier = "draft";
  }

  const svg = renderSeal({
    hash: integrity.hash || signatures.hash || "sha256:00000000",
    tier,
    label,
    size: 132,
  });
  return { svg, tier, broken };
}

/**
 * The slate, dashed TEMPLATE seal — rendered when the loaded source is a
 * blueprint. No hash crown, no trust tier: it visibly reads as "outside the
 * trust workflow", matching the seal core renders for `tier: "template"`.
 */
export function templateSeal(): string {
  return renderSeal({ hash: "sha256:00000000", tier: "template", size: 132 });
}

/** Truncate a long hex/base64 token for display: `abcd12…ef90`. */
export function truncateMiddle(s: string, head = 8, tail = 6): string {
  if (!s) return "";
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function computeVerdict(
  integrity: IntegrityResult,
  signatures: FullVerifyResult,
  certifications: CertificationCheck[],
): Verdict {
  // A sealed-but-modified document is the loudest failure.
  if (integrity.sealed && !integrity.intact) return "modified";

  // A certify: line whose signature doesn't match the current content means the
  // document was tampered with after UTS certified it — a hard fail.
  if (certifications.some((c) => !c.signatureValid)) return "invalid";

  // Any cryptographic signature that fails to verify is a hard fail.
  const cryptoSigs = signatures.signatures.filter((s) => s.cryptographic);
  if (cryptoSigs.length > 0 && !signatures.allSignaturesValid) return "invalid";

  // A trusted, valid UTS certification vouches for the content → verified.
  if (certifications.some((c) => c.valid)) return "verified";

  // Sealed and intact (and any sigs valid) → verified.
  if (integrity.sealed && integrity.intact) return "verified";

  // Not sealed, but every present signature is valid → still "verified"
  // (the signatures themselves vouch for the content).
  if (cryptoSigs.length > 0 && signatures.allSignaturesValid) return "verified";

  // No seal, no crypto signatures: integrity is simply not locked.
  return "unsealed";
}

/**
 * Run the full client-side verification pipeline over a raw `.it` source string.
 * Pure function, no I/O — safe to call on every keystroke or file drop.
 */
export function runVerification(source: string): VerifyReport {
  const hash = computeDocumentHash(source);

  // --- Integrity (seal) layer, via @dotit/core ---
  let coreResult: VerifyResult | undefined;
  let integrity: IntegrityResult;
  try {
    coreResult = verifyDocument(source);
    integrity = {
      sealed: coreResult.frozen,
      intact: coreResult.frozen ? coreResult.intact : true,
      hash: coreResult.hash ?? hash,
      frozenHash: coreResult.expectedHash,
      frozenAt: coreResult.frozenAt,
      error: coreResult.error,
    };
  } catch (e) {
    integrity = {
      sealed: false,
      intact: true,
      hash,
      error: (e as Error).message,
    };
  }

  // --- Signature (Ed25519) layer, via @dotit/sign ---
  let signatures: FullVerifyResult;
  try {
    signatures = verifyDocumentSignatures(source);
  } catch (e) {
    signatures = {
      hash,
      signatures: [],
      allSignaturesValid: false,
      validCount: 0,
    };
    integrity.error ??= (e as Error).message;
  }

  // --- Certification (UTS) layer, via @dotit/sign ---
  // trustedIssuers maps issuer → published public key (see uts-trust.ts). A
  // certify: line is only `trusted` if its embedded key matches.
  let certifications: CertificationCheck[];
  try {
    certifications = verifyCertifications(source, trustedIssuers);
  } catch (e) {
    certifications = [];
    integrity.error ??= (e as Error).message;
  }

  // --- Preview (render) layer, via @dotit/core ---
  let previewHTML = "";
  let parseError: string | undefined;
  try {
    const doc = parseIntentText(source);
    // BARE / "as signed" projection on the trust surface: styling (color, opacity,
    // size, bg, page/font/style rules) is the layer EXCLUDED from the content hash,
    // so rendering it here would let a post-seal restyle (opacity:0 / white-on-white)
    // hide content beside a green "intact" verdict. Bare strips all presentation —
    // the preview shows exactly what the seal actually covers and can never hide it.
    previewHTML = renderPrint(doc, { bare: true });
  } catch (e) {
    parseError = (e as Error).message;
  }

  const verdict = computeVerdict(integrity, signatures, certifications);

  return {
    ok: !parseError,
    template: isTemplate(source),
    parseError,
    integrity,
    signatures,
    certifications,
    previewHTML,
    verdict,
  };
}
