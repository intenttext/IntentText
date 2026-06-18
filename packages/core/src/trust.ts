import { sha256Hex, randomHex } from "./sha256";
import { IntentDocument, RegistryEntry } from "./types";
import { parseIntentText } from "./parser";
import { assertNotTemplate } from "./template";
import { ALIAS_MAP } from "./language-registry";

// ─── Hash Computation ───────────────────────────────────────────────────────

/**
 * What the hash COVERS. Two scopes (spec ≥ 2):
 *  - "content" — the document body only. Used for each `sign:` line's hash, so
 *    co-signers all commit to the SAME content (signatures don't affect it).
 *  - "seal" — the body PLUS the trust record (signatures + the freeze metadata).
 *    Used for the `freeze:` hash, so tampering the content OR a signature OR the
 *    seal's own metadata breaks the seal.
 * Comments (`//`) are excluded from both. Spec 3 also excludes presentation
 * (styling) — see canonicalContent / PRESENTATION_* below.
 */
export type HashScope = "content" | "seal";

// Spec 3: STYLING is presentation, not signed content (the "sign content, not
// presentation" rule). Whole presentation LINES and presentation PROPERTIES on
// content lines are stripped before hashing, so restyling never breaks a seal.
// Mirrors the source panel's "styling (ignored)" classification exactly.
const PRESENTATION_LINE_KEYWORDS = new Set(["page", "font", "style"]);
const PRESENTATION_PROPS = new Set([
  "color",
  "size",
  "family",
  "align",
  "bg",
  "indent",
  "leading",
  "space-before",
  "space-after",
  "opacity",
  "border",
  "valign",
  "theme",
  "margin",
  "margins",
  "orientation",
  "width",
  "height",
]);

/** Canonical leading keyword of a line ("page", "text", …), or "" for bare text. */
function leadKeyword(trimmed: string): string {
  const m = trimmed.match(/^([A-Za-z][\w-]*)\s*:/);
  if (!m) return "";
  const k = m[1].toLowerCase();
  return ALIAS_MAP[k] ?? k;
}

/** Drop presentation `| key: value` segments from a content line (keep content). */
function stripPresentationProps(line: string): string {
  if (!line.includes("|")) return line;
  const parts = line.split("|");
  const kept = parts.filter((seg, i) => {
    if (i === 0) return true; // the keyword + content segment
    const m = seg.match(/^\s*([A-Za-z][\w-]*)\s*:/);
    return !(m && PRESENTATION_PROPS.has(m[1].toLowerCase()));
  });
  return kept.join("|").replace(/\s+$/, "");
}

/** Neutralize a freeze line's self-referential `hash:` value (it can't hash itself)
 *  while KEEPING its other metadata (at/status/spec) in the hashed input. Normalizes
 *  to a constant `hash:` so a filled and an empty-placeholder freeze hash to the same
 *  bytes (seal-time builds it empty; verify-time sees it filled). */
function stripFreezeHashValue(line: string): string {
  return line.replace(/\bhash:\s*[^|\n]*/i, "hash:").replace(/\s+$/, "");
}

/**
 * Extract the canonical hashed body for a given spec + scope.
 *
 * v0/v1 (FROZEN — historical seals): the seal/authority lines are removed and
 * comments are KEPT; both scopes are identical. NEVER change this branch.
 *
 * v2 (FROZEN): comments excluded; the seal scope keeps `sign:` lines while the
 * content scope drops them.
 *
 * v3: also excludes STYLING (presentation lines + presentation props) — restyling
 * never breaks a seal; AND the seal scope covers the freeze line's own metadata
 * (at/status/spec, minus its self-referential hash) so seal-metadata tampering breaks.
 */
