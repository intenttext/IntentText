// trust-status.ts — ONE unified trust evaluator for the desktop app.
//
// Everything the UI needs to render the trust badge + trust panel comes from a
// single pure function, `evaluateTrust(source)`, run on the current `.it` source
// string. It folds together the three offline trust layers:
//
//   @dotit/core  verifyDocument        → integrity / seal  ("did the content change?")
//   @dotit/sign  verifyDocumentSignatures → Ed25519 identity ("who signed it?")
//   @dotit/sign  verifyCertifications  → UTS certification  ("who vouches for it?")
//
// and derives a single top-level `state` (+ label + tone) for the at-a-glance
// badge. The function is pure and synchronous, so it is safe to call on every
// render / keystroke — that is exactly how the badge stays live: editing a
// signed document recomputes here and flips the state to `signed-broken`.

import { verifyDocument, isSealed } from "@dotit/core";
import {
  verifyDocumentSignatures,
  verifyCertifications,
  type SignatureCheck,
  type CertificationCheck,
} from "@dotit/sign";

import { trustedIssuers } from "../uts-trust";

export type TrustState =
  | "draft"
  | "signed-valid"
  | "signed-broken"
  | "sealed-intact"
  | "sealed-modified";

export type TrustTone = "good" | "warn" | "bad" | "neutral";

export interface TrustStatus {
  /** Derived headline state for the badge. */
  state: TrustState;
  /** Short label for the badge, e.g. "Signed ✓ 2", "Modified ✗". */
  label: string;
  /** Color tone for the badge. */
  tone: TrustTone;
  /** A short glyph for the badge (lock / pen / star / open lock). */
  icon: string;
  /** One-line plain-language verdict for the top of the panel. */
  verdict: string;

  // ---- Content integrity (seal) layer ----
  sealed: boolean;
  /** Only meaningful when sealed. */
  intact: boolean;
  hash: string;
  frozenHash?: string;
  frozenAt?: string;

  // ---- Signature (Ed25519) layer ----
  signatures: SignatureCheck[];
  /** Number of cryptographic signatures present. */
  signatureCount: number;
  /** Number of cryptographic signatures that verify against current content. */
  validSignatureCount: number;
  /** true if there is ≥1 cryptographic signature and ALL of them verify. */
  allSignaturesValid: boolean;

  // ---- Certification (UTS) layer — additive on top of the headline ----
  certifications: CertificationCheck[];
  /** A valid, trusted UTS certification is present. */
  certified: boolean;
  /** Verified entity (or account) behind the valid certification, if any. */
  certifiedEntity?: string;

  /** Any error surfaced while evaluating. */
  error?: string;
}

/** Truncate a long hex/base64 token for display: `abcd12…ef90`. */
export function truncateMiddle(s: string, head = 8, tail = 6): string {
  if (!s) return "";
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

/**
 * Evaluate the full trust status of a `.it` source string.
 *
 * Pure + synchronous. The headline `state` rule:
 *   sealed?  → sealed-intact / sealed-modified   (the seal is the loudest layer)
 *   else has crypto signatures? → signed-valid / signed-broken
 *   else → draft
 * Certification is ADDITIVE (`certified` / `certifiedEntity`) and never replaces
 * the headline — but a certify: line whose signature no longer matches counts as
 * a broken trust layer and forces a bad tone.
 */
export function evaluateTrust(source: string): TrustStatus {
  let error: string | undefined;

  // ---- Integrity (seal) ----
  let sealed = false;
  let intact = true;
  let hash = "";
  let frozenHash: string | undefined;
  let frozenAt: string | undefined;
  try {
    const r = verifyDocument(source);
    sealed = r.frozen ?? isSealed(source);
    intact = sealed ? !!r.intact : true;
    hash = r.hash ?? "";
    frozenHash = r.expectedHash;
    frozenAt = r.frozenAt;
    if (r.error) error = r.error;
  } catch (e) {
    error = (e as Error).message;
    try {
      sealed = isSealed(source);
    } catch {
      /* ignore */
    }
  }

  // ---- Signatures (Ed25519) ----
  let signatures: SignatureCheck[] = [];
  let validSignatureCount = 0;
  let allSignaturesValid = false;
  try {
    const sig = verifyDocumentSignatures(source);
    signatures = sig.signatures;
    validSignatureCount = sig.validCount;
    allSignaturesValid = sig.allSignaturesValid;
    if (!hash) hash = sig.hash;
  } catch (e) {
    error ??= (e as Error).message;
  }
  const cryptoSigs = signatures.filter((s) => s.cryptographic);
  const signatureCount = cryptoSigs.length;

  // ---- Certification (UTS) ----
  let certifications: CertificationCheck[] = [];
  try {
    certifications = verifyCertifications(source, trustedIssuers);
  } catch (e) {
    error ??= (e as Error).message;
  }
  const validCert = certifications.find((c) => c.valid);
  const certified = !!validCert;
  const certifiedEntity = validCert?.entity || validCert?.account || undefined;
  const certBroken = certifications.some((c) => !c.signatureValid);

  // ---- Derive headline state ----
  let state: TrustState;
  let tone: TrustTone;
  let label: string;
  let icon: string;

  if (sealed) {
    if (intact) {
      state = "sealed-intact";
      tone = "good";
      label = "Sealed ✓";
      icon = "🔒";
    } else {
      state = "sealed-modified";
      tone = "bad";
      label = "Modified ✗";
      icon = "🔒";
    }
  } else if (signatureCount > 0) {
    if (allSignaturesValid) {
      state = "signed-valid";
      tone = "good";
      label = `Signed ✓ ${signatureCount}`;
      icon = "✍";
    } else {
      state = "signed-broken";
      tone = "bad";
      label = "Signature broken";
      icon = "✍";
    }
  } else {
    state = "draft";
    tone = "neutral";
    label = "Draft";
    icon = "🔓";
  }

  // A tampered certification is its own hard failure even if the headline layer
  // looks fine — never show a green badge over a broken certify: line.
  if (certBroken && tone !== "bad") {
    tone = "bad";
  }

  // ---- Plain-language verdict ----
  let verdict: string;
  if (state === "sealed-modified") {
    verdict =
      "⚠ This document was changed after it was sealed — it no longer matches the sealed copy.";
  } else if (state === "signed-broken") {
    verdict =
      "⚠ This document was changed after it was signed — the signature no longer matches.";
  } else if (certBroken) {
    verdict =
      "⚠ This document was changed after it was certified — the certification no longer matches.";
  } else if (state === "sealed-intact") {
    verdict = certified
      ? `This document is sealed, unchanged, and UTS certified${certifiedEntity ? ` for ${certifiedEntity}` : ""}.`
      : "This document is sealed and unchanged.";
  } else if (state === "signed-valid") {
    verdict = certified
      ? `Signed and UTS certified${certifiedEntity ? ` for ${certifiedEntity}` : ""} — content intact.`
      : `Signed — ${validSignatureCount} signature${validSignatureCount === 1 ? "" : "s"} verify against the current content.`;
  } else {
    verdict = "Draft — not signed or sealed yet.";
  }

  return {
    state,
    label,
    tone,
    icon,
    verdict,
    sealed,
    intact,
    hash,
    frozenHash,
    frozenAt,
    signatures,
    signatureCount,
    validSignatureCount,
    allSignaturesValid,
    certifications,
    certified,
    certifiedEntity,
    error,
  };
}
