/**
 * byte-preservation.test.ts — the moat, proven by property-based testing.
 *
 * We don't claim byte preservation from a handful of examples; we PROVE it over
 * thousands of randomly-generated documents whose properties appear in arbitrary
 * (non-canonical) order — the exact thing that used to break. For every generated
 * document the following invariants must hold:
 *
 *   I1  round-trip:     documentToSource(parseIntentText(src)) === src
 *   I2  idempotent:     serialize(parse(x)) is a fixed point
 *   I3  reconcile no-op: reconcileEdit(src, src) === src
 *   I4  seal survives:  a sealed doc, opened + saved with NO change via reconcileEdit,
 *                       is byte-identical AND still verifies
 *   I5  edit is surgical: changing ONE block leaves every other block's bytes intact
 *
 * If any single seed fails, the test prints the offending source so the case is
 * reproducible. This is the gate that keeps the moat true as the format evolves.
 */

import { describe, it, expect } from "vitest";
import {
  parseIntentText,
  documentToSource,
  reconcileEdit,
  sealDocument,
  verifyDocument,
} from "../src/index";

// Deterministic PRNG (no Math.random — reproducible failures).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rnd: () => number, xs: T[]): T => xs[Math.floor(rnd() * xs.length)];
const WORDS = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf"];
const word = (rnd: () => number) => pick(rnd, WORDS);
const phrase = (rnd: () => number, n = 3) =>
  Array.from({ length: 1 + Math.floor(rnd() * n) }, () => word(rnd)).join(" ");

/**
 * Property pool per keyword. The generator picks a RANDOM SUBSET in RANDOM ORDER,
 * so author property order is exercised exhaustively. We deliberately avoid the
 * keywords/props that carry intentional normalization (injected status defaults,
 * the toc title/depth defaults) — those are documented non-byte-preserving cases
 * tested elsewhere; here we assert the guarantee for the everyday surface.
 */
const PROP_KEYWORDS: Array<{ kw: string; props: Array<[string, (r: () => number) => string]> }> = [
  { kw: "metric", props: [["value", (r) => String(Math.floor(r() * 100000))], ["unit", word], ["key", word], ["trend", () => "up"]] },
  { kw: "info", props: [["type", () => pick(() => 0.5, ["warning", "danger", "tip", "success"])], ["color", () => "#dc2626"]] },
  { kw: "contact", props: [["role", word], ["email", () => "a@b.com"], ["phone", () => "123"], ["org", word]] },
  { kw: "approve", props: [["by", word], ["role", word], ["at", () => "2026-06-10"], ["ref", word]] },
  { kw: "task", props: [["owner", word], ["due", () => "2026-07-01"], ["priority", () => "high"]] },
  { kw: "text", props: [["color", () => "#111"], ["weight", () => "bold"], ["align", () => pick(() => 0.5, ["left", "center", "right"])]] },
  { kw: "image", props: [["src", () => "./x.png"], ["caption", word], ["width", () => "50%"]] },
  { kw: "link", props: [["to", () => "https://x.example"], ["title", word]] },
  { kw: "quote", props: [["by", word]] },
  { kw: "deadline", props: [["date", () => "2026-09-01"], ["owner", word]] },
];

function genPropLine(rnd: () => number): string {
  const spec = pick(rnd, PROP_KEYWORDS);
  // random subset, random order
  const shuffled = [...spec.props].sort(() => rnd() - 0.5);
  const count = 1 + Math.floor(rnd() * shuffled.length);
  const chosen = shuffled.slice(0, count);
  const propStr = chosen.map(([k, gen]) => `${k}: ${gen(rnd)}`).join(" | ");
  return `${spec.kw}: ${phrase(rnd)} | ${propStr}`;
}

// Keywords whose parser INJECTS a default into the model (status/join/level/toc
// depth+title). These are the trickiest for byte preservation: a BARE line must
// drop the injected default, while an EXPLICITLY-written same value must survive.
// We fuzz all three shapes: bare, explicit-default, explicit-non-default.
const INJECT_LINES: Array<(r: () => number) => string> = [
  (r) => `step: ${phrase(r)}`,
  (r) => `step: ${phrase(r)} | status: pending`,
  (r) => `step: ${phrase(r)} | status: running`,
  (r) => `done: ${phrase(r)}`,
  (r) => `done: ${phrase(r)} | owner: ${word(r)}`,
  (r) => `wait: ${phrase(r)}`,
  (r) => `wait: ${phrase(r)} | status: waiting`,
  (r) => `result: ${phrase(r)}`,
  (r) => `gate: ${phrase(r)}`,
  (r) => `parallel: ${phrase(r)}`,
  (r) => `parallel: ${phrase(r)} | join: all`,
  (r) => `signal: ${phrase(r)}`,
  () => `toc:`,
  (r) => `toc: | depth: ${1 + Math.floor(r() * 5)}`,
  (r) => `toc: | title: ${phrase(r)}`,
  () => `toc: | depth: 2 | title: Contents`,
];