function hashedBody(
  source: string,
  spec: number = SEAL_SPEC,
  scope: HashScope = "content",
): string {
  const boundary = findHistoryBoundaryInSource(source);
  const content = boundary === -1 ? source : source.slice(0, boundary);
  const lines = content.split("\n");

  if (spec >= 3) {
    const out: string[] = [];
    for (const line of lines) {
      const t = line.trimStart();
      if (t.startsWith("//")) continue; // comments never affect the hash
      const kw = leadKeyword(t);
      if (PRESENTATION_LINE_KEYWORDS.has(kw)) continue; // styling line — excluded
      if (kw === "freeze") {
        // The seal covers its own metadata (minus the hash it carries); content
        // scope (a signature) never includes the freeze.
        if (scope === "seal") out.push(stripFreezeHashValue(line));
        continue;
      }
      if (kw === "certify" || kw === "amendment") continue; // authority / post-seal
      if (kw === "sign") {
        if (scope === "content") continue; // a signature commits to content only
        out.push(line); // seal scope: the whole signature line (identity + hash)
        continue;
      }
      out.push(stripPresentationProps(line)); // content line — drop styling props
    }
    return out.join("\n").trim();
  }

  const bodyLines =
    spec >= 2
      ? lines.filter((line) => {
          const t = line.trimStart();
          if (t.startsWith("//")) return false; // comments never affect the hash
          if (
            t.startsWith("freeze:") ||
            t.startsWith("certify:") ||
            t.startsWith("amendment:")
          )
            return false;
          if (scope === "content" && t.startsWith("sign:")) return false;
          return true;
        })
      : lines.filter(
          (line) =>
            !line.startsWith("sign:") &&
            !line.startsWith("freeze:") &&
            !line.startsWith("certify:") &&
            !line.startsWith("amendment:"),
        );
  return bodyLines.join("\n").trim();
}

/**
 * Canonicalization SPEC version stamped into every new seal/signature (the `spec:`
 * field on freeze:/sign:). The seal records WHICH byte-rules produced its hash, so
 * verification applies exactly those rules FOREVER — a future change to the
 * canonicalization can never silently break a historical seal. This is the trust
 * artifact's most important invariant for long-term (30–100yr) records.
 *
 * Bump ONLY when the canonicalization OR the hashed-body scope changes; then add
 * the new version to CANONICALIZERS, extend hashedBody's spec branch, and pin a
 * conformance vector for it. NEVER mutate a shipped entry.
 */
export const SEAL_SPEC = 3;

/**
 * Versioned canonicalizers: spec version → how the hashed body is normalized before
 * SHA-256. Each entry is FROZEN once shipped; documents sealed under it must verify
 * under it forever.
 *   v0 — legacy: raw bytes (documents sealed before the NFC change / the spec field).
 *   v1 — NFC normalization, so a precomposed "é" (U+00E9) and a decomposed "e"+◌́
 *        (U+0065 U+0301) hash identically (a re-save in another editor keeps the seal).
 *   v2 — NFC; comments excluded; the seal scope covers signatures.
 *   v3 — NFC; ALSO excludes styling (presentation lines + props); the seal covers the
 *        freeze line's own metadata; signatures bind the signer identity (see
 *        computeSignatureHash). The canon is NFC throughout — the bump is about WHAT
 *        is hashed, not how.
 */
const CANONICALIZERS: Record<number, (body: string) => string> = {
  0: (body) => body,
  1: (body) => body.normalize("NFC"),
  2: (body) => body.normalize("NFC"),
  3: (body) => body.normalize("NFC"),
};

/**
 * Compute the SHA-256 content hash under a given spec version (default: current)
 * and scope (default: "content"). The `sha256:` prefix records the algorithm; the
 * seal's `spec:` field records the canonicalization version that produced the input.
 *
 * Scope (spec ≥ 2 only): "content" = the body alone (each signature's hash); "seal"
 * = the body plus signatures (the freeze hash, so a signature tamper breaks the seal).
 */
export function computeDocumentHash(
  source: string,
  spec: number = SEAL_SPEC,
  scope: HashScope = "content",
): string {
  const canon = CANONICALIZERS[spec] ?? CANONICALIZERS[SEAL_SPEC];
  return "sha256:" + sha256Hex(canon(hashedBody(source, spec, scope)));
}

/** The signer-identity string a v3 signature binds (so editing the name/role/date
 *  on a signed — not yet sealed — document breaks THAT signature). */
export function signatureIdentity(
  signer: string,
  role?: string,
  at?: string,
): string {
  return `${signer}|${role ?? ""}|${at ?? ""}`;
}

/**
 * Compute a SIGNATURE's hash: the content (v3 excludes styling) PLUS the signer's
 * identity, so a bare signature is tamper-evident for both what was signed AND who
 * signed it — even before the document is sealed. Co-signers still share the same
 * content base, so adding a signature never breaks an existing one. For spec < 3 the
 * signature is content-only (identity unbound), preserving historical signatures.
 */
