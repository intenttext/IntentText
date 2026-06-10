// Visual round-trip fidelity check.
//
// The live visual editor converts .it source ↔ TipTap JSON via visual/bridge.ts
// (sourceToDoc / docToSource). This harness verifies the round-trip is lossless:
//
//   source → sourceToDoc → docToSource → source'
//   parse(source) and parse(source') must yield the same block types & content.
//
// bridge.ts is type-only on @tiptap/core, so it bundles & runs headless. Bundle it
// first (esbuild), then run this:
//
//   esbuild apps/editor/src/visual/bridge.ts --bundle --format=esm \
//     --platform=node --outfile=/tmp/it-bridge.mjs
//   node apps/editor/scripts/roundtrip-check.mjs
//
// (See package.json "roundtrip:check" which does both.)

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseIntentText, documentToSource } from "@intenttext/core";
// bridge.ts is type-only on @tiptap/core, so Node's type-stripping runs it directly.
import { sourceToDoc, docToSource } from "../src/visual/bridge.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");

// Flatten a parsed doc to a comparable [type:content] signature. List/step bullets
// carry their real block as an inline child — count the bullet, not the child, to
// avoid double-counting (the child is the same content rendered inline).
const INLINE_CHILD = new Set(["list-item", "step-item"]);
const sig = (src) => {
  const flat = [];
  const walk = (bs) => {
    for (const b of bs) {
      flat.push(`${b.type}:${(b.content || "").trim()}`);
      if (b.children && !INLINE_CHILD.has(b.type)) walk(b.children);
    }
  };
  walk(parseIntentText(src).blocks);
  return flat;
};

const corpus = [];
const docsDir = join(repoRoot, "demo/folder-query/docs");
for (const f of readdirSync(docsDir))
  if (f.endsWith(".it")) corpus.push(join(docsDir, f));
for (const f of ["simple.it", "meeting-notes.it"])
  corpus.push(join(repoRoot, "examples", f));

let pass = 0;
const failures = [];
for (const file of corpus) {
  const source = readFileSync(file, "utf8");
  // Baseline = core's own canonical round-trip (core is the source of truth and
  // normalizes some non-semantic input, e.g. a labeled divider → `---`). The visual
  // editor is faithful if it produces the SAME canonical result as core.
  const a = sig(documentToSource(parseIntentText(source)));
  const b = sig(docToSource(sourceToDoc(source)));
  const ok = a.length === b.length && a.every((x, i) => x === b[i]);
  const name = file.split("/").slice(-1)[0];
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}  (${a.length} blocks)`);
  } else {
    failures.push({ name, a, b });
    console.log(`  ✗ ${name}  ${a.length} → ${b.length} blocks`);
  }
}

console.log(`\n${pass}/${corpus.length} documents round-trip losslessly.`);
for (const f of failures) {
  console.log(`\n── ${f.name} ──`);
  const max = Math.max(f.a.length, f.b.length);
  for (let i = 0; i < max; i++) {
    if (f.a[i] !== f.b[i])
      console.log(`  [${i}] ${f.a[i] ?? "—"}   →   ${f.b[i] ?? "—"}`);
  }
}
process.exit(failures.length ? 1 : 0);
