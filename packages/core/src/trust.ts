import crypto from "crypto";
import { IntentDocument, RegistryEntry } from "./types";
import { parseIntentText } from "./parser";

// ─── Hash Computation ───────────────────────────────────────────────────────

/**
 * Compute SHA-256 hash of document content above the history boundary,
 * excluding sign: and freeze: lines (since their hashes reference the body without them).
 */
export function computeDocumentHash(source: string): string {
  const boundary = findHistoryBoundaryInSource(source);
  const content = boundary === -1 ? source : source.slice(0, boundary);
  // Strip sign: and freeze: lines — these are the seal metadata whose
  // hash fields reference the content without them
  const bodyLines = content
    .split("\n")
    .filter((line) => !line.startsWith("sign:") && !line.startsWith("freeze:"));
  const body = bodyLines.join("\n").trim();
  return "sha256:" + crypto.createHash("sha256").update(body).digest("hex");
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

// ─── Registry ────────────────────────────────────────────────────────────────

/**
 * Generate a stable 5-character alphanumeric ID for a block.
 */
export function generateBlockId(): string {
  return crypto.randomBytes(3).toString("hex").slice(0, 5);
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
export function sealDocument(source: string, options: SealOptions): SealResult {
  const hash = computeDocumentHash(source);
  const at = new Date().toISOString();

  const boundaryPos = findHistoryBoundaryInSource(source);
  const insertBefore = boundaryPos === -1 ? source.length : boundaryPos;

  const signLine = options.skipSign
    ? ""
    : `sign: ${options.signer}${options.role ? ` | role: ${options.role}` : ""} | at: ${at} | hash: ${hash}\n`;

  const freezeLine = `freeze: | at: ${at} | hash: ${hash} | status: locked\n`;

  const insertion = signLine + freezeLine;

  // Need trailing newline before insertion if source doesn't end with one
  const before = source.slice(0, insertBefore);
  const after = source.slice(insertBefore);
  const needsNewline = before.length > 0 && !before.endsWith("\n");

  const updated = before + (needsNewline ? "\n" : "") + insertion + after;

  return { success: true, hash, source: updated, at };
}

export interface VerifyResult {
  intact: boolean;
  frozen: boolean;
  frozenAt?: string;
  signers?: Array<{
    signer: string;
    role?: string;
    at: string;
    valid: boolean;
  }>;
  hash?: string;
  expectedHash?: string;
  error?: string;
  warning?: string;
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

  const currentHash = computeDocumentHash(source);
  const expectedHash = doc.metadata.freeze.hash;
  const intact = currentHash === expectedHash;

  const signers =
    doc.metadata.signatures?.map((sig) => ({
      signer: sig.signer,
      role: sig.role,
      at: sig.at,
      valid: sig.hash === currentHash,
    })) || [];

  return {
    intact,
    frozen: true,
    frozenAt: doc.metadata.freeze.at,
    signers,
    hash: currentHash,
    expectedHash,
    error: intact ? undefined : "Document has been modified since sealing.",
  };
}
