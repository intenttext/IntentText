/**
 * IntentText Index Builder — v2.10
 *
 * Shallow-only .it-index architecture.
 * Each index covers ONLY the .it files sitting directly in its folder.
 * Never subfolders. Never recursive content in a single index.
 */

import { IntentDocument, IntentBlock } from "./types";
import { flattenBlocks } from "./utils";

// ── Types ───────────────────────────────────────────────

export interface IndexFileEntry {
  hash: string;
  modified_at: string;
  metadata: {
    title?: string;
    type?: string;
    domain?: string;
    track?: Record<string, string>;
    [key: string]: unknown;
  };
  blocks: IndexBlockEntry[];
}

export interface IndexBlockEntry {
  type: string;
  content: string;
  section?: string;
  properties: Record<string, string | number>;
}

export interface ItIndex {
  version: "1";
  scope: "shallow";
  folder: string;
  built_at: string;
  core_version: string;
  files: Record<string, IndexFileEntry>;
}

export interface ComposedResult {
  file: string;
  block: IndexBlockEntry;
}

// ── Hashing ─────────────────────────────────────────────

/** Simple hash for index invalidation (not cryptographic). */
function simpleHash(content: string): string {
  let h = 0;
  for (let i = 0; i < content.length; i++) {
    h = (Math.imul(31, h) + content.charCodeAt(i)) | 0;
  }
  return "hash:" + Math.abs(h).toString(16).padStart(8, "0");
}

// ── Build ───────────────────────────────────────────────

/**
 * Build index entries from a parsed document.
 * Extracts metadata and block summaries for querying.
 */
export function buildIndexEntry(
  doc: IntentDocument,
  source: string,
  modifiedAt: string,
): IndexFileEntry {
  const meta: IndexFileEntry["metadata"] = {};
  if (doc.metadata?.title) meta.title = doc.metadata.title;
  if (doc.metadata?.meta) {
    if (doc.metadata.meta.type) meta.type = doc.metadata.meta.type;
    if (doc.metadata.meta.domain) meta.domain = doc.metadata.meta.domain;
  }
  if (doc.metadata?.tracking) {
    meta.track = {};
    if (doc.metadata.tracking.version)
      meta.track.version = doc.metadata.tracking.version;
    if (doc.metadata.tracking.by) meta.track.by = doc.metadata.tracking.by;
  }

  const allBlocks = flattenBlocks(doc.blocks);
  let currentSection = "";
  const blocks: IndexBlockEntry[] = [];

  for (const block of allBlocks) {
    if (block.type === "section") {
      currentSection = block.content;
    }
    // Skip layout/structural blocks from the index
    const bt = block.type;
    if (
      bt === "font" ||
      bt === "page" ||
      bt === "header" ||
      bt === "footer" ||
      bt === "watermark" ||
      bt === "meta" ||
      bt === "break" ||
      bt === "toc"
    ) {
      continue;
    }
    blocks.push({
      type: bt,
      content: block.content,
      section: currentSection || undefined,
      properties: (block.properties as Record<string, string | number>) || {},
    });
  }

  return {
    hash: simpleHash(source),
    modified_at: modifiedAt,
    metadata: meta,
    blocks,
  };
}

/**
 * Build a shallow index object for a folder.
 * Takes a map of filename → { source, doc, modifiedAt }.
 */
export function buildShallowIndex(
  folder: string,
  files: Record<
    string,
    { source: string; doc: IntentDocument; modifiedAt: string }
  >,
  coreVersion: string,
): ItIndex {
  const index: ItIndex = {
    version: "1",
    scope: "shallow",
    folder,
    built_at: new Date().toISOString(),
    core_version: coreVersion,
    files: {},
  };

  for (const [filename, data] of Object.entries(files)) {
    index.files[filename] = buildIndexEntry(
      data.doc,
      data.source,
      data.modifiedAt,
    );
  }

  return index;
}

// ── Invalidation ────────────────────────────────────────

/**
 * Check which files in an existing index are stale, new, or deleted.
 * Returns lists of filenames in each category.
 */
export function checkStaleness(
  existingIndex: ItIndex,
  currentFiles: Record<string, { source: string; modifiedAt: string }>,
): {
  stale: string[];
  added: string[];
  removed: string[];
  unchanged: string[];
} {
  const stale: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  const unchanged: string[] = [];

  // Check each file currently in the folder
  for (const [filename, current] of Object.entries(currentFiles)) {
    const entry = existingIndex.files[filename];
    if (!entry) {
      added.push(filename);
    } else if (
      entry.modified_at !== current.modifiedAt ||
      entry.hash !== simpleHash(current.source)
    ) {
      stale.push(filename);
    } else {
      unchanged.push(filename);
    }
  }

  // Check for deleted files
  for (const filename of Object.keys(existingIndex.files)) {
    if (!(filename in currentFiles)) {
      removed.push(filename);
    }
  }

  return { stale, added, removed, unchanged };
}

