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
  renderHTML,
  verifyDocument,
  computeDocumentHash,
  type VerifyResult,
} from "@dotit/core";
import { DOCUMENT_CSS } from "@dotit/core/dist/document-css";
import {
  verifyDocumentSignatures,
  type FullVerifyResult,
  type SignatureCheck,
} from "@dotit/sign";

export { DOCUMENT_CSS };
export type { SignatureCheck };

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
): Verdict {
  // A sealed-but-modified document is the loudest failure.
  if (integrity.sealed && !integrity.intact) return "modified";

  // Any cryptographic signature that fails to verify is a hard fail.
  const cryptoSigs = signatures.signatures.filter((s) => s.cryptographic);
  if (cryptoSigs.length > 0 && !signatures.allSignaturesValid) return "invalid";

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

  // --- Preview (render) layer, via @dotit/core ---
  let previewHTML = "";
  let parseError: string | undefined;
  try {
    const doc = parseIntentText(source);
    previewHTML = renderHTML(doc);
  } catch (e) {
    parseError = (e as Error).message;
  }

  const verdict = computeVerdict(integrity, signatures);

  return {
    ok: !parseError,
    parseError,
    integrity,
    signatures,
    previewHTML,
    verdict,
  };
}
