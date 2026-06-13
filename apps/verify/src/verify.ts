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
  type VerifyResult,
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
    previewHTML = renderPrint(doc);
  } catch (e) {
    parseError = (e as Error).message;
  }

  const verdict = computeVerdict(integrity, signatures, certifications);

  return {
    ok: !parseError,
    parseError,
    integrity,
    signatures,
    certifications,
    previewHTML,
    verdict,
  };
}
