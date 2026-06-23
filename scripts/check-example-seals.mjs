// Guard: every SEALED example (an .it with a `freeze:` line) under examples/ must still
// verify INTACT. check-examples.mjs is parse-only, so it cannot catch a sealed demo whose
// content has drifted from its hash — this gate does. (FORMAT-ROADMAP T-18.)
//
//   node scripts/check-example-seals.mjs   (requires a built core)
//
// Scope: examples/ + demo/ — every sealed .it (one with a `freeze:` line) must verify intact.

import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyDocument } from "../packages/core/dist/index.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const scanDirs = [join(root, "examples"), join(root, "demo")];

function walk(dir, acc) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== "node_modules" && name !== "dist") walk(p, acc);
    } else if (name.endsWith(".it")) acc.push(p);
  }
  return acc;
}

const failures = [];
let sealed = 0;

for (const file of scanDirs.flatMap((d) => walk(d, []))) {
  const src = readFileSync(file, "utf8");
  if (!/^freeze:/m.test(src)) continue; // only sealed (frozen) documents
  sealed++;
  const result = verifyDocument(src);
  if (!result.intact) {
    failures.push(
      `${relative(root, file)} — sealed but does NOT verify intact (the content drifted from its hash)`,
    );
  }
}

if (failures.length > 0) {
  console.error("Example seal check FAILED:");
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(
    "\nA sealed example must verify intact. Re-seal it (dotit seal) or fix the drift.",
  );
  process.exit(1);
}

console.log(`Example seal check passed (${sealed} sealed examples verify intact).`);
