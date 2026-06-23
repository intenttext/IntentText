#!/usr/bin/env node
/**
 * check-doc-accuracy.cjs — documentation drift gate (FORMAT-ROADMAP T-08).
 *
 * The freeze promise is "one accurate story everywhere." This gate makes it
 * UN-DRIFTABLE: it reads the ground truth from the built @dotit/core (the canonical
 * keyword count and the current SEAL_SPEC) and fails the build if any public doc
 * states a contradicting number. So a future "38 canonical keywords" or
 * "SEAL_SPEC = 3" can never silently ship again.
 *
 * Run: node scripts/check-doc-accuracy.cjs   (core must be built first)
 * Scope: the CURRENT canonical docs only. Dated/historical files are excluded by
 * design (CHANGELOG entries, blog posts, the 2026-06-19 assessment docs) — their
 * point-in-time numbers are correct for their date and must not be rewritten.
 */
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");

// ── Ground truth from the built core ─────────────────────────────────────────
let KEYWORD_COUNT, SEAL_SPEC;
try {
  const core = require(path.join(repoRoot, "packages/core/dist/index.js"));
  KEYWORD_COUNT =
    typeof core.KEYWORD_COUNT === "number"
      ? core.KEYWORD_COUNT
      : Array.isArray(core.CANONICAL_KEYWORDS)
        ? core.CANONICAL_KEYWORDS.length
        : undefined;
  SEAL_SPEC = core.SEAL_SPEC;
  if (SEAL_SPEC == null) {
    SEAL_SPEC = require(path.join(repoRoot, "packages/core/dist/trust.js")).SEAL_SPEC;
  }
} catch (e) {
  console.error("Could not load @dotit/core dist — run `pnpm --filter @dotit/core build` first.");
  console.error(String(e && e.message));
  process.exit(1);
}
if (typeof KEYWORD_COUNT !== "number" || typeof SEAL_SPEC !== "number") {
  console.error(`Ground truth unavailable (KEYWORD_COUNT=${KEYWORD_COUNT}, SEAL_SPEC=${SEAL_SPEC}).`);
  process.exit(1);
}

// ── Files in scope: CURRENT canonical docs (not dated/historical) ────────────
const EXPLICIT_FILES = [
  "README.md",
  "AGENTS.md",
  "INTEGRATION.md",
  "ARCHITECTURE.md",
  "packages/core/SPEC.md",
  "apps/docs/static/llms.txt",
  "apps/docs/static/integration.md",
];
// Recursively include the authored docs site (reference/guides/ecosystem), but NOT
// the generated build, the dated blog, or the docusaurus cache.
const DOC_TREES = ["apps/docs/docs"];
const EXCLUDE_DIR = new Set(["build", ".docusaurus", "node_modules", "blog"]);

function walk(dir, acc) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!EXCLUDE_DIR.has(e.name)) walk(path.join(dir, e.name), acc);
    } else if (/\.(md|mdx)$/.test(e.name)) {
      acc.push(path.join(dir, e.name));
    }
  }
  return acc;
}

const files = [...EXPLICIT_FILES.map((f) => path.join(repoRoot, f))];
for (const t of DOC_TREES) walk(path.join(repoRoot, t), files);

// ── Assertions ───────────────────────────────────────────────────────────────
// "<N> canonical keyword(s)" must equal KEYWORD_COUNT.
const COUNT_RE = /\b(\d+)\s+canonical\s+keyword/gi;
// "SEAL_SPEC … <N>" (=, v, :, space) must equal SEAL_SPEC. Requires the literal
// token SEAL_SPEC right before the digit, so a bare "v3" elsewhere is not flagged.
const SPEC_RE = /SEAL_SPEC[^\d\n]{0,6}(\d+)/gi;

const failures = [];
let scanned = 0;

for (const file of files) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }
  scanned++;
  const rel = path.relative(repoRoot, file);
  const lineOf = (idx) => text.slice(0, idx).split("\n").length;

  let m;
  COUNT_RE.lastIndex = 0;
  while ((m = COUNT_RE.exec(text))) {
    const n = Number(m[1]);
    if (n !== KEYWORD_COUNT) {
      failures.push(`${rel}:${lineOf(m.index)} — "${m[0].trim()}" but the canonical count is ${KEYWORD_COUNT}`);
    }
  }
  SPEC_RE.lastIndex = 0;
  while ((m = SPEC_RE.exec(text))) {
    const n = Number(m[1]);
    if (n !== SEAL_SPEC) {
      failures.push(`${rel}:${lineOf(m.index)} — "${m[0].trim()}" but SEAL_SPEC is ${SEAL_SPEC}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Documentation accuracy check FAILED (truth: ${KEYWORD_COUNT} canonical, SEAL_SPEC ${SEAL_SPEC}):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(`\nFix the doc to match the code, or (if the code changed) update the code + every doc in the same commit.`);
  process.exit(1);
}

console.log(
  `Documentation accuracy check passed (${scanned} docs; ${KEYWORD_COUNT} canonical, SEAL_SPEC ${SEAL_SPEC} — no contradicting literals).`,
);
