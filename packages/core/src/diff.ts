import { IntentDocument, IntentBlock } from "./types";
import { flattenBlocks } from "./utils";

export interface BlockModification {
  blockId: string;
  before: IntentBlock;
  after: IntentBlock;
  contentChanged: boolean;
  propertiesChanged: string[];
  typeChanged: boolean;
}

export interface DocumentDiff {
  added: IntentBlock[];
  removed: IntentBlock[];
  modified: BlockModification[];
  unchanged: IntentBlock[];
  summary: string;
}

/**
 * Compute a semantic diff between two IntentDocument versions.
 * Blocks are matched by content similarity rather than ID (IDs are ephemeral).
 * Pure function — does not mutate inputs.
 */
export function diffDocuments(
  before: IntentDocument,
  after: IntentDocument,
): DocumentDiff {
  const beforeBlocks = before?.blocks ? flattenBlocks(before.blocks) : [];
  const afterBlocks = after?.blocks ? flattenBlocks(after.blocks) : [];

  const added: IntentBlock[] = [];
  const removed: IntentBlock[] = [];
  const modified: BlockModification[] = [];
  const unchanged: IntentBlock[] = [];

  // Track which blocks have been matched
  const matchedBefore = new Set<number>();
  const matchedAfter = new Set<number>();

  // Pass 1: Exact matches (same type + same content)
  for (let i = 0; i < beforeBlocks.length; i++) {
    if (matchedBefore.has(i)) continue;
    for (let j = 0; j < afterBlocks.length; j++) {
      if (matchedAfter.has(j)) continue;
      if (
        beforeBlocks[i].type === afterBlocks[j].type &&
        beforeBlocks[i].content === afterBlocks[j].content
      ) {
        // Check if properties changed
        const propChanges = diffProperties(beforeBlocks[i], afterBlocks[j]);
        if (propChanges.length === 0) {
          unchanged.push(beforeBlocks[i]);
        } else {
          modified.push({
            blockId: beforeBlocks[i].id,
            before: beforeBlocks[i],
            after: afterBlocks[j],
            contentChanged: false,
            propertiesChanged: propChanges,
            typeChanged: false,
          });
        }
        matchedBefore.add(i);
        matchedAfter.add(j);
        break;
      }
    }
  }

  // Pass 2: Fuzzy matches (same type, content similarity > 80%)
  for (let i = 0; i < beforeBlocks.length; i++) {
    if (matchedBefore.has(i)) continue;
    let bestJ = -1;
    let bestSim = 0;

    for (let j = 0; j < afterBlocks.length; j++) {
      if (matchedAfter.has(j)) continue;
      if (beforeBlocks[i].type !== afterBlocks[j].type) continue;

      const sim = similarity(beforeBlocks[i].content, afterBlocks[j].content);
      if (sim > 0.8 && sim > bestSim) {
        bestSim = sim;
        bestJ = j;
      }
    }

    if (bestJ >= 0) {
      const propChanges = diffProperties(beforeBlocks[i], afterBlocks[bestJ]);
      modified.push({
        blockId: beforeBlocks[i].id,
        before: beforeBlocks[i],
        after: afterBlocks[bestJ],
        contentChanged: beforeBlocks[i].content !== afterBlocks[bestJ].content,
        propertiesChanged: propChanges,
        typeChanged: false,
      });
      matchedBefore.add(i);
      matchedAfter.add(bestJ);
    }
  }

  // Pass 3: Cross-type fuzzy matches (type changed but content similar)
  for (let i = 0; i < beforeBlocks.length; i++) {
    if (matchedBefore.has(i)) continue;
    let bestJ = -1;
    let bestSim = 0;

    for (let j = 0; j < afterBlocks.length; j++) {
      if (matchedAfter.has(j)) continue;
      const sim = similarity(beforeBlocks[i].content, afterBlocks[j].content);
      if (sim > 0.8 && sim > bestSim) {
        bestSim = sim;
        bestJ = j;
      }
    }

    if (bestJ >= 0) {
      const propChanges = diffProperties(beforeBlocks[i], afterBlocks[bestJ]);
      modified.push({
        blockId: beforeBlocks[i].id,
        before: beforeBlocks[i],
        after: afterBlocks[bestJ],
        contentChanged: beforeBlocks[i].content !== afterBlocks[bestJ].content,
        propertiesChanged: propChanges,
        typeChanged: beforeBlocks[i].type !== afterBlocks[bestJ].type,
      });
      matchedBefore.add(i);
      matchedAfter.add(bestJ);
    }
  }

  // Remaining: added and removed
  for (let i = 0; i < beforeBlocks.length; i++) {
    if (!matchedBefore.has(i)) removed.push(beforeBlocks[i]);
  }
  for (let j = 0; j < afterBlocks.length; j++) {
    if (!matchedAfter.has(j)) added.push(afterBlocks[j]);
  }

  // Build summary
  const parts: string[] = [];
  if (added.length > 0) parts.push(`${added.length} added`);
  if (removed.length > 0) parts.push(`${removed.length} removed`);
  if (modified.length > 0) parts.push(`${modified.length} modified`);
  if (unchanged.length > 0) parts.push(`${unchanged.length} unchanged`);
  const summary = parts.join(", ") || "no changes";

  return { added, removed, modified, unchanged, summary };
}

/** Find property keys that differ between two blocks. */
function diffProperties(a: IntentBlock, b: IntentBlock): string[] {
  const propsA = a.properties || {};
  const propsB = b.properties || {};
  const allKeys = new Set([...Object.keys(propsA), ...Object.keys(propsB)]);
  const changed: string[] = [];

  for (const key of allKeys) {
    if (String(propsA[key] ?? "") !== String(propsB[key] ?? "")) {
      changed.push(key);
    }
  }
  return changed;
}

/**
 * Character-level similarity (1 - normalized Levenshtein distance).
 * For performance, uses a simple approach optimized for typical block content
 * (usually under a few hundred characters).
 */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  // For very long strings, use a quick heuristic to avoid O(n*m) cost
  const maxLen = Math.max(a.length, b.length);
  if (maxLen > 1000) {
    return quickSimilarity(a, b);
  }

  const dist = levenshtein(a, b);
  return 1 - dist / maxLen;
}

/** O(n*m) Levenshtein distance — only used for strings under 1000 chars. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Use two rows instead of full matrix for O(n) space
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Quick heuristic similarity for long strings — based on shared trigrams. */
function quickSimilarity(a: string, b: string): number {
  const triA = new Set<string>();
  const triB = new Set<string>();

  for (let i = 0; i <= a.length - 3; i++) triA.add(a.slice(i, i + 3));
  for (let i = 0; i <= b.length - 3; i++) triB.add(b.slice(i, i + 3));

  let shared = 0;
  for (const t of triA) {
    if (triB.has(t)) shared++;
  }

  const total = triA.size + triB.size;
  if (total === 0) return 1;
  return (2 * shared) / total;
}
