/**
 * roundtrip-corpus.test.ts — REAL round-trip gate over every `.it` we ship.
 *
 * Unlike lossless-roundtrip.test.ts (top-level examples only), this walks the WHOLE
 * examples/ tree (incl. examples/templates/) and, per file, asserts the four
 * properties that matter in production:
 *   1. CANONICAL IDEMPOTENCE — documentToSource(parse(x)) is a fixpoint after one pass.
 *   2. TEXT↔JSON INVERSE — parse(serialize(doc)) deep-equals doc (id excluded).
 *   3. RENDERS — renderHTML produces non-empty output without throwing.
 *   4. SEAL SURVIVES A ROUND-TRIP — a sealed non-template still verifies after
 *      parse→serialize (the hashed bytes are unchanged). Templates are refused from
 *      sealing by design, so they're checked for round-trip only.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  parseIntentText,
  documentToSource,
  renderHTML,
  sealDocument,
  verifyDocument,
  isTemplate,
} from "../src/index";
import type { IntentDocument } from "../src/types";

const EXAMPLES_DIR = join(__dirname, "..", "..", "..", "examples");

/** Recursively collect every .it path under examples/. */
function allItFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...allItFiles(full));
    else if (name.endsWith(".it")) out.push(full);
  }
  return out;
}

/** Stable JSON excluding the volatile sequential `id`. */
function stableJSON(doc: IntentDocument): string {
  return JSON.stringify(doc, (k, v) => (k === "id" ? undefined : v));
}

const files = allItFiles(EXAMPLES_DIR);

describe("round-trip corpus — every shipped .it", () => {
  it("found a non-trivial corpus (incl. templates/)", () => {
    expect(files.length).toBeGreaterThanOrEqual(15);
    expect(files.some((f) => f.includes("templates"))).toBe(true);
  });

  for (const file of files) {
    const rel = file.slice(EXAMPLES_DIR.length + 1);
    describe(rel, () => {
      const src = readFileSync(file, "utf8");
      const doc1 = parseIntentText(src);
      const s1 = documentToSource(doc1);
      const doc2 = parseIntentText(s1);
      const s2 = documentToSource(doc2);

      it("canonical serialize is idempotent", () => {
        expect(s2).toBe(s1);
      });

      it("text↔JSON is a perfect inverse (id excluded)", () => {
        expect(stableJSON(parseIntentText(s2))).toBe(stableJSON(doc2));
      });

      it("renders to non-empty HTML without throwing", () => {
        const html = renderHTML(doc1);
        expect(html.length).toBeGreaterThan(0);
        expect(html).toContain("intent-document");
      });

      it("a sealed copy survives a serialize round-trip (or is a refused template)", () => {
        if (isTemplate(src)) {
          // Templates are outside the trust workflow — sealing must be refused.
          expect(() => sealDocument(src, { signer: "QA" })).toThrow();
          return;
        }
        // Seal the CANONICAL form (what the editor/documentToSource emit) — sealing
        // raw author formatting then round-tripping legitimately re-canonicalizes the
        // bytes (e.g. a markdown table → headers:/row:), per SPEC §5.1.
        const canonical = s1;
        const sealed = sealDocument(canonical, { signer: "QA", role: "Tester" }).source;
        expect(verifyDocument(sealed).intact).toBe(true);
        // round-trip the sealed source through parse→serialize; the seal must hold
        const reSerialized = documentToSource(parseIntentText(sealed));
        expect(verifyDocument(reSerialized).intact).toBe(true);
      });
    });
  }
});