export function computeSignatureHash(
  source: string,
  identity: string,
  spec: number = SEAL_SPEC,
): string {
  if (spec < 3) return computeDocumentHash(source, spec, "content");
  const canon = CANONICALIZERS[spec] ?? CANONICALIZERS[SEAL_SPEC];
  return (
    "sha256:" +
    sha256Hex(canon(hashedBody(source, spec, "content")) + " sig:" + identity)
  );
}

/**
 * Does a signature line still match the current document? Spec-aware: v3 binds the
 * signer identity (name/role/date), v2/v1 are content-only. The single source of
 * truth for "is this signature valid for the current content" — used by
 * verifyDocument (per signer), the trust band, and the editor banner so they agree.
 */
export function signatureMatchesContent(
  source: string,
  sig: {
    hash?: string;
    spec?: number;
    signer?: string;
    role?: string;
    at?: string;
  },
): boolean {
  if (!sig.hash) return false;
  if (sig.spec != null && sig.spec >= 3) {
    return (
      sig.hash ===
      computeSignatureHash(
        source,
        signatureIdentity(sig.signer ?? "", sig.role, sig.at),
        sig.spec,
      )
    );
  }
  return hashMatches(source, sig.hash, sig.spec, "content");
}

/**
 * Legacy (v0, pre-NFC) hash. Retained ONLY so documents sealed before the spec
 * field still verify. Never write this — new seals always stamp the current spec.
 */
export function computeDocumentHashLegacy(source: string): string {
  return computeDocumentHash(source, 0);
}

/**
 * True if `expected` matches the document's content hash. When the seal recorded
 * its spec version, verify against THAT version ONLY — the forever-stable guarantee.
 * When no spec was recorded (a pre-versioning seal), try every known canonicalizer
 * for backward compatibility.
 */
export function hashMatches(
  source: string,
  expected: string,
  spec?: number,
  scope: HashScope = "content",
): boolean {
  if (!expected) return false;
  if (spec != null) return computeDocumentHash(source, spec, scope) === expected;
  return Object.keys(CANONICALIZERS).some(
    (v) => computeDocumentHash(source, Number(v), scope) === expected,
  );
}

/**
 * Find history boundary position in raw source string.
 * v2.12: looks for `history:` keyword line.
 * Backward compat: also detects legacy `---` + `// history` pattern.
 * Returns byte offset of the boundary line, or -1.
 */
export function findHistoryBoundaryInSource(source: string): number {
  const lines = source.split("\n");
  let pos = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // v2.12: history: keyword is the canonical boundary
    if (trimmed === "history:" || trimmed === "history: ") {
      return pos;
    }
    // Legacy v2.11: --- followed by // history
    if (trimmed === "---" && i < lines.length - 1) {
      const next = lines[i + 1]?.trim();
      if (next === "// history" || next?.startsWith("// history")) {
        return pos;
      }
    }
    pos += lines[i].length + 1;
  }
  return -1;
}

/**
 * Detect the history boundary in an array of lines.
 * Mirrors source-boundary semantics for callers that already split lines.
 */
export function detectHistoryBoundary(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === "history:" || trimmed === "history: ") {
      return i;
    }
    if (trimmed === "---" && i < lines.length - 1) {
      const next = lines[i + 1]?.trim();
      if (next === "// history" || next?.startsWith("// history")) {
        return i;
      }
    }
  }
  return -1;
}

// ─── Registry ────────────────────────────────────────────────────────────────

/**
 * Generate a stable 5-character alphanumeric ID for a block.
 */
export function generateBlockId(): string {
  return randomHex(3).slice(0, 5);
}

/**
 * Create a fingerprint for a block (used for matching across saves).
 */
