// Guard: every example .it file must parse cleanly — no deprecation warnings,
// unknown keywords, or parse errors. This is what the VSCode extension surfaces,
// so a clean run here means examples never show squiggles to users.
//
//   node scripts/check-examples.mjs   (requires a built core)
//
// Benign info-level template placeholders ({{var}}) are allowed.

import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseIntentText,
  parseIntentTextSafe,
} from "../packages/core/dist/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const files = [];
function walk(d) {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith(".it")) files.push(p);
  }
}
// Scan shipped example + demo docs — both are user-facing and must stay clean.
walk(join(root, "examples"));
walk(join(root, "demo"));

// Codes that are informational, not problems.
const ALLOW = new Set(["TEMPLATE_HAS_UNRESOLVED"]);

let failed = 0;
for (const file of files.sort()) {
  const src = readFileSync(file, "utf8");
  const doc = parseIntentText(src);
  const safe = parseIntentTextSafe(src);
  const issues = [];
  for (const d of doc.diagnostics ?? [])
    if (d.code && !ALLOW.has(d.code)) issues.push(`[${d.code}] ${d.message}`);
  for (const w of safe.warnings ?? [])
    if (!ALLOW.has(w.code)) issues.push(`[${w.code ?? "warning"}] ${w.message}`);
  for (const e of safe.errors ?? []) issues.push(`[error] ${e.message}`);

  if (issues.length) {
    failed += issues.length;
    console.error(`✗ ${file.replace(root + "/", "")}`);
    for (const i of issues) console.error(`    ${i}`);
  }
}

if (failed > 0) {
  console.error(
    `\nExample check FAILED (${failed} issue(s)). Fix the example syntax — ` +
      `these are exactly the warnings the VSCode extension shows users.`,
  );
  process.exit(1);
}
console.log(`Example check passed (${files.length} .it files, all clean).`);
