// search.ts — workspace-wide search over .it documents, powered by the core
// query engine. Supports structured filters (type=task status=open due<2026-01-01,
// owner:contains=sara, field? for "exists") mixed with free-text terms.

import { parseIntentText, parseQuery, queryBlocks } from "@dotit/core";
import type { IntentBlock } from "@dotit/core";
import type { TreeNode } from "./backend";

export interface SearchHit {
  path: string;
  relativePath: string;
  title?: string;
  blockType: string;
  snippet: string;
  line: number | null;
}

export interface SearchSummary {
  hits: SearchHit[];
  filesScanned: number;
  filesMatched: number;
  totalMatches: number;
  elapsedMs: number;
  parseFailures: number;
}

const OPERATOR_RE = /(=|!=|<=|>=|<|>|:contains|:startsWith|\?$)/;
const MAX_HITS = 500;

/** Splits a raw query into structured clauses (core syntax) and free text. */
export function splitQuery(raw: string): { structured: string; terms: string[] } {
  const structuredParts: string[] = [];
  const terms: string[] = [];
  for (const token of raw.trim().split(/\s+/).filter(Boolean)) {
    if (
      OPERATOR_RE.test(token) ||
      token.startsWith("sort:") ||
      token.startsWith("limit:") ||
      token.startsWith("offset:")
    ) {
      structuredParts.push(token);
    } else {
      terms.push(token.toLowerCase());
    }
  }
  return { structured: structuredParts.join(" "), terms };
}

function blockText(block: IntentBlock): string {
  const props = block.properties
    ? Object.entries(block.properties)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" ")
    : "";
  return `${block.type} ${block.content ?? ""} ${props}`.toLowerCase();
}

function findLine(source: string[], block: IntentBlock): number | null {
  const needle = (block.content ?? "").slice(0, 48).trim();
  if (!needle) return null;
  for (let i = 0; i < source.length; i++) {
    if (source[i].includes(needle)) return i + 1;
  }
  return null;
}

function makeSnippet(block: IntentBlock): string {
  const content = (block.content ?? "").replace(/\s+/g, " ").trim();
  const text = content.length > 120 ? `${content.slice(0, 117)}…` : content;
  return text || "(empty)";
}

/**
 * Searches every .it file in the workspace. `read` is injected so the
 * caller can route through the Tauri backend (and so this stays testable).
 */
export async function searchWorkspace(
  files: TreeNode[],
  read: (path: string) => Promise<string>,
  rawQuery: string,
): Promise<SearchSummary> {
  const started = performance.now();
  const { structured, terms } = splitQuery(rawQuery);
  const options = structured ? parseQuery(structured) : null;

  const hits: SearchHit[] = [];
  let filesMatched = 0;
  let totalMatches = 0;
  let parseFailures = 0;

  for (const file of files) {
    if (hits.length >= MAX_HITS) break;
    let source: string;
    try {
      source = await read(file.path);
    } catch {
      parseFailures++;
      continue;
    }

    let blocks: IntentBlock[];
    let title: string | undefined;
    try {
      const doc = parseIntentText(source);
      title = doc.metadata?.title;
      blocks = options ? queryBlocks(doc, options).blocks : doc.blocks;
    } catch {
      parseFailures++;
      continue;
    }

    if (terms.length > 0) {
      blocks = blocks.filter((b) => {
        const text = blockText(b);
        return terms.every((t) => text.includes(t));
      });
    }
    // A pure free-text query should not flood results with every block of
    // every file when the query is empty.
    if (terms.length === 0 && !options) blocks = [];

    if (blocks.length === 0) continue;
    filesMatched++;
    totalMatches += blocks.length;

    const lines = source.split("\n");
    for (const b of blocks.slice(0, 20)) {
      if (hits.length >= MAX_HITS) break;
      hits.push({
        path: file.path,
        relativePath: file.relativePath,
        title,
        blockType: b.keywordAlias ?? b.type,
        snippet: makeSnippet(b),
        line: findLine(lines, b),
      });
    }
  }

  return {
    hits,
    filesScanned: files.length,
    filesMatched,
    totalMatches,
    elapsedMs: Math.round(performance.now() - started),
    parseFailures,
  };
}
