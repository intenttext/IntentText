#!/usr/bin/env node
/**
 * Conformance vector generator — the freeze's enforcement artifact.
 *
 * For each input `.it` source it records the canonical outputs of @dotit/core:
 *   - blocks:        parsed model (volatile `id` + internal `_trivia` stripped) — semantic lock
 *   - metadata:      document metadata
 *   - serialized:    documentToSource(parse(src)) — byte round-trip lock
 *   - contentHash:   computeDocumentHash(src)      — seal content hash (SEAL_SPEC 4)
 *   - appearanceHash:computeAppearanceHash(src)    — seal appearance hash
 *   - lax / strict:  checkConformance(...).conformant
 *   - issues:        sorted unique conformance issue codes (strict)
 *
 * The emitted vectors.json is:
 *   1. a REGRESSION LOCK for the TS core (tests/conformance-vectors.test.ts re-derives and
 *      asserts byte-equality — any parser/hash/serialize change fails CI), and
 *   2. the PORTABLE SPEC any future binding (Rust→WASM, etc.) must reproduce byte-for-byte.
 *
 * Deterministic: no timestamps / versions baked in, so re-running only changes the file when
 * the core's BEHAVIOR changes. Run: `node scripts/gen-conformance-vectors.mjs`
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as core from "../dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "conformance");
const CRLF = (s) => s.replace(/\n/g, "\r\n");

// ── The corpus: small, deliberate inputs covering the whole surface ──────────────
const CORPUS = [
  ["minimal", `title: Hello\n\nA bare paragraph — no keyword needed.`],
  ["core-blocks", `title: Doc\nsummary: A subtitle\nsection: Scope\nsub: Details\ninfo: Heads up | type: warning\nquote: Stay hungry | by: Jobs\nlink: Docs | to: https://example.com\nimage: Logo | src: logo.png | caption: Our logo`],
  ["tasks", `title: Plan\ntask: Ship auth | owner: Ahmed | due: 2026-07-01 | priority: high\ndone: Deploy staging | at: 2026-03-01`],
  ["lists", `section: Items\n- one\n- two\n1. first\n2. second`],
  ["table-keywords", `headers: Item | Qty | Total\nrow: Hosting | 12 | 10800\nrow: Support | 4 | 3600`],
  ["table-markdown", `| Name | Age |\n| Ahmed | 30 |\n| Sara | 25 |`],
  ["metric-total", `metric: Total Due | value: 17325 | unit: QAR`],
  ["metric-kpi", `metric: IRR | value: 14.2% | target: 12% | trend: up | period: 10 years`],
  ["agent-workflow", `title: Onboarding\ntrigger: New form | id: t1\nstep: Validate | tool: validate | id: s1\ndecision: Valid? | then: s2 | else: s3\nstep: Provision | tool: infra | id: s2\nstep: Notify | tool: email | id: s3\nresult: Done | status: success`],
  ["agent-extra", `policy: Auto-approve | if: amount < 1000 | action: approve\naudit: Reviewed by ops | at: 2026-03-09T10:00:00Z\ncontext: region | value: gulf\nask: Do we need SSO for launch?`],
  ["inline-native", `text: see *bold* and _italic_ and ~strike~ and \`code\` and [label](https://x.io) and @ahmed #urgent`],
  ["inline-md-compat", `text: **bold** and __also bold__ and ~~struck~~ here`],
  ["bare-prose-multi", `title: Notes\n\nFirst paragraph of plain prose.\n\nSecond paragraph, still bare.`],
  ["rtl-arabic", `عنوان: عرض سعر\nقسم: البنود\nمهمة: مراجعة العرض | owner: أحمد | due: 2026-06-20`],
  ["custom-keywords", `clause: No refunds after 30 days | ref: 4.2\nrisk: Vendor lock-in | sev: high\nمصروف: كراسي مكتب | فئة: أثاث`],
  ["two-sided", `text: Customer Name | end: 2026-06-12\ntext: IBAN | end: QA57QNBA000000000123456789001`],
  ["styled-span", `text: Payment is [overdue]{ color: #c00; weight: bold } — act now.`],
  ["template", `title: {{client.name}} Invoice\nheaders: Item | Qty | each: items\nrow: {{item.name}} | {{item.qty}}\nfooter: Page {{page}} of {{pages}}`],
  ["escaped-pipe", `text: A logical OR is written a \\| b in the guard.`],
  ["code-fence-lang", "title: Snippet\ncode: ```js\nconst x = 1;\nconsole.log(x);\n```"],
  ["unicode-punct", `text: Tolerance –0.5 × ΔE ≤ 2 for β values; no escaping needed.`],
  ["metadata-lift", `meta: | author: Billing | theme: corporate | dir: rtl\ntrack: | id: DOC-1 | by: Ahmed\ncontext: project | value: jadwal\ntitle: After Meta\nsection: Body`],
  ["print-layout", `meta: | theme: corporate\npage: | size: A4 | margin: 20mm\nheader: ACME — Confidential\nfooter: INV-1 · Page {{page}} of {{pages}}\nwatermark: DRAFT | opacity: 0.1\ntoc:\nsection: One\nbreak:\nsection: Two\nstyle: section | color: #0a7 | weight: 600`],
  ["extensions", `x-form: input | label: Country | key: country | type: choice | options: SA, QA, AE\nx-doc: def | meaning: events beyond control | term: Force Majeure\nx-doc: ref | file: ./policy.it | rel: supersedes\nx-doc: contact | email: ops@acme.qa | role: Client\nx-writer: figure | src: chart.svg | caption: Q2`],
  // ── hash-canonicalization vectors (the trust-critical rules) ──
  ["hash-comments", `// it-format: 1.0\n// internal note — excluded from the hash\ntitle: Contract\ntext: The body that is hashed.`],
  ["hash-history", `title: Sealed Doc\ntext: Live content above the boundary.\nhistory:\nrevision: v1.0 | by: Ahmed | at: 2026-01-01`],
  ["hash-styling-excluded", `title: Styled\npage: | size: A4\nstyle: text | color: #333\ntext: Content [word]{ color: #c00 } stays; styling drops from the hash.`],
  ["hash-trust-scope", `title: Approved\napprove: Legal ok | by: Sara | role: Counsel | at: 2026-03-28\ntext: Body content.\nsign: Fahad | role: MD | at: 2026-04-01 | hash: sha256:placeholder | spec: 4\nfreeze: | at: 2026-04-01 | hash: sha256:placeholder | spec: 4 | status: locked`],
  ["edge-comment-only", `// just a comment\n// it-format: 1.0`],
  ["edge-empty", ``],
];

// CRLF variant of an LF doc must hash identically (v4 line-ending normalization)
const CRLF_TWIN = ["hash-crlf-equals-lf", CRLF(`title: Contract\ntext: The body that is hashed.`)];
CORPUS.push(CRLF_TWIN);

// ── strip volatile id + internal _trivia for the semantic JSON ──────────────────
function clean(v) {
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) {
      if (k === "id" || k.startsWith("_")) continue;
      out[k] = clean(v[k]);
    }
    return out;
  }
  return v;
}

const vectors = CORPUS.map(([name, source]) => {
  const doc = core.parseIntentText(source);
  const strict = core.checkConformance(source, { level: "strict" });
  return {
    name,
    source,
    blocks: clean(doc.blocks),
    metadata: clean(doc.metadata ?? {}),
    serialized: core.documentToSource(doc),
    contentHash: core.computeDocumentHash(source),
    appearanceHash: core.computeAppearanceHash(source),
    lax: core.checkConformance(source, { level: "lax" }).conformant,
    strict: strict.conformant,
    issues: [...new Set((strict.issues ?? []).map((i) => i.code))].sort(),
  };
});

const artifact = {
  description:
    "IntentText conformance vectors — the canonical golden outputs every implementation must reproduce byte-for-byte. Generated from @dotit/core; see scripts/gen-conformance-vectors.mjs.",
  sealSpec: core.SEAL_SPEC,
  algorithm: "UTF-8 source, NFC normalization, LF line endings, SHA-256 (see SPEC.md §4).",
  count: vectors.length,
  vectors,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "vectors.json"), JSON.stringify(artifact, null, 2) + "\n");
console.log(`Wrote conformance/vectors.json — ${vectors.length} vectors (SEAL_SPEC ${core.SEAL_SPEC}).`);
