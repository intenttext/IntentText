import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as current from "../src/index";
// The last release before the 3.9 print work — the reference every default must match.
import * as legacy from "dotit-core-legacy";

/**
 * INV-1 — the legacy-output gate. A document that uses none of the new 3.9 syntax or
 * options must come out of every path exactly as it did in 3.8.0: same model, same
 * source bytes, same HTML, same hash. The ONE allowed difference is the print page
 * gutter (`padding:0 1px`), which fixes the clipped right border for everyone.
 *
 * The corpus is every `.it` the repo ships (examples, demo, fixtures, print
 * fixtures) plus every conformance vector source. `examples/test` and
 * `examples/llms` are local, gitignored corpora — included when present.
 */
const ROOT = resolve(fileURLToPath(new URL("../../..", import.meta.url)));

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".it")) out.push(p);
  }
  return out;
}

const corpus: { name: string; source: string }[] = [];
for (const dir of ["examples", "demo", "packages/core/fixtures", "packages/core/tests/print-fixtures"]) {
  for (const f of walk(join(ROOT, dir))) {
    corpus.push({ name: relative(ROOT, f), source: readFileSync(f, "utf8") });
  }
}
const vectors = JSON.parse(
  readFileSync(join(ROOT, "packages/core/conformance/vectors.json"), "utf8"),
);
for (const v of vectors.vectors) corpus.push({ name: `vector:${v.name}`, source: v.source });

/** Drop the volatile block ids so two parses of the same source compare equal. */
function noIds(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(noIds);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as object)) if (k !== "id") out[k] = noIds(val);
    return out;
  }
  return v;
}

// The single allowed renderPrint difference (the gutter that fixes the clipped border).
const GUTTER = ".intent-document{max-width:none;margin:0;padding:0 1px;}";
const OLD_GUTTER = ".intent-document{max-width:none;margin:0;padding:0;}";

describe("INV-1 legacy-output gate: 3.9 == 3.8.0 for every existing document", () => {
  it("has a corpus", () => {
    expect(corpus.length).toBeGreaterThan(50);
  });

  for (const { name, source } of corpus) {
    describe(name, () => {
      const now = current.parseIntentText(source);
      const old = legacy.parseIntentText(source);

      it("parse model is equal", () => {
        expect(noIds(now)).toEqual(noIds(old));
      });
      it("documentToSource is byte-equal", () => {
        expect(current.documentToSource(now)).toBe(legacy.documentToSource(old));
      });
      it("renderHTML is byte-equal", () => {
        expect(current.renderHTML(now)).toBe(legacy.renderHTML(old));
      });
      it("renderPrint is byte-equal apart from the gutter", () => {
        const a = current.renderPrint(now);
        expect(a.includes(GUTTER)).toBe(true);
        expect(a.replace(GUTTER, OLD_GUTTER)).toBe(legacy.renderPrint(old));
      });
      it("renderPrint with a theme is byte-equal apart from the gutter", () => {
        const a = current.renderPrint(now, { theme: "corporate" });
        expect(a.replace(GUTTER, OLD_GUTTER)).toBe(legacy.renderPrint(old, { theme: "corporate" }));
      });
      it("computeDocumentHash is equal, and a sealed document verifies under both", () => {
        expect(current.computeDocumentHash(source)).toBe(legacy.computeDocumentHash(source));
        const v = legacy.verifyDocument(source);
        expect(current.verifyDocument(source).intact).toBe(v.intact);
      });
    });
  }
});
