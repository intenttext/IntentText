import {
  IntentBlock,
  IntentDocument,
  RegistryEntry,
  RevisionEntry,
} from "./types";
import {
  generateBlockId,
  blockFingerprint,
  matchBlocksToRegistry,
  computeTrustDiff,
  incrementVersion,
  findHistoryBoundaryInSource,
  BlockSnapshot,
} from "./trust";
import { parseIntentText } from "./rust-core";

// ─── History Section Parsing ─────────────────────────────────────────────────

/**
 * Parse the raw history section into structured data.
 */
export function parseHistorySection(raw: string): {
  registry: RegistryEntry[];
  revisions: RevisionEntry[];
  registryIntact: boolean;
} {
  const lines = raw
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("//"));
  const registry: RegistryEntry[] = [];
  const revisions: RevisionEntry[] = [];
  let registryIntact = true;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("revision:")) {
      revisions.push(parseRevisionLine(trimmed));
    } else if (/^[a-z0-9]{5}\s*\|/.test(trimmed)) {
      const parts = trimmed.split("|").map((p) => p.trim());
      if (parts.length >= 4) {
        registry.push({
          id: parts[0],
          blockType: parts[1],
          section: parts[2],
          fingerprint: parts[3],
          dead: parts[4] === "dead" || undefined,
        });
      } else {
        registryIntact = false;
      }
    }
  }

  return { registry, revisions, registryIntact };
}

function parseRevisionLine(line: string): RevisionEntry {
  const content = line.replace(/^revision:\s*\|?\s*/, "");
  const props: Record<string, string> = {};
  const segments = content.split(" | ");
  for (const seg of segments) {
    const colonIdx = seg.indexOf(":");
    if (colonIdx > -1) {
      props[seg.slice(0, colonIdx).trim()] = seg.slice(colonIdx + 1).trim();
    }
  }
  return {
    version: props.version || "",
    at: props.at || "",
    by: props.by || "",
    change: (props.change || "added") as RevisionEntry["change"],
    id: props.id || "",
    block: props.block || "",
    section: props.section,
    was: props.was,
    now: props.now,
    wasSection: props["was-section"],
    nowSection: props["now-section"],
  };
}

// ─── History Writing ──────────────────────────────────────────────────────────

export interface SaveHistoryOptions {
  by: string;
}

/**
 * Main function called on every save of a tracked document.
 * Reads previous and current source, computes diff, writes updated history section.
 * Returns the current source with updated history section appended.
 */
export function updateHistory(
  previousSource: string,
  currentSource: string,
  options: SaveHistoryOptions,
): string {
  // Parse both versions (above boundary only)
  const prevDoc = parseIntentText(previousSource);
  const currDoc = parseIntentText(currentSource);

  // Check if document is frozen — refuse update
  if (prevDoc.metadata?.freeze) {
    throw new Error(
      "Document is sealed and frozen. Cannot save modifications. " +
        "Use --force to override (this will void the seal).",
    );
  }

  // Extract history section from previous source
  const prevBoundaryPos = findHistoryBoundaryInSource(previousSource);
  let historyRaw =
    prevBoundaryPos === -1 ? "" : previousSource.slice(prevBoundaryPos);

  // Strip history from current source
  const currBoundaryPos = findHistoryBoundaryInSource(currentSource);
  const docContent =
    currBoundaryPos === -1
      ? currentSource
      : currentSource.slice(0, currBoundaryPos);

  // Parse existing history
  const { registry, revisions, registryIntact } =
    historyRaw === ""
      ? {
          registry: [] as RegistryEntry[],
          revisions: [] as RevisionEntry[],
          registryIntact: true,
        }
      : parseHistorySection(historyRaw);

  if (!registryIntact) {
    revisions.push({
      version: "warn",
      at: new Date().toISOString(),
      by: "system",
      change: "modified",
      id: "system",
      block: "system",
      now: "Registry integrity broken — tracking reset from this point",
    } as RevisionEntry);
  }

  // Get current version
  const currentVersion =
    currDoc.metadata?.tracking?.version ||
    (revisions.length > 0 ? revisions[revisions.length - 1].version : "1.0");

  // Build block snapshots for diffing
  const prevSnapshots = buildSnapshots(prevDoc.blocks, registry);

  // For current blocks, match to registry
  const currentBlockInfos = buildBlockInfos(currDoc.blocks);
  const matchMap = matchBlocksToRegistry(currentBlockInfos, registry);

  // Assign IDs to current blocks — recursive walk mirrors buildSnapshots/buildBlockInfos
  const currSnapshots: BlockSnapshot[] = [];
  let currSection = "root";
  function walkCurr(blockList: IntentBlock[]) {
    for (const b of blockList) {
      if (b.type === "section") currSection = b.content;
      if (b.type !== "title" && b.type !== "summary") {
        const flatIdx = currentBlockInfos.findIndex(
          (info) =>
            info.type === b.type &&
            info.content === b.content &&
            info.section === currSection,
        );
        const existingId = flatIdx !== -1 ? matchMap.get(flatIdx) : undefined;
        const id = existingId || generateBlockId();
        currSnapshots.push({
          id,
          type: b.type,
          content: b.content,
          section: currSection,
          properties: Object.fromEntries(
            Object.entries(b.properties || {}).map(([k, v]) => [k, String(v)]),
          ),
        });
      }
      if (b.children) walkCurr(b.children);
    }
  }
  walkCurr(currDoc.blocks);

  // Compute diff
  const diff = computeTrustDiff(prevSnapshots, currSnapshots);

  // Build new revision lines
  const newRevisions: RevisionEntry[] = [];
  let newVersion = currentVersion;

  const hasSignificantChanges =
    diff.added.some((b) => b.type === "section") ||
    diff.removed.some((b) => b.type === "section");

  if (
    diff.added.length ||
    diff.removed.length ||
    diff.modified.length ||
    diff.moved.length
  ) {
    newVersion = incrementVersion(
      currentVersion,
      hasSignificantChanges ? "major" : "minor",
    );
  }

  const at = new Date().toISOString();

  for (const block of diff.added) {
    newRevisions.push({
      version: newVersion,
      at,
      by: options.by,
      change: "added",
      id: block.id,
      block: block.type,
      section: block.section,
      now: block.content,
    });
  }

  for (const block of diff.removed) {
    newRevisions.push({
      version: newVersion,
      at,
      by: options.by,
      change: "removed",
      id: block.id,
      block: block.type,
      section: block.section,
      was: block.content,
    });
  }

  for (const { id, was, now } of diff.modified) {
    newRevisions.push({
      version: newVersion,
      at,
      by: options.by,
      change: "modified",
      id,
      block: now.type,
      section: now.section,
      was: was.content,
      now: now.content,
    });
  }

  for (const { id, wasSection, nowSection, block } of diff.moved) {
    newRevisions.push({
      version: newVersion,
      at,
      by: options.by,
      change: "moved",
      id,
      block: block.type,
      wasSection,
      nowSection,
    });
  }

  // Build updated registry
  const updatedRegistry = buildUpdatedRegistry(registry, currSnapshots, diff);

  // Rebuild history section
  const newHistorySection = buildHistorySection(updatedRegistry, [
    ...revisions,
    ...newRevisions,
  ]);

  // Return updated source
  const cleanDoc = docContent.endsWith("\n") ? docContent : docContent + "\n";
  return cleanDoc + newHistorySection;
}

