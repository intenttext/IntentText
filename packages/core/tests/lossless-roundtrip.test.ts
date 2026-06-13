// Lossless interchange gate: `.it` TEXT and its JSON model are losslessly
// interchangeable.
//
// Three guarantees, asserted here as a hard gate:
//   1. documentToSource is IDEMPOTENT for valid .it — one pass canonicalizes,
//      every further pass is a no-op.
//   2. The canonical text and its JSON model are PERFECT INVERSES — for a
//      canonical document `doc`, parseIntentText(documentToSource(doc)) deep-
//      equals `doc` (ignoring the volatile `id` field — ids are sequential and
//      regenerated per parse, so they are excluded from equality by design).
//   3. NO INFORMATION LOSS — every block, pipe property, block-level
//      dir/align/style, table, list, trust line (sign/freeze/approve/amendment/
//      certify), and meta survives a round-trip; nothing dropped or merged away.
//      In particular, SEALED documents still verify after a serialize round-trip
//      (the canonical bytes computeDocumentHash sees are unchanged).
//
// Honesty note: the guarantee is canonical-form + information losslessness, NOT
// byte-preservation of *arbitrary* author formatting. The FIRST serialize pass
// may normalize representation (e.g. a markdown `| a | b |` table becomes the
// canonical `headers:`/`row:` form, bare prose gains a `text:` prefix). After
// that one canonicalizing pass, text<->JSON round-trip exactly.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseIntentText, documentToSource } from "../src/index";
import { sealDocument, verifyDocument } from "../src/trust";
import type { IntentDocument } from "../src/types";

const EXAMPLES_DIR = join(__dirname, "..", "..", "..", "examples");

function exampleFiles(): string[] {
  return readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith(".it"));
}

/** Stable JSON of a document, excluding the volatile `id` field. */
function stableJSON(doc: IntentDocument): string {
  return JSON.stringify(doc, (k, v) => (k === "id" ? undefined : v));
}

// ─── Deterministic valid-document corpus ─────────────────────────────────────
// A structured generator that only emits WELL-FORMED .it lines (real keywords,
// valid inline marks, valid pipe props). Deterministic PRNG so any failure
// reproduces from its seed. (The existing fuzz.test.ts covers crash-safety on
// arbitrary byte-soup; this corpus covers the lossless guarantee on valid input.)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(rnd: () => number, a: T[]): T => a[Math.floor(rnd() * a.length)];
const WORDS = [
  "Hello", "World", "عربى", "نص", "Acme", "Project", "Launch", "Review",
  "Final", "Task", "2026-07-01", "42 points",
];
const INLINE = [
  "**bold**", "_italic_", "~strike~", "`code`",
  "[span]{ color: red | weight: bold }", "plain text", "a @mention", "a #tag",
];
function words(rnd: () => number, n: number): string {
  const s: string[] = [];
  for (let i = 0; i < n; i++)
    s.push(rnd() < 0.4 ? pick(rnd, INLINE) : pick(rnd, WORDS));
  return s.join(" ");
}
const LINEGEN: Array<(rnd: () => number) => string> = [
  (rnd) => "title: " + words(rnd, 2),
  (rnd) => "summary: " + words(rnd, 3),
  (rnd) => "section: " + words(rnd, 2),
  (rnd) => "text: " + words(rnd, 1 + Math.floor(rnd() * 4)),
  (rnd) =>
    "task: " + words(rnd, 2) + " | owner: " + pick(rnd, WORDS) +
    " | priority: " + pick(rnd, ["high", "medium", "low"]),
  (rnd) => "done: " + words(rnd, 2) + " | time: 2026-06-05",
  (rnd) => "metric: " + words(rnd, 1) + " | value: " + pick(rnd, WORDS),
  (rnd) => "deadline: " + words(rnd, 2) + " | date: 2026-07-15",
  (rnd) =>
    "info: " + words(rnd, 2) + " | type: " + pick(rnd, ["warning", "tip", "note"]),
  (rnd) => "- " + words(rnd, 2),
  (rnd) => "1. " + words(rnd, 2),
  (rnd) => "quote: " + words(rnd, 3) + " | by: " + pick(rnd, WORDS),
  (rnd) => "meta: | author: " + pick(rnd, WORDS) + " | type: doc",
  (rnd) =>
    "approve: " + words(rnd, 2) + " | by: " + pick(rnd, WORDS) + " | at: 2026-06-10",
  (rnd) =>
    "text: " + words(rnd, 2) + " | align: " + pick(rnd, ["center", "right", "left"]),
  () => "---",
];
function genDoc(rnd: () => number): string {
  const n = 1 + Math.floor(rnd() * 12);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(pick(rnd, LINEGEN)(rnd));
    if (rnd() < 0.4) out.push(""); // random blank lines exercise trivia capture
  }
  return out.join("\n");
}

// ─── Guarantee 1: idempotency ────────────────────────────────────────────────

