/**
 * redaction.ts — legally remove content (FOIA / privacy / discovery).
 *
 * Unlike CSS "hide", redaction must DELETE the sensitive bytes so they can't be
 * recovered from the file. The flow, on the existing inline bracket-span:
 *   1. mark   — `[sensitive text]{redact: reason}` (the author marks what to remove)
 *   2. apply  — applyRedactions() strips the text and replaces it with a black-bar
 *               marker `[████]{redacted: reason; id: rN; commit: sha256:…}`. The
 *               original text is GONE from the output.
 *   3. seal   — seal the redacted document normally → tamper-evident (no one can
 *               un-redact or alter it without breaking the seal).
 *
 * Provable coverage (optional): each marker carries a COMMITMENT `sha256(salt|text)`
 * with a per-redaction random salt that is RETURNED to the caller (not stored in the
 * doc) as a receipt. Later, an auditor holding the original text + the receipt salt
 * can confirm a redaction covered exactly that text — without the doc ever revealing
 * it, and without being brute-forceable (the salt is secret). Verify with
 * verifyRedaction().
 *
 * String-based (no parser dependency). Renderer shows `redact:` (pending) marked and
 * `redacted:` as a black bar — see renderer.ts.
 */

import { sha256Hex } from "./sha256";

const SPAN_RE = /\[([^\]]*)\]\{([^}]*)\}/g;
const BAR = "████"; // ████

export interface PendingRedaction {
  /** The text that will be removed. */
  text: string;
  /** The stated reason / exemption code. */
  reason?: string;
}

/** A receipt the redactor archives to later PROVE what a marker covered. */
export interface RedactionReceipt {
  id: string;
  /** Secret salt (keep private) — needed, with the original text, to verify. */
  salt: string;
  /** The commitment stored in the document marker: sha256(salt|text). */
  commit: string;
  /** Length of the removed text (non-secret, useful for audit). */
  length: number;
}

export interface RedactionResult {
  /** The document with the sensitive text removed + black-bar markers. */
  source: string;
  /** One receipt per applied redaction (archive privately for proof of coverage). */
  receipts: RedactionReceipt[];
}

function spanProps(propStr: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const seg of propStr.split(";")) {
    const c = seg.indexOf(":");
    if (c > 0) {
      const k = seg.slice(0, c).trim().toLowerCase();
      if (k) out[k] = seg.slice(c + 1).trim();
    }
  }
  return out;
}

/** Portable random salt (hex). Uses WebCrypto, available in Node 19+ and browsers. */
function randomSalt(): string {
  const bytes = new Uint8Array(16);
  const g = globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => void } };
  if (g.crypto?.getRandomValues) {
    g.crypto.getRandomValues(bytes);
  } else {
    // Last-resort fallback (should not happen on supported runtimes): time-derived.
    const t = Date.now();
    for (let i = 0; i < bytes.length; i++) bytes[i] = (t >>> (i % 4) * 8) & 0xff;
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** True if the source has pending `redact:` marks (not yet applied). */
export function hasRedactions(source: string): boolean {
  if (!source) return false;
  SPAN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SPAN_RE.exec(source)) !== null) {
    if ("redact" in spanProps(m[2])) return true;
  }
  return false;
}

/** Pending redaction marks (the text that WILL be removed), in document order. */
export function extractRedactions(source: string): PendingRedaction[] {
  const out: PendingRedaction[] = [];
  if (!source) return out;
  SPAN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SPAN_RE.exec(source)) !== null) {
    const props = spanProps(m[2]);
    if ("redact" in props) out.push({ text: m[1], reason: props.redact || undefined });
  }
  return out;
}

/**
 * Apply every pending `[text]{redact: reason}` mark: remove the text, replace it
 * with a `[████]{redacted: reason | id: rN | commit: sha256:…}` marker. Irreversible
 * — the original text is not in the returned source. Returns the redacted source and
 * one receipt per redaction (archive privately for later proof).
 */
export function applyRedactions(source: string): RedactionResult {
  const receipts: RedactionReceipt[] = [];
  let n = 0;
  const out = source.replace(SPAN_RE, (whole, text: string, propStr: string) => {
    const props = spanProps(propStr);
    if (!("redact" in props)) return whole; // not a redaction mark
    n += 1;
    const id = `r${n}`;
    const salt = randomSalt();
    const commit = "sha256:" + sha256Hex(salt + "|" + text);
    receipts.push({ id, salt, commit, length: text.length });
    // Inline span props are semicolon-delimited and need a value each (bare flags
    // are skipped by the parser), so an empty reason becomes `redacted: yes`.
    const reason = props.redact ? props.redact : "yes";
    return `[${BAR}]{redacted: ${reason}; id: ${id}; commit: ${commit}}`;
  });
  return { source: out, receipts };
}

/**
 * Prove a redaction marker covered exactly `originalText`, using the receipt salt.
 * `commit` is the marker's `commit:` value (sha256(salt|text)).
 */
export function verifyRedaction(
  commit: string,
  originalText: string,
  salt: string,
): boolean {
  if (!commit || !salt) return false;
  return commit === "sha256:" + sha256Hex(salt + "|" + originalText);
}