export function blockFingerprint(content: string): string {
  return content.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Match current blocks to registry entries by fingerprint similarity.
 * Returns a map of current block index → registry ID.
 */
export function matchBlocksToRegistry(
  blocks: Array<{ type: string; content: string; section: string }>,
  registry: RegistryEntry[],
): Map<number, string> {
  const result = new Map<number, string>();
  const usedIds = new Set<string>();

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const fp = blockFingerprint(block.content);

    // Exact match first
    const exact = registry.find(
      (r) =>
        !r.dead &&
        !usedIds.has(r.id) &&
        r.blockType === block.type &&
        r.section === block.section &&
        r.fingerprint === fp,
    );

    if (exact) {
      result.set(i, exact.id);
      usedIds.add(exact.id);
      continue;
    }

    // Fuzzy match — same type and section, similar content
    const fuzzy = registry.find(
      (r) =>
        !r.dead &&
        !usedIds.has(r.id) &&
        r.blockType === block.type &&
        r.section === block.section &&
        similarity(r.fingerprint, fp) > 0.6,
    );

    if (fuzzy) {
      result.set(i, fuzzy.id);
      usedIds.add(fuzzy.id);
    }
    // No match = new block, will get new ID
  }

  return result;
}

/**
 * Simple similarity score between two strings (0–1).
 * Uses character overlap ratio.
 */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  let matches = 0;
  for (const char of shorter) {
    if (longer.includes(char)) matches++;
  }
  return matches / longer.length;
}

// ─── Diff Engine ─────────────────────────────────────────────────────────────

export interface BlockSnapshot {
  id: string;
  type: string;
  content: string;
  section: string;
  properties: Record<string, string>;
}

export interface TrustDiff {
  added: BlockSnapshot[];
  removed: BlockSnapshot[];
  modified: Array<{ id: string; was: BlockSnapshot; now: BlockSnapshot }>;
  moved: Array<{
    id: string;
    wasSection: string;
    nowSection: string;
    block: BlockSnapshot;
  }>;
  unchanged: BlockSnapshot[];
}

/**
 * Compute diff between two document snapshots for history writing.
 */
export function computeTrustDiff(
  before: BlockSnapshot[],
  after: BlockSnapshot[],
): TrustDiff {
  const result: TrustDiff = {
    added: [],
    removed: [],
    modified: [],
    moved: [],
    unchanged: [],
  };

  const beforeById = new Map(before.map((b) => [b.id, b]));
  const afterById = new Map(after.map((b) => [b.id, b]));

  // Find removed and unchanged/modified
  for (const [id, beforeBlock] of beforeById) {
    const afterBlock = afterById.get(id);
    if (!afterBlock) {
      result.removed.push(beforeBlock);
    } else if (beforeBlock.content !== afterBlock.content) {
      result.modified.push({ id, was: beforeBlock, now: afterBlock });
    } else if (beforeBlock.section !== afterBlock.section) {
      result.moved.push({
        id,
        wasSection: beforeBlock.section,
        nowSection: afterBlock.section,
        block: afterBlock,
      });
    } else {
      result.unchanged.push(afterBlock);
    }
  }

  // Find added
  for (const [id, afterBlock] of afterById) {
    if (!beforeById.has(id)) {
      result.added.push(afterBlock);
    }
  }

  return result;
}

// ─── Version Incrementing ────────────────────────────────────────────────────

/**
 * Increment version string.
 * Major changes (section added/removed): bump major.
 * Content changes: bump minor.
 */
export function incrementVersion(
  current: string,
  changeType: "major" | "minor",
): string {
  const parts = current.split(".").map(Number);
  if (changeType === "major") {
    return `${parts[0] + 1}.0`;
  } else {
    return `${parts[0]}.${(parts[1] || 0) + 1}`;
  }
}

// ─── Seal / Verify ───────────────────────────────────────────────────────────

export interface SealOptions {
  signer: string;
  role?: string;
  skipSign?: boolean;
}

export interface SealResult {
  success: boolean;
  hash: string;
  source: string;
  at: string;
  error?: string;
}

/**
 * Seal a document — add sign: block (optional) and freeze: block.
 * Returns updated source with seal appended.
 */
/** True if the source already carries a freeze: (sealed) line. */
export function isSealed(source: string): boolean {
  return source.split("\n").some((l) => l.trimStart().startsWith("freeze:"));
}

/** True if the source already carries a sign: line for this signer. */
export function isSignedBy(source: string, signer: string): boolean {
  const needle = `sign: ${signer}`;
  return source
    .split("\n")
    .some((l) => l.trimStart().startsWith(needle));
}

