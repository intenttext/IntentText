/**
 * audit-chain.ts — a tamper-evident, hash-CHAINED audit trail in the document.
 *
 * The seal already proves the document body is intact, and each signature carries
 * the body hash. This adds the missing guarantee: the SEQUENCE of approvals is
 * itself tamper-evident — you cannot insert, delete, or reorder an approval
 * without detection, even before the document is sealed.
 *
 * Each chained approval carries `prev: sha256:…`, the hash of the immediately
 * preceding audit event (or, for the first link, the document body hash). The
 * chain therefore anchors to the content AND to every prior step, so any edit to
 * the trail breaks it. `verifyAuditChain(source)` recomputes and reports the
 * first broken link.
 *
 * Additive + safe: this does not touch signDocument/sealDocument. Approvals added
 * with `appendApproval` are chained; a plain `approve:` line is simply an
 * un-chained link (verifyAuditChain reports it as such, never as tampered).
 */

import { sha256Hex } from "./sha256";
import { findHistoryBoundaryInSource } from "./trust";

export type AuditKind = "approve" | "sign" | "freeze" | "amendment" | "revision";

export interface AuditEvent {
  kind: AuditKind;
  /** The full source line, verbatim. */
  line: string;
  /** The `prev:` hash carried by this line, if any. */
  prev?: string;
}

const KIND_PREFIX: Record<string, AuditKind> = {
  "approve:": "approve",
  "sign:": "sign",
  "freeze:": "freeze",
  "amendment:": "amendment",
  "revision:": "revision",
};

/** The canonical bytes a `prev:` hash covers: the line WITHOUT its own prev:
 *  segment, trimmed and NFC-normalized (matching the document-hash convention). */
function canonicalEvent(line: string): string {
  return line
    .replace(/\s*\|\s*prev:\s*[^|]*$/i, "")
    .replace(/\s*\|\s*prev:\s*[^|]*(?=\s*\|)/i, "")
    .trim()
    .normalize("NFC");
}

/** Hash of an audit event, as referenced by the next link's `prev:`. */
export function eventHash(line: string): string {
  return "sha256:" + sha256Hex(canonicalEvent(line));
}

/**
 * Stable content anchor for the chain's first link. Unlike the document hash,
 * this strips ALL audit-event lines (approve: included), so appending another
 * approval never moves the anchor — the chain stays verifiable as it grows.
 */
function auditGenesis(source: string): string {
  const boundary = findHistoryBoundaryInSource(source);
  const content = boundary === -1 ? source : source.slice(0, boundary);
  const body = content
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !(
        t.startsWith("approve:") ||
        t.startsWith("sign:") ||
        t.startsWith("freeze:") ||
        t.startsWith("certify:") ||
        t.startsWith("amendment:")
      );
    })
    .join("\n")
    .trim()
    .normalize("NFC");
  return "sha256:" + sha256Hex(body);
}

function readPrev(line: string): string | undefined {
  const m = /\|\s*prev:\s*(sha256:[0-9a-f]+)/i.exec(line);
  return m ? m[1] : undefined;
}

/** Extract the ordered audit events (across the body and the history section). */
export function auditTrail(source: string): AuditEvent[] {
  const events: AuditEvent[] = [];
  for (const raw of source.split("\n")) {
    const t = raw.trimStart();
    for (const [prefix, kind] of Object.entries(KIND_PREFIX)) {
      if (t.startsWith(prefix)) {
        events.push({ kind, line: raw, prev: readPrev(raw) });
        break;
      }
    }
  }
  return events;
}

export interface AuditChainResult {
  /** True if every chained link (those carrying prev:) matches its predecessor. */
  valid: boolean;
  /** Total audit events found. */
  length: number;
  /** How many events carry a prev: link. */
  chained: number;
  /** Index of the first broken link, if any. */
  brokenAt?: number;
  reason?: string;
}

/**
 * Verify the hash-chain over the document's audit trail. A link is checked only
 * when it carries `prev:`; a present prev: that does not match the hash of the
 * preceding event (or the body, for the first link) is a tampered trail.
 */
export function verifyAuditChain(source: string): AuditChainResult {
  const events = auditTrail(source);
  const genesis = auditGenesis(source); // body anchor
  let chained = 0;
  for (let i = 0; i < events.length; i++) {
    const prev = events[i].prev;
    if (prev == null) continue; // un-chained legacy link — not a failure
    chained++;
    const expected = i === 0 ? genesis : eventHash(events[i - 1].line);
    if (prev !== expected) {
      return {
        valid: false,
        length: events.length,
        chained,
        brokenAt: i,
        reason: `audit link ${i} (${events[i].kind}) expected prev ${expected.slice(0, 18)}… but found ${prev.slice(0, 18)}…`,
      };
    }
  }
  return { valid: true, length: events.length, chained };
}

export interface AppendApprovalOptions {
  by: string;
  role?: string;
  /** The approval note (block content). Defaults to "Approved". */
  note?: string;
  /** ISO timestamp; defaults to now. */
  at?: string;
}

/**
 * Append a hash-CHAINED approval to the document. The new `approve:` line carries
 * `prev:` = the hash of the last audit event (or the body hash, if none), so the
 * approval sequence becomes tamper-evident. Use BEFORE sealing (approve: is part
 * of the hashed body). Pairs with workflowState(), which reads role/by.
 */
export function appendApproval(
  source: string,
  options: AppendApprovalOptions,
): string {
  const at = options.at ?? new Date().toISOString();
  const note = options.note ?? "Approved";
  const events = auditTrail(source);
  const prev =
    events.length === 0
      ? auditGenesis(source)
      : eventHash(events[events.length - 1].line);

  const line =
    `approve: ${note} | by: ${options.by}` +
    (options.role ? ` | role: ${options.role}` : "") +
    ` | at: ${at} | prev: ${prev}`;

  // Insert above freeze: (keep with the seal) else above history: else at end —
  // mirroring signDocument's placement.
  const lines = source.replace(/\n+$/, "").split("\n");
  const freezeIdx = lines.findIndex((l) => l.trimStart().startsWith("freeze:"));
  const histPos = findHistoryBoundaryInSource(source);
  const histIdx =
    histPos === -1
      ? -1
      : lines.findIndex((l) => l.trim() === "history:" || l.trim() === "history");
  const insertAt =
    freezeIdx !== -1 ? freezeIdx : histIdx !== -1 ? histIdx : lines.length;
  lines.splice(insertAt, 0, line);
  return lines.join("\n") + "\n";
}