// Body lines only. Document METADATA (title:/summary:/meta:/page:/header:/footer:)
// is intentionally hoisted to a canonical position by the serializer, so a realistic
// document carries it at the top — never scattered mid-body. The generator mirrors how
// documents are actually authored: an optional metadata header, then a content body.
const SIMPLE_LINES: Array<(r: () => number) => string> = [
  (r) => `section: ${phrase(r)}`,
  (r) => `sub: ${phrase(r)}`,
  (r) => `${phrase(r, 6)}`, // bare prose
  () => `---`,
];

function genDoc(rnd: () => number): string {
  const out: string[] = [];
  if (rnd() < 0.8) out.push(`title: ${phrase(rnd)}`);
  if (rnd() < 0.5) out.push(`summary: ${phrase(rnd, 5)}`);
  const n = 1 + Math.floor(rnd() * 14);
  for (let i = 0; i < n; i++) {
    const roll = rnd();
    out.push(
      roll < 0.45
        ? genPropLine(rnd)
        : roll < 0.75
          ? pick(rnd, INJECT_LINES)(rnd)
          : pick(rnd, SIMPLE_LINES)(rnd),
    );
    if (rnd() < 0.3) out.push(""); // blank lines exercise trivia
  }
  return out.join("\n") + "\n";
}

describe("byte preservation — property-based (the moat)", () => {
  const SEEDS = 6000;

  it(`I1 round-trip: documentToSource(parse(src)) === src  (${SEEDS} random docs, arbitrary prop order)`, () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const src = genDoc(mulberry32(seed));
      const round = documentToSource(parseIntentText(src));
      if (round !== src) {
        throw new Error(`round-trip broke at seed ${seed}\n--- src ---\n${src}\n--- round ---\n${round}`);
      }
    }
  });

  it(`I2 idempotent + I3 reconcileEdit(src, src) === src  (${SEEDS} random docs)`, () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const src = genDoc(mulberry32(seed));
      const once = documentToSource(parseIntentText(src));
      const twice = documentToSource(parseIntentText(once));
      if (once !== twice) throw new Error(`non-idempotent at seed ${seed}\n${once}\n---\n${twice}`);
      const reconciled = reconcileEdit(src, src);
      if (reconciled !== src) throw new Error(`reconcile no-op broke at seed ${seed}\n--- src ---\n${src}\n--- out ---\n${reconciled}`);
    }
  });

  it("I4 a sealed document, opened + saved with no change, keeps its bytes AND its seal", () => {
    for (let seed = 1; seed <= 1500; seed++) {
      const src = genDoc(mulberry32(seed));
      const sealed = sealDocument(src, { signer: "Tester", role: "QA" }).source;
      expect(verifyDocument(sealed).intact, `seed ${seed}: fresh seal should verify`).toBe(true);
      const saved = reconcileEdit(sealed, sealed);
      expect(saved, `seed ${seed}: no-op save must be byte-identical`).toBe(sealed);
      expect(verifyDocument(saved).intact, `seed ${seed}: seal must survive a no-op save`).toBe(true);
    }
  });

  it("I5 editing one block leaves every other block's bytes intact (surgical edits)", () => {
    for (let seed = 1; seed <= 1500; seed++) {
      const src = documentToSource(parseIntentText(genDoc(mulberry32(seed))));
      const lines = src.split("\n");
      const editable = lines
        .map((l, i) => i)
        .filter((i) => lines[i].startsWith("title:") || lines[i].startsWith("section:"));
      if (editable.length === 0) continue;
      const target = editable[Math.floor(mulberry32(seed * 7)() * editable.length)];
      const edited = [...lines];
      edited[target] = edited[target] + " EDITED";
      const editedSrc = edited.join("\n");
      const reconciled = reconcileEdit(src, editedSrc);
      // Every NON-edited original line must still be present verbatim.
      for (let i = 0; i < lines.length; i++) {
        if (i === target || lines[i].trim() === "") continue;
        expect(reconciled, `seed ${seed}: untouched line ${i} lost its bytes`).toContain(lines[i]);
      }
    }
  });
});
