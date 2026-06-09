#!/usr/bin/env node
/**
 * Cross-consumer keyword parity gate.
 *
 * The TS LANGUAGE_REGISTRY is the single source of truth for the keyword
 * contract. Downstream consumers must not drift from it. This gate enforces:
 *
 *   DRIFT GUARD    — every keyword the VSCode grammar highlights must be a
 *                    keyword the core actually recognizes. Catches a grammar
 *                    referencing a keyword the registry dropped or misspelled.
 *
 *   COVERAGE GUARD — every public (canonical, user-facing) keyword must be
 *                    highlightable by the VSCode grammar. Catches a new core
 *                    keyword that nobody added syntax highlighting for.
 *
 * Run: node scripts/check-consumer-parity.cjs   (requires a built core)
 */

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const repoRoot = path.join(root, "..", "..");

// ── 1. Source of truth: the built registry ──────────────────────────────────
const distIndex = path.join(root, "dist", "index.js");
if (!fs.existsSync(distIndex)) {
  console.error("dist/index.js not found — run `pnpm build` in packages/core first.");
  process.exit(1);
}
const core = require(distIndex);
const reg = require(path.join(root, "dist", "language-registry.js"));

const recognizedInput = new Set([
  ...(core.KEYWORDS || []),
  ...((reg.EXTENSION_REGISTRY || []).map((e) => e.keyword)),
]);
// CANONICAL_KEYWORDS is the flat string list of user-facing canonical keywords.
const publicKeywords = new Set(core.CANONICAL_KEYWORDS || []);

// Grammar tokens that are NOT keywords (structural / syntax aliases that the
// grammar may legitimately match but the registry does not list as input words).
const NON_KEYWORD_GRAMMAR_TOKENS = new Set([]);

// ── 2. Extract keyword tokens from the VSCode grammar ───────────────────────
const grammarPath = path.join(
  repoRoot,
  "packages",
  "vscode",
  "syntaxes",
  "intenttext.tmLanguage.json",
);
if (!fs.existsSync(grammarPath)) {
  console.error(`VSCode grammar not found at ${grammarPath}`);
  process.exit(1);
}

const grammarText = fs.readFileSync(grammarPath, "utf8");

// Collect every "match": "..." string, then pull the keyword alternation that
// precedes the "(:)" colon capture, e.g. ^(title|summary)(:)\s*(.*)
const grammarKeywords = new Set();
for (const m of grammarText.matchAll(/"match"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) {
  const pattern = m[1];
  // Find a group immediately followed by the colon capture group.
  const kwGroup = pattern.match(/\(([a-z0-9|+\-]+)\)\(:\)/i);
  if (!kwGroup) continue;
  for (const tok of kwGroup[1].split("|")) {
    if (tok) grammarKeywords.add(tok);
  }
}

if (grammarKeywords.size === 0) {
  console.error("No keyword tokens extracted from the grammar — pattern shape changed?");
  process.exit(1);
}

// ── 3. Check parity ─────────────────────────────────────────────────────────
const failures = [];

// DRIFT: grammar highlights a keyword the core does not recognize.
for (const kw of grammarKeywords) {
  if (!recognizedInput.has(kw) && !NON_KEYWORD_GRAMMAR_TOKENS.has(kw)) {
    failures.push(
      `VSCode grammar highlights "${kw}:" but the core does not recognize it ` +
        `(not in KEYWORDS/EXTENSION_REGISTRY).`,
    );
  }
}

// COVERAGE: a public keyword the grammar never highlights.
for (const kw of publicKeywords) {
  if (!grammarKeywords.has(kw)) {
    failures.push(
      `Public keyword "${kw}:" is not highlighted by the VSCode grammar ` +
        `(add it to packages/vscode/syntaxes/intenttext.tmLanguage.json).`,
    );
  }
}

// ── 4. Report ───────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error("Consumer parity check FAILED:");
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(
    "\nThe TS LANGUAGE_REGISTRY is canonical. Update the VSCode grammar to match it.",
  );
  process.exit(1);
}

console.log(
  `Consumer parity check passed (${grammarKeywords.size} grammar keywords, ` +
    `${publicKeywords.size} public keywords, all aligned with the registry).`,
);
