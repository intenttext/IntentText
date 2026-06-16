// Hardening, wave 2: the NEW feature surface (forms, redline, compare, merge,
// redaction, attachments, field-logic, form-trust) must also NEVER throw on
// arbitrary input — plus a perf budget and a serialization-fixpoint property.
//
// Same deterministic PRNG as fuzz.test.ts so failures reproduce from the seed.
import { describe, it, expect } from "vitest";
import {
  parseIntentText,
  parseAndMerge,
  documentToSource,
  renderHTML,
  // new feature surface
  extractFormFields,
  isFormComplete,
  formAnswers,
  formVisibility,
  computeFormValues,
  applyComputedValues,
  applyAnswers,
  hasTrackedChanges,
  extractChanges,
  acceptChanges,
  rejectChanges,
  extractComments,
  compareVersions,
  mergeThreeWay,
  applyRedactions,
  extractRedactions,
  extractAttachments,
  sealFormStructure,
  verifyFormStructure,
} from "../src/index";

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fragments biased toward the NEW syntaxes (spans, form fields, attachments, math).
const FRAGMENTS = [
  "meta: | type: form", "input: L | key: k | type: text | required: yes",
  "input: C | key: c | type: choice | options: a, b", "input: N | key: n | type: number | value: 3",
  "input: X | key: x | show-if: c = a", "input: T | key: t | compute: n * 2",
  "input: A | key: a | type: attachment | value: f.pdf",
  "attach: a | name: f.pdf | mime: application/pdf | data: SGk=",
  "text: [old]{track: del; by: X}", "text: [new]{track: ins; by: Y}",
  "text: [c]{comment: k1}", "comment: hi | id: k1 | by: Z",
  "text: [s]{redact: pii}", "[████]{redacted: pii; id: r1; commit: sha256:ab}",
  "math: E = mc^2", "text: [x^2]{math: tex}", "[a]{input: a; type: text}",
  "row: a | < | c", "row: ^ | b", "value: {{x}}", "| end: 5", "]{", "}{", "[[",
];

function randomFormish(rnd: () => number): string {
  const n = 1 + Math.floor(rnd() * 14);
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(FRAGMENTS[Math.floor(rnd() * FRAGMENTS.length)]);
  return out.join("\n");
}

/** Run every new-feature API; none may throw. */
function newApiPipeline(src: string, other: string) {
  extractFormFields(src);
  isFormComplete(src);
  formAnswers(src);
  formVisibility(src);
  computeFormValues(src);
  applyComputedValues(src);
  applyAnswers(src, { k: "v", c: "a", n: "2", x: "y" });
  hasTrackedChanges(src);
  extractChanges(src);
  acceptChanges(src);
  rejectChanges(src);
  extractComments(src);
  compareVersions(src, other);
  acceptChanges(compareVersions(src, other));
  mergeThreeWay(src, other, src);
  applyRedactions(src);
  extractRedactions(src);
  extractAttachments(src);
  const fs = sealFormStructure(src, { sealer: "X" });
  verifyFormStructure(fs.source);
  // the outputs must themselves parse + render safely
  renderHTML(parseIntentText(applyRedactions(src).source));
}

describe("fuzz wave 2: the new feature surface never throws", () => {
  it("survives 600 random form/redline/redaction/math documents", () => {
    let prev = "text: seed";
    for (let seed = 1; seed <= 600; seed++) {
      const rnd = mulberry32(seed + 7000);
      const src = randomFormish(rnd);
      try {
        newApiPipeline(src, prev);
      } catch (e) {
        throw new Error(`new-API pipeline threw at seed ${seed}: ${(e as Error).message}\n--- doc ---\n${src.slice(0, 400)}`);
      }
      prev = src;
    }
  });

  it("merge fuzzing — hostile values dropped into template positions never throw", () => {
    const template = "title: {{t}}\nmeta: | x: {{m}}\ntext: [{{a}}]{input: a}\nattach: k | name: {{n}} | data: {{d}}";
    const hostile = ["]{", "}{", "| end:", "{{x}}", "<script>", "‮", "sha256:x", "─".repeat(300), "", "\n\n", "a|b|c"];
    for (const v of hostile) {
      const data = { t: v, m: v, a: v, n: v, d: v };
      expect(() => {
        const merged = documentToSource(parseAndMerge(template, data, { missing: "blank" }));
        newApiPipeline(merged, template);
      }).not.toThrow();
    }
  });

  it("seal-structure → fill → verify is tamper-evident under fuzz", () => {
    const form = "meta: | type: form\ninput: Name | key: name | type: text | required: yes";
    const { source: sealed } = sealFormStructure(form, { sealer: "HR" });
    expect(verifyFormStructure(sealed).intact).toBe(true);
    // any structural edit (a new field) breaks it; answers don't
    expect(verifyFormStructure(applyAnswers(sealed, { name: "Sara" })).intact).toBe(true);
    expect(verifyFormStructure(sealed + "\ninput: Sneaky | key: s | type: text").intact).toBe(false);
  });
});

describe("perf budget", () => {
  it("parses + serializes a ~1MB document well under 3s", () => {
    const block = "section: S\ntext: The quick brown fox jumps over the lazy dog. 1,234.56\ntable:\nheaders: A | B\nrow: x | y\n";
    let big = "title: Big\n";
    while (big.length < 1_000_000) big += block;
    const t0 = Date.now();
    const doc = parseIntentText(big);
    documentToSource(doc);
    const ms = Date.now() - t0;
    expect(big.length).toBeGreaterThan(900_000);
    expect(ms).toBeLessThan(3000); // generous; flags a quadratic-blowup regression
  });
});

describe("serialization fixpoint property", () => {
  const rt = (s: string) => documentToSource(parseIntentText(s));

  it("serialization converges to a fixpoint within 2 passes (no infinite oscillation)", () => {
    // The FIRST pass may normalize structure (e.g. a bare `| end:` line becomes the
    // canonical two-sided form); from the CANONICAL form onward, round-trip is a true
    // fixpoint — so a document sealed in canonical form keeps its hash. This guards
    // against an infinite flip-flop (which would break that guarantee).
    let converged1 = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const rnd = mulberry32(seed + 4242);
      const src = randomFormish(rnd);
      const c1 = rt(src);
      const c2 = rt(c1);
      const c3 = rt(c2);
      // the canonical form (reached by the 2nd pass) is a TRUE fixpoint
      expect(c3).toBe(c2);
      if (c2 === c1) converged1++;
    }
    // the vast majority canonicalize in a single pass; the rest in two
    expect(converged1).toBeGreaterThan(300);
  });

  it("a canonicalized real document round-trips byte-identically (hash-stable)", () => {
    const doc = rt(`title: Service Agreement
meta: | author: Legal | type: contract
section: Terms
text: The fee is 1,200 USD per month.
table:
headers: Item | Qty | Amount
row: Consulting | 10 | 12,000
input: Signed by | key: signer | type: signature`);
    expect(rt(doc)).toBe(doc); // canonical → stable
  });
});