/**
 * Remove the freeze: lock — "unseal" — so the document can be edited and
 * re-sealed. Signatures (sign: lines) are KEPT as historical approvals; after
 * an edit, verifyDocument reports each as signing a prior version
 * (signedCurrentVersion: false) rather than silently dropping them. Idempotent:
 * an unsealed document is returned unchanged.
 */
export function unsealDocument(source: string): string {
  const kept = source
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("freeze:"));
  return kept.join("\n").replace(/\n{3,}/g, "\n\n");
}

export interface SignResult {
  success: boolean;
  source: string;
  at: string;
  /** "already-signed" when the signer had already signed (no-op). */
  note?: string;
}

/**
 * Add a signature (approval) to a document WITHOUT freezing it — distinct from
 * sealing. Multiple parties can sign; a frozen document can still collect
 * signatures. Idempotent: signing again as the same signer is a no-op, so
 * repeat clicks never append duplicate sign: lines.
 *
 * The signature carries the current content hash, so verifyDocument can later
 * report whether each signer approved the version that was ultimately sealed.
 */
export function signDocument(
  source: string,
  options: { signer: string; role?: string },
): SignResult {
  const at = new Date().toISOString();
  if (isSignedBy(source, options.signer)) {
    return { success: true, source, at, note: "already-signed" };
  }
  // v3 binds the signer identity (name/role/at) into the hash, so editing the
  // signer line breaks THIS signature even before sealing.
  const hash = computeSignatureHash(
    source,
    signatureIdentity(options.signer, options.role, at),
    SEAL_SPEC,
  );
  const signLine = `sign: ${options.signer}${options.role ? ` | role: ${options.role}` : ""} | at: ${at} | hash: ${hash} | spec: ${SEAL_SPEC}`;

  // Insert the signature just above the freeze: line if the doc is sealed (so
  // signatures stay grouped with the seal), otherwise above the history
  // boundary, otherwise at the end.
  const lines = source.replace(/\n+$/, "").split("\n");
  const freezeIdx = lines.findIndex((l) => l.trimStart().startsWith("freeze:"));
  const histIdx = lines.findIndex(
    (l) => l.trim() === "history:" || l.trim() === "history",
  );
  const insertAt =
    freezeIdx !== -1 ? freezeIdx : histIdx !== -1 ? histIdx : lines.length;
  lines.splice(insertAt, 0, signLine);
  return { success: true, source: lines.join("\n") + "\n", at };
}

export function sealDocument(source: string, options: SealOptions): SealResult {
  // Templates are outside the trust workflow — refuse before doing anything.
  assertNotTemplate(source, "sealed");
  // Idempotent: re-sealing an already-sealed document is a no-op rather than
  // appending a second freeze:/sign: pair (the repeat-click corruption bug).
  if (isSealed(source)) {
    const v = verifyDocument(source);
    return {
      success: true,
      hash: v.expectedHash ?? computeDocumentHash(source),
      source,
      at: v.frozenAt ?? new Date().toISOString(),
      error: "already-sealed",
    };
  }
  const at = new Date().toISOString();

  const boundaryPos = findHistoryBoundaryInSource(source);
  const insertBefore = boundaryPos === -1 ? source.length : boundaryPos;

  // Each signature carries the CONTENT+IDENTITY hash (co-signers commit to the same
  // body, independent of who else has signed; v3 also binds the signer identity).
  const signHash = options.skipSign
    ? ""
    : computeSignatureHash(
        source,
        signatureIdentity(options.signer, options.role, at),
        SEAL_SPEC,
      );
  const signLine = options.skipSign
    ? ""
    : `sign: ${options.signer}${options.role ? ` | role: ${options.role}` : ""} | at: ${at} | hash: ${signHash} | spec: ${SEAL_SPEC}\n`;

  const before = source.slice(0, insertBefore);
  const after = source.slice(insertBefore);
  const needsNewline = before.length > 0 && !before.endsWith("\n");

  // The freeze carries the SEAL hash — content PLUS all signatures PLUS the freeze
  // line's own metadata (at/status/spec). Compute it over the source WITH the new
  // sign line AND a placeholder (empty-hash) freeze line in place: hashedBody's seal
  // scope strips the freeze hash value, so the empty placeholder and the final filled
  // hash produce identical bytes — no circularity, yet at/status tampering breaks it.
  const freezePlaceholder = `freeze: | at: ${at} | hash:  | spec: ${SEAL_SPEC} | status: locked\n`;
  const sealInput =
    before + (needsNewline ? "\n" : "") + signLine + freezePlaceholder + after;
  const sealHash = computeDocumentHash(sealInput, SEAL_SPEC, "seal");
  const freezeLine = `freeze: | at: ${at} | hash: ${sealHash} | spec: ${SEAL_SPEC} | status: locked\n`;

  const updated =
    before + (needsNewline ? "\n" : "") + signLine + freezeLine + after;

  return { success: true, hash: sealHash, source: updated, at };
}