describe("lossless: documentToSource is idempotent", () => {
  it("is idempotent for every shipped example", () => {
    for (const f of exampleFiles()) {
      const t = readFileSync(join(EXAMPLES_DIR, f), "utf-8");
      const once = documentToSource(parseIntentText(t));
      const twice = documentToSource(parseIntentText(once));
      expect(twice, `non-idempotent: ${f}`).toBe(once);
    }
  });

  it("is idempotent over 3000 generated valid documents", () => {
    for (let seed = 1; seed <= 3000; seed++) {
      const src = genDoc(mulberry32(seed));
      const once = documentToSource(parseIntentText(src));
      const twice = documentToSource(parseIntentText(once));
      if (once !== twice) {
        throw new Error(
          `non-idempotent at seed ${seed}\n--- src ---\n${src}\n--- once ---\n${once}\n--- twice ---\n${twice}`,
        );
      }
    }
  });

  it("canonicalizes the known adjacent-prose-merge case with both aligns intact", () => {
    const src = "text: First | align: center\n\ntext: Second | align: right";
    const once = documentToSource(parseIntentText(src));
    const twice = documentToSource(parseIntentText(once));
    expect(twice).toBe(once);
    const doc = parseIntentText(once);
    const texts = doc.blocks.filter((b) => b.type === "text");
    expect(texts).toHaveLength(2);
    expect(texts[0].properties?.align).toBe("center");
    expect(texts[1].properties?.align).toBe("right");
  });

  it("preserves both properties of two consecutive prose lines (no blank line)", () => {
    // contract-sealed.it relies on this: `text: Monthly fee | end: …` followed
    // immediately (no blank line) by `text: Payment terms | end: …`. The two
    // lines form one paragraph block in the JSON model (the documented prose-
    // merge feature), but the serializer re-splits them losslessly — so BOTH
    // distinct `end:` values survive and the text round-trips byte-for-byte.
    const src =
      "text: Monthly fee | end: 12,000 QAR\ntext: Payment terms | end: Net 14 days";
    const rt = documentToSource(parseIntentText(src));
    expect(rt).toBe(src);
    expect(documentToSource(parseIntentText(rt))).toBe(rt); // idempotent
  });
});

// ─── Guarantee 2: canonical text <-> JSON are perfect inverses ────────────────

describe("lossless: canonical text and JSON are perfect inverses", () => {
  it("parse(serialize(doc)) deep-equals doc for every canonical example", () => {
    for (const f of exampleFiles()) {
      const t = readFileSync(join(EXAMPLES_DIR, f), "utf-8");
      const canon = documentToSource(parseIntentText(t)); // canonicalize once
      const doc = parseIntentText(canon);
      const reparsed = parseIntentText(documentToSource(doc));
      expect(stableJSON(reparsed), `JSON-inverse failed: ${f}`).toBe(
        stableJSON(doc),
      );
    }
  });

  it("parse(serialize(doc)) deep-equals doc over 3000 generated documents", () => {
    for (let seed = 1; seed <= 3000; seed++) {
      const src = genDoc(mulberry32(seed));
      const canon = documentToSource(parseIntentText(src));
      const doc = parseIntentText(canon);
      const reparsed = parseIntentText(documentToSource(doc));
      if (stableJSON(reparsed) !== stableJSON(doc)) {
        throw new Error(`JSON-inverse failed at seed ${seed}\n${canon}`);
      }
    }
  });
});

// ─── Guarantee 3: no information loss (meta + trust survive) ───────────────────

describe("lossless: no information is dropped on round-trip", () => {
  it("re-emits meta: lines lifted into metadata", () => {
    const src =
      "title: Doc\nsummary: S\n\nmeta: | author: Legal | type: contract\n\nsection: Body\ntext: clause";
    const rt = documentToSource(parseIntentText(src));
    expect(rt).toContain("meta: | author: Legal | type: contract");
    const reparsed = parseIntentText(rt);
    expect(reparsed.metadata?.meta).toEqual({
      author: "Legal",
      type: "contract",
    });
  });

  it("re-emits track: lines lifted into metadata", () => {
    const src =
      "title: Plan\ntrack: doc-123 | at: 2026-06-13\nsection: A\ntext: x";
    const rt = documentToSource(parseIntentText(src));
    expect(rt).toContain("track: doc-123 | at: 2026-06-13");
  });

  it("preserves comment lines and blank-line layout verbatim", () => {
    const src =
      "// a comment\ntitle: Doc\n\n// another\nsection: A\ntext: body";
    // Already canonical → byte-stable round-trip.
    expect(documentToSource(parseIntentText(src))).toBe(src);
  });

  it("preserves block-level align/dir/style across a round-trip", () => {
    const src = "text: مرحبا | dir: rtl | align: center";
    const doc = parseIntentText(documentToSource(parseIntentText(src)));
    const t = doc.blocks.find((b) => b.type === "text");
    expect(t?.properties?.dir).toBe("rtl");
    expect(t?.properties?.align).toBe("center");
  });
});

// ─── Critical constraint: sealed documents still verify after round-trip ──────

describe("lossless: sealed/signed documents survive a serialize round-trip", () => {
  it("contract-sealed.it still verifies (intact + signature valid) after round-trip", () => {
    const src = readFileSync(join(EXAMPLES_DIR, "contract-sealed.it"), "utf-8");
    const before = verifyDocument(src);
    expect(before.intact).toBe(true);

    const rt = documentToSource(parseIntentText(src));
    // Byte-identical hashed body → seal must remain intact.
    expect(rt).toBe(src);
    const after = verifyDocument(rt);
    expect(after.intact).toBe(true);
    expect(after.frozen).toBe(true);
    expect(after.signers?.[0]?.valid).toBe(true);
    expect(after.signers?.[0]?.signedCurrentVersion).toBe(true);
  });

  it("a freshly sealed canonical document still verifies after round-trip", () => {
    const raw =
      "title: Test Doc\nsummary: A sealed test.\n\nmeta: | author: QA | type: contract\n\nsection: Body\ntext: First clause\ntext: Second clause | end: detail\n\nsection: More\ntask: Do the thing | owner: Sam | priority: high";
    // Seal over the CANONICAL form (the bytes the round-trip reproduces).
    const canon = documentToSource(parseIntentText(raw));
    const sealed = sealDocument(canon, { signer: "Sam", role: "Owner" }).source;
    expect(verifyDocument(sealed).intact).toBe(true);

    const rt = documentToSource(parseIntentText(sealed));
    expect(rt).toBe(sealed);
    expect(verifyDocument(rt).intact).toBe(true);
  });
});