/**
 * Update an existing index with new/changed entries and remove deleted ones.
 * Returns a new ItIndex (does not mutate the original).
 */
export function updateIndex(
  existingIndex: ItIndex,
  updates: Record<
    string,
    { source: string; doc: IntentDocument; modifiedAt: string }
  >,
  removedFiles: string[],
): ItIndex {
  const newFiles = { ...existingIndex.files };

  // Remove deleted files
  for (const filename of removedFiles) {
    delete newFiles[filename];
  }

  // Add/update entries
  for (const [filename, data] of Object.entries(updates)) {
    newFiles[filename] = buildIndexEntry(
      data.doc,
      data.source,
      data.modifiedAt,
    );
  }

  return {
    ...existingIndex,
    built_at: new Date().toISOString(),
    files: newFiles,
  };
}

// ── Composition ─────────────────────────────────────────

/**
 * Compose multiple shallow indexes into a unified query-ready result set.
 * Each index's folder path is used to resolve relative file paths.
 * The rootFolder is used to compute relative paths for the results.
 */
export function composeIndexes(
  indexes: ItIndex[],
  rootFolder: string,
): ComposedResult[] {
  const results: ComposedResult[] = [];

  for (const index of indexes) {
    // Validate this is a shallow index
    if (index.scope !== "shallow") continue;

    for (const [filename, entry] of Object.entries(index.files)) {
      // Build relative path from root
      const folder = index.folder;
      const relativePath = folder ? `${folder}/${filename}` : filename;

      for (const block of entry.blocks) {
        results.push({
          file: relativePath,
          block,
        });
      }
    }
  }

  return results;
}

/**
 * Query composed results with the same filter semantics as the query engine.
 */
export function queryComposed(
  results: ComposedResult[],
  filters: {
    type?: string;
    content?: string;
    by?: string;
    status?: string;
    section?: string;
  },
): ComposedResult[] {
  return results.filter((r) => {
    if (filters.type && r.block.type !== filters.type) return false;
    if (
      filters.content &&
      !r.block.content.toLowerCase().includes(filters.content.toLowerCase())
    )
      return false;
    if (
      filters.by &&
      String(r.block.properties.by || "").toLowerCase() !==
        filters.by.toLowerCase()
    )
      return false;
    if (
      filters.status &&
      String(r.block.properties.status || "").toLowerCase() !==
        filters.status.toLowerCase()
    )
      return false;
    if (
      filters.section &&
      (!r.block.section ||
        !r.block.section.toLowerCase().includes(filters.section.toLowerCase()))
    )
      return false;
    return true;
  });
}

// ── Output Formatters ───────────────────────────────────

/**
 * Format composed results as a table string.
 */
export function formatTable(results: ComposedResult[]): string {
  if (results.length === 0) return "No results";

  // Collect all property keys across results
  const propKeys = new Set<string>();
  for (const r of results) {
    for (const k of Object.keys(r.block.properties)) {
      propKeys.add(k);
    }
  }
  const propCols = [...propKeys];

  // Headers
  const headers = ["FILE", "TYPE", "CONTENT", "PROPERTIES"];
  const rows = results.map((r) => [
    r.file,
    r.block.type,
    r.block.content.length > 40
      ? r.block.content.slice(0, 37) + "..."
      : r.block.content,
    propCols
      .map((k) => {
        const v = r.block.properties[k];
        return v !== undefined ? `${k}: ${String(v).slice(0, 20)}` : "";
      })
      .filter(Boolean)
      .join(" | "),
  ]);

  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => String(row[i]).length)),
  );

  const line = (cells: string[]) =>
    cells.map((c, i) => String(c).padEnd(colWidths[i])).join("  ");

  return [
    line(headers),
    colWidths.map((w) => "-".repeat(w)).join("  "),
    ...rows.map((r) => line(r)),
  ].join("\n");
}

/**
 * Format composed results as JSON.
 */
export function formatJSON(results: ComposedResult[]): string {
  return JSON.stringify(
    results.map((r) => ({
      file: r.file,
      block: r.block,
    })),
    null,
    2,
  );
}

/**
 * Format composed results as CSV.
 */
export function formatCSV(results: ComposedResult[]): string {
  if (results.length === 0) return "";

  // Collect all property keys
  const propKeys = new Set<string>();
  for (const r of results) {
    for (const k of Object.keys(r.block.properties)) {
      propKeys.add(k);
    }
  }
  const props = [...propKeys].sort();

  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };

  const headers = ["file", "type", "content", ...props];
  const rows = results.map((r) => [
    r.file,
    r.block.type,
    r.block.content,
    ...props.map((k) => String(r.block.properties[k] ?? "")),
  ]);

  return [
    headers.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ].join("\n");
}
