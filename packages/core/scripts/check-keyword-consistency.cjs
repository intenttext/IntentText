#!/usr/bin/env node
/**
 * Keyword consistency check — ensures the LANGUAGE_REGISTRY (canonical +
 * extension keywords) stays in sync with the BlockType union in types.ts.
 *
 * Run: node scripts/check-keyword-consistency.cjs
 * Called by CI after build.
 *
 * Rules enforced:
 *   1. Every canonical keyword must appear as a string literal in BlockType.
 *   2. Every extension keyword that emits a real block type must appear in BlockType.
 *   3. Every string literal in BlockType (excluding internal types) must be
 *      registered in the registry.
 *
 * "Internal" block types are those never written by users — they arise from syntax
 * (list bullets, triple-dash, x-* prefix):
 *   list-item, step-item, body-text, divider, table, extension, custom
 */

const fs = require("node:fs");
const path = require("node:path");

const INTERNAL_TYPES = new Set([
  "list-item",
  "step-item",
  "body-text",
  "divider",
  "table",
  "extension",
  "custom",
]);

// ── 1. Load the built registry ───────────────────────────────────────────────

const distIndex = path.join(__dirname, "..", "dist", "index.js");
if (!fs.existsSync(distIndex)) {
  console.error("dist/index.js not found — run build first.");
  process.exit(1);
}

const core = require(distIndex);
const canonicalKeywords = new Set(core.CANONICAL_KEYWORDS || []);

// Extension keywords: loaded from EXTENSION_REGISTRY via dist
// We derive them by looking for any keyword the registry knows about that is NOT
// canonical and NOT boundary/compat — those map to real block types.
const distRegistryPath = path.join(
  __dirname,
  "..",
  "dist",
  "language-registry.js",
);
const reg = require(distRegistryPath);

const extensionKeywords = new Set(
  (reg.EXTENSION_REGISTRY || []).map((e) => e.keyword),
);

// v2-range keywords that emit their own block type but aren't in canonical/extension
// These are hardcoded in the parser (agentic workflow, doc-gen, v2.11 expansion)
// We derive them from dist/types.js via INTERNAL_BLOCK_TYPES and then compare
// against the full BlockType union parsed from source.
const registeredKeywords = new Set([
  ...canonicalKeywords,
  ...extensionKeywords,
]);

// ── 2. Parse BlockType union from types.ts source ───────────────────────────

const typesSource = fs.readFileSync(
  path.join(__dirname, "..", "src", "types.ts"),
  "utf8",
);

// Extract string literals from the BlockType union
const blockTypeMatch = typesSource.match(/export type BlockType\s*=([^;]+);/s);
if (!blockTypeMatch) {
  console.error("Could not locate BlockType union in src/types.ts");
  process.exit(1);
}

const blockTypeBody = blockTypeMatch[1];
const blockTypeLiterals = new Set(
  [...blockTypeBody.matchAll(/"([^"]+)"/g)].map((m) => m[1]),
);

// ── 3. Check consistency ─────────────────────────────────────────────────────

const failures = [];

// Rule 1: every canonical keyword → must have a BlockType entry
for (const kw of canonicalKeywords) {
  if (!blockTypeLiterals.has(kw) && !INTERNAL_TYPES.has(kw)) {
    failures.push(
      `CANONICAL keyword "${kw}" is missing from the BlockType union in types.ts`,
    );
  }
}

// Rule 2: every extension keyword → must have a BlockType entry
for (const kw of extensionKeywords) {
  if (!blockTypeLiterals.has(kw) && !INTERNAL_TYPES.has(kw)) {
    failures.push(
      `EXTENSION keyword "${kw}" is missing from the BlockType union in types.ts`,
    );
  }
}

// Rule 3: every non-internal BlockType literal → must be in some registry
for (const lit of blockTypeLiterals) {
  if (!INTERNAL_TYPES.has(lit) && !registeredKeywords.has(lit)) {
    failures.push(
      `BlockType "${lit}" has no corresponding registry entry in LANGUAGE_REGISTRY or EXTENSION_REGISTRY`,
    );
  }
}

// Rule 4: the published canonical keyword count is EXACTLY 38 (FORMAT-REVIEW T-06).
// The source-of-truth count must never silently drift from what the docs/marketing
// state. Bump this number here — and in every doc/comment that states it — in the
// SAME commit that changes the canonical set. That is the point of the gate.
const EXPECTED_CANONICAL_COUNT = 41;
const actualCount = canonicalKeywords.size;
if (actualCount !== EXPECTED_CANONICAL_COUNT) {
  failures.push(
    `Canonical keyword count is ${actualCount}, expected ${EXPECTED_CANONICAL_COUNT}. ` +
      `If intentional, update EXPECTED_CANONICAL_COUNT here AND every doc/comment that ` +
      `states the count (registry header, SPEC.md, AGENTS.md, keywords/index.md).`,
  );
}
if (typeof core.KEYWORD_COUNT === "number" && core.KEYWORD_COUNT !== actualCount) {
  failures.push(
    `KEYWORD_COUNT (${core.KEYWORD_COUNT}) disagrees with CANONICAL_KEYWORDS.length (${actualCount}).`,
  );
}

// ── 4. Report ────────────────────────────────────────────────────────────────

if (failures.length > 0) {
  console.error("Keyword consistency check FAILED:");
  for (const f of failures) {
    console.error(`  ✗ ${f}`);
  }
  console.error(
    `\nFix: add missing entries to src/language-registry.ts or src/types.ts.`,
  );
  process.exit(1);
}

console.log(
  `Keyword consistency check passed (${canonicalKeywords.size} canonical, ` +
    `${extensionKeywords.size} extension, ${blockTypeLiterals.size} BlockType entries).`,
);
