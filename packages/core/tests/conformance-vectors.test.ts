import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  parseIntentText,
  documentToSource,
  computeDocumentHash,
  computeAppearanceHash,
  checkConformance,
  SEAL_SPEC,
} from "../src/index";

/**
 * Freeze enforcement: re-derive every conformance vector from its source and assert it matches
 * the committed golden byte-for-byte. Any change to the parser, serializer, hash canonicalizer,
 * or conformance checker that alters output fails here. The same `conformance/vectors.json` is
 * the portable spec a future binding (Rust→WASM, etc.) must reproduce.
 *
 * Regenerate intentionally with: `node scripts/gen-conformance-vectors.mjs`
 */
const artifact = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../conformance/vectors.json", import.meta.url)),
    "utf8",
  ),
);

// must match clean() in scripts/gen-conformance-vectors.mjs
function clean(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      if (k === "id" || k.startsWith("_")) continue;
      out[k] = clean((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return v;
}

describe("Conformance vectors (freeze enforcement)", () => {
  it("artifact targets the current SEAL_SPEC", () => {
    expect(artifact.sealSpec).toBe(SEAL_SPEC);
    expect(artifact.vectors.length).toBeGreaterThan(0);
  });

  for (const vec of artifact.vectors) {
    it(`reproduces vector: ${vec.name}`, () => {
      const doc = parseIntentText(vec.source);
      // semantic model (volatile id + internal _trivia stripped)
      expect(clean(doc.blocks)).toEqual(vec.blocks);
      expect(clean(doc.metadata ?? {})).toEqual(vec.metadata);
      // byte round-trip
      expect(documentToSource(doc)).toBe(vec.serialized);
      // seal hashes (the trust-critical canonicalization)
      expect(computeDocumentHash(vec.source)).toBe(vec.contentHash);
      expect(computeAppearanceHash(vec.source)).toBe(vec.appearanceHash);
      // conformance
      const strict = checkConformance(vec.source, { level: "strict" });
      expect(checkConformance(vec.source, { level: "lax" }).conformant).toBe(
        vec.lax,
      );
      expect(strict.conformant).toBe(vec.strict);
      expect(
        [...new Set((strict.issues ?? []).map((i: { code: string }) => i.code))].sort(),
      ).toEqual(vec.issues);
    });
  }
});