export interface VerifyResult {
  intact: boolean;
  frozen: boolean;
  frozenAt?: string;
  signers?: Array<{
    signer: string;
    role?: string;
    at: string;
    /** true if this signer's stored hash matches the freeze hash (approved the sealed version) */
    valid: boolean;
    /** true if this signer's stored hash matches the current document hash */
    signedCurrentVersion: boolean;
  }>;
  hash?: string;
  expectedHash?: string;
  error?: string;
  warning?: string;
  /** The canonicalization spec the seal was created under (from the freeze line). */
  spec?: number;
  /**
   * The seal is valid but uses an OLDER ruleset than the current SEAL_SPEC — it is
   * weaker (e.g. spec ≤ 1 does not cover signatures, so a signer could be altered
   * without breaking the seal). Re-seal to upgrade. True only when `intact`.
   */
  specOutdated?: boolean;
}

/**
 * Verify a document's integrity.
 */
export function verifyDocument(source: string): VerifyResult {
  const doc = parseIntentText(source, { includeHistorySection: false });

  if (!doc.metadata?.freeze) {
    return {
      intact: false,
      frozen: false,
      warning: "Document is not sealed. No freeze: block found.",
    };
  }

  const freezeSpec = doc.metadata.freeze.spec;
  // The freeze carries the SEAL hash (content + signatures, spec ≥ 2), so the
  // current-state comparison is in the seal scope.
  const currentHash = computeDocumentHash(source, freezeSpec ?? SEAL_SPEC, "seal");
  const expectedHash = doc.metadata.freeze.hash;
  // Verify the seal against the canonicalization version it RECORDED (forever
  // stable), in the SEAL scope so tampering EITHER the body OR a signature breaks
  // it. A pre-versioning seal (no spec:) falls back to trying all known versions;
  // for v0/v1 the seal scope collapses to the content scope, so historical seals
  // verify exactly as before.
  const intact = hashMatches(source, expectedHash, freezeSpec, "seal");
  const signers =
    doc.metadata.signatures?.map((sig) => {
      // A signer "approved the current version" if its signature still matches —
      // v3 binds the identity, v2 is content-only (see signatureMatchesContent).
      const signedCurrentVersion = signatureMatchesContent(source, sig);
      return {
        signer: sig.signer,
        role: sig.role,
        at: sig.at,
        // "valid" = approved the sealed version. For v2 the signature hash (content
        // scope) and the freeze hash (seal scope) differ by construction, so we test
        // the content scope; when the seal is intact that IS the sealed content.
        // For v0/v1 both share one scope, so the direct freeze-hash compare holds.
        valid:
          sig.spec != null && sig.spec >= 2
            ? signedCurrentVersion && intact
            : sig.hash === expectedHash,
        signedCurrentVersion,
      };
    }) || [];

  // A valid seal made under an older ruleset is WEAKER than today's — most
  // importantly, spec ≤ 1 hashes content only, so signatures aren't covered and a
  // signer could be altered without breaking the seal. Flag it (and advise re-seal)
  // so an outdated seal never reads as fully trusted.
  const specOutdated = intact && freezeSpec != null && freezeSpec < SEAL_SPEC;

  return {
    intact,
    frozen: true,
    frozenAt: doc.metadata.freeze.at,
    signers,
    hash: currentHash,
    expectedHash,
    spec: freezeSpec,
    specOutdated: specOutdated || undefined,
    error: intact ? undefined : "Document has been modified since sealing.",
    warning: specOutdated
      ? `Sealed under ruleset v${freezeSpec}, which does not protect signatures. Re-seal to upgrade to v${SEAL_SPEC}.`
      : undefined,
  };
}