function buildHistorySection(
  registry: RegistryEntry[],
  revisions: RevisionEntry[],
): string {
  const lines = [
    "history:",
    "",
    "// registry",
    ...registry.map(
      (r) =>
        `${r.id} | ${r.blockType} | ${r.section} | ${r.fingerprint}${r.dead ? " | dead" : ""}`,
    ),
    "",
    "// revisions",
    ...revisions.map((r) => revisionToLine(r)),
  ];
  return lines.join("\n") + "\n";
}

function revisionToLine(r: RevisionEntry): string {
  const parts = [
    "revision:",
    `version: ${r.version}`,
    `at: ${r.at}`,
    `by: ${r.by}`,
    `change: ${r.change}`,
    `id: ${r.id}`,
    `block: ${r.block}`,
  ];
  if (r.section) parts.push(`section: ${r.section}`);
  if (r.was) parts.push(`was: ${r.was}`);
  if (r.now) parts.push(`now: ${r.now}`);
  if (r.wasSection) parts.push(`was-section: ${r.wasSection}`);
  if (r.nowSection) parts.push(`now-section: ${r.nowSection}`);
  return parts.join(" | ");
}

function buildBlockInfos(
  blocks: IntentBlock[],
): Array<{ type: string; content: string; section: string }> {
  let currentSection = "root";
  const result: Array<{ type: string; content: string; section: string }> = [];

  function walk(blockList: IntentBlock[]) {
    for (const b of blockList) {
      if (b.type === "section") currentSection = b.content;
      if (b.type !== "title" && b.type !== "summary") {
        result.push({
          type: b.type,
          content: b.content,
          section: currentSection,
        });
      }
      if (b.children) walk(b.children);
    }
  }

  walk(blocks);
  return result;
}

function buildSnapshots(
  blocks: IntentBlock[],
  registry: RegistryEntry[],
): BlockSnapshot[] {
  let currentSection = "root";
  const result: BlockSnapshot[] = [];

  function walk(blockList: IntentBlock[]) {
    for (const b of blockList) {
      if (b.type === "section") currentSection = b.content;
      if (b.type !== "title" && b.type !== "summary") {
        const fp = blockFingerprint(b.content);
        const reg = registry.find(
          (r) => r.fingerprint === fp && r.blockType === b.type && !r.dead,
        );
        result.push({
          id: reg?.id || `unknown-${result.length}`,
          type: b.type,
          content: b.content,
          section: currentSection,
          properties: Object.fromEntries(
            Object.entries(b.properties || {}).map(([k, v]) => [k, String(v)]),
          ),
        });
      }
      if (b.children) walk(b.children);
    }
  }

  walk(blocks);
  return result;
}

function getSectionForBlock(blocks: IntentBlock[], index: number): string {
  let section = "root";
  for (let i = 0; i <= index; i++) {
    if (blocks[i].type === "section") section = blocks[i].content;
  }
  return section;
}

function buildUpdatedRegistry(
  existing: RegistryEntry[],
  current: BlockSnapshot[],
  diff: ReturnType<typeof computeTrustDiff>,
): RegistryEntry[] {
  const result = existing.map((r) => ({ ...r }));
  const currentIds = new Set(current.map((b) => b.id));

  // Mark removed blocks as dead
  for (const r of result) {
    if (!currentIds.has(r.id) && !r.dead) {
      r.dead = true;
    }
  }

  // Add new blocks to registry
  for (const block of diff.added) {
    if (!result.find((r) => r.id === block.id)) {
      result.push({
        id: block.id,
        blockType: block.type,
        section: block.section,
        fingerprint: blockFingerprint(block.content),
      });
    }
  }

  // Update modified blocks
  for (const { id, now } of diff.modified) {
    const entry = result.find((r) => r.id === id);
    if (entry) {
      entry.fingerprint = blockFingerprint(now.content);
      entry.section = now.section;
    }
  }

  return result;
}
