---
sidebar_position: 9
title: Core API
---

# Core API

TypeScript/JavaScript API reference for `@dotit/core`.

```bash
npm install @dotit/core
```

Current version: **2.0.0**. (Formerly published as `@intenttext/core` — those packages are deprecated with pointers; same code, same format.)

## Parser

### `parseIntentText(source, options?)`

Parse `.it` source into a document object.

```typescript
import { parseIntentText } from "@dotit/core";

const doc = parseIntentText(`
title: Quarterly Report
meta: | author: Finance Team | date: 2026-03-31 | period: Q1

section: Revenue
text: Revenue grew 12% year-over-year.
metric: Revenue | value: $4.2M | target: $4.0M | status: above
`);

console.log(doc.metadata.title); // "Quarterly Report"
console.log(doc.blocks.length); // 5
```

**Options:**

```typescript
interface ParseOptions {
  extensions?: IntentExtension[]; // Custom block/inline parsers
  includeHistorySection?: boolean; // Parse trust history (default: false)
}
```

**Escaping:** ` | ` (space-pipe-space) is the reserved property delimiter. Write a
literal pipe as `\|` and a literal backslash as `\\` — the parser unescapes them
anywhere in content and property values, and `documentToSource` re-escapes on
output, so escape round-trips are a fixpoint. Colons need no escaping inside
content (`quote: He said: watch this` is fine).

### `parseIntentTextSafe(source, options?)`

Like `parseIntentText` but collects errors instead of throwing.

```typescript
import { parseIntentTextSafe } from "@dotit/core";

const result = parseIntentTextSafe(source);
if (result.errors.length > 0) {
  console.error(result.errors);
} else {
  const doc = result.document;
}
```

## Renderer

### `renderHTML(document, options?)`

Render to themed HTML.

```typescript
import { parseIntentText, renderHTML } from "@dotit/core";

const doc = parseIntentText(source);
const html = renderHTML(doc, { theme: "corporate" });
```

### `renderPrint(document, options?)`

Print-optimized HTML with `@page` rules, headers, footers, and watermarks.

```typescript
import { renderPrint } from "@dotit/core";

const printHtml = renderPrint(doc, { theme: "print" });
```

### `collectPrintLayout(document)`

Extract page, header, footer, and watermark blocks.

```typescript
import { collectPrintLayout } from "@dotit/core";

const layout = collectPrintLayout(doc);
// layout.page, layout.header, layout.footer, layout.watermark, layout.breaks
```

**Options:**

```typescript
interface RenderOptions {
  theme?: string | IntentTheme; // Theme name or object
}
```

## Theme

### `getBuiltinTheme(name)`

```typescript
import { getBuiltinTheme, listBuiltinThemes } from "@dotit/core";

const theme = getBuiltinTheme("corporate");
const names = listBuiltinThemes();
// ['corporate', 'minimal', 'warm', 'technical', 'print', 'legal', 'editorial', 'dark']
```

### `generateThemeCSS(theme, mode?)`

Generate CSS custom properties from a theme object.

```typescript
import { generateThemeCSS } from "@dotit/core";

const css = generateThemeCSS(theme, "web"); // or 'print'
```

### `registerBuiltinTheme(theme)`

Register a custom theme for use by name.

```typescript
import { registerBuiltinTheme } from "@dotit/core";

registerBuiltinTheme({
  name: "brand",
  version: "1.0",
  fonts: {
    body: "Georgia",
    heading: "Georgia",
    mono: "Courier",
    size: "11pt",
    leading: "1.6",
  },
  colors: {
    text: "#1a1a1a",
    heading: "#003366",
    muted: "#666",
    accent: "#003366",
    border: "#ccc",
    background: "#fff",
    "code-bg": "#f5f5f5",
  },
  spacing: {
    "page-margin": "1in",
    "section-gap": "2rem",
    "block-gap": "0.75rem",
    indent: "0",
  },
});
```

### `IntentTheme`

```typescript
interface IntentTheme {
  name: string;
  version: string;
  description?: string;
  author?: string;
  fonts: ThemeFonts;
  colors: ThemeColors;
  spacing: ThemeSpacing;
  blocks?: Record<string, Record<string, string | boolean>>;
  print?: ThemePrint;
}

interface ThemeFonts {
  body: string;
  heading: string;
  mono: string;
  size: string;
  leading: string;
}

interface ThemeColors {
  text: string;
  heading: string;
  muted: string;
  accent: string;
  border: string;
  background: string;
  "code-bg": string;
  "trust-approved"?: string;
  "trust-signed"?: string;
  "trust-frozen"?: string;
  "trust-warning"?: string;
  watermark?: string;
}

interface ThemeSpacing {
  "page-margin": string;
  "section-gap": string;
  "block-gap": string;
  indent: string;
}

interface ThemePrint {
  "header-font-size"?: string;
  "footer-font-size"?: string;
  "header-color"?: string;
  "footer-color"?: string;
}
```

## Query

### `queryBlocks(document, options)`

Execute a structured query against document blocks.

```typescript
import { parseIntentText, queryBlocks } from "@dotit/core";

const doc = parseIntentText(source);
const result = queryBlocks(doc, "type=deadline sort:date:asc limit:10");
// result.blocks, result.total, result.matched
```

### `parseQuery(queryString)`

Parse query syntax into a `QueryOptions` object.

```typescript
import { parseQuery } from "@dotit/core";

const opts = parseQuery(
  "type=task owner=Ahmed due<2026-03-01 sort:due:asc limit:10",
);
```

### `queryDocument(document, query?)`

Simple, intuitive filter API. All conditions are ANDed; type arrays are ORed.
Returns matching blocks (never mutates the document).

```typescript
import { queryDocument } from "@dotit/core";

const tasks = queryDocument(doc, { type: "step" });
const urgent = queryDocument(doc, {
  type: ["task", "deadline"],
  section: "Scope",
  properties: { priority: "high" },
  limit: 10,
});
```

```typescript
interface SimpleQueryOptions {
  type?: string | string[];
  content?: string | RegExp; // case-insensitive substring or regex
  properties?: Record<string, string | RegExp>;
  section?: string | RegExp;
  limit?: number;
}
```

### `formatQueryResult(result, format?)`

Format query results as `"simple"` text (default), `"table"`, or `"json"`.

```typescript
import { formatQueryResult } from "@dotit/core";

const table = formatQueryResult(result, "table");
const json = formatQueryResult(result, "json");
```

### Query types

```typescript
interface QueryOptions {
  where?: QueryClause[];
  sort?: QuerySort[];
  limit?: number;
  offset?: number;
}

interface QueryClause {
  field: string;
  operator:
    | "="
    | "!="
    | "<"
    | ">"
    | "<="
    | ">="
    | "contains"
    | "startsWith"
    | "exists";
  value?: string | number | boolean;
}

interface QuerySort {
  field: string;
  direction: "asc" | "desc";
}

interface QueryResult {
  blocks: IntentBlock[];
  total: number;
  matched: number;
}
```

### `readTypedValue(raw, unit?)` / `metricTypedValue(block)`

Interpret a raw value (or a `metric:` block's value) into a typed object — the number,
unit, currency, and a `kind` (`money` / `percent` / `quantity` / `number` / `text`). Use
this to do math on totals or to sort/format `metric:` values without re-parsing strings.

```typescript
import { readTypedValue, metricTypedValue, parseNumericValue } from "@dotit/core";

readTypedValue("17,325 QAR");
// { raw: "17,325 QAR", number: 17325, unit: null, currency: "QAR", kind: "money" }

const m = parseIntentText("metric: Margin | value: 18%").blocks[0];
metricTypedValue(m); // { raw: "18%", number: 18, unit: "%", currency: null, kind: "percent" }

parseNumericValue("1,250.50"); // 1250.5
```

## Merge

### `mergeData(document, data, options?)`

Resolve `{{variable}}` interpolations (dot paths, array indices, `each:` table loops).

```typescript
import { parseIntentText, mergeData } from "@dotit/core";

const template = parseIntentText(`
title: Invoice {{number}}
text: Amount due: {{amount}}
`);

const merged = mergeData(template, { number: "INV-2847", amount: "$5,000" });
```

`mergeData` resolves `{{vars}}` inside multi-line prose blocks too, so a **fully merged**
template (no placeholders left) can be sealed.

### `parseAndMerge(source, data, options?)`

Parse and merge in one call. `options.missing` controls unresolved `{{fields}}`:
`"keep"` (default — shows the marker, good while authoring) or `"blank"` (renders
empty — use for finished documents so an invoice never prints `{{customer.phone}}`).

```typescript
import { parseAndMerge } from "@dotit/core";

const doc = parseAndMerge(templateSource, invoiceData, { missing: "blank" });
```

## Document styles

### `collectDocumentStyles(document)` / `documentStyleCSS(document, selectorMap?, prefix?)`

Read a document's [`style:` rules](../reference/keywords/layout#style) (sanitized;
unknown targets dropped) and build the CSS for them. `renderHTML`/`renderPrint` call
this automatically; pass a custom `selectorMap` to apply the same rules to your own
markup (the web editor does exactly this for its live canvas).

```typescript
import { collectDocumentStyles, documentStyleCSS } from "@dotit/core";

collectDocumentStyles(doc);
// [{ target: "section", declarations: "color: #0a7; font-weight: 600" }]
```

## Trust

A seal is a **SHA-256 hash over the document's CONTENT** under a recorded `spec:` version
(currently `SEAL_SPEC = 4`). v4 **excludes styling + comments and normalizes line endings
(CRLF/CR → LF) + trailing whitespace** — so restyling, reformatting, a CRLF transform, or a
trailing-whitespace re-save **never** break a seal; only a real content change does. The seal
is **versioned**: every `sign:`/`freeze:` line stamps the `spec:` that produced its hash, and
verification applies exactly that version forever, so a future rule change can never silently
break a historical seal. A v4 seal also records a separate **`appearance:`** hash that flags a
hidden-content restyle (e.g. `opacity: 0`) without invalidating the seal — content is intact,
but `verifyDocument` sets `appearanceChanged`. Preserving exact bytes is **storage hygiene**,
not what the seal enforces. See [SPEC §4](https://github.com/intenttext/IntentText/blob/main/SPEC.md).

### `sealDocument(source, options)`

Seal a document: appends a `sign:` line (optional) and a `freeze:` line carrying the
SHA-256 content hash, the `appearance:` hash, and `spec: 4`. Returns the updated source —
store it as returned (re-serializing through a model on save is fine because the seal hashes
*content*, not bytes; but a clean store is still the safest default).

```typescript
import { sealDocument } from "@dotit/core";

const result = sealDocument(source, { signer: "Ahmed Al-Rashid", role: "CEO" });
// result.success, result.hash ("sha256:…"), result.source (sealed text), result.at
```

### `verifyDocument(source)`

Verify document integrity against its seal. **Multi-sign aware:** each signer is reported
with `signedCurrentVersion` (did their signature match the *current* content?), plus the
recorded `spec` and whether it is `specOutdated` (an older, weaker ruleset). A signer who
signed an earlier version is reported as such, not as a blanket failure.

```typescript
import { verifyDocument } from "@dotit/core";

const result = verifyDocument(source);
// result.intact, result.hash, result.frozen, result.spec, result.specOutdated,
// result.appearanceChanged, result.signers
```

### `signDocument(source, options)` / `unsealDocument(source)`

`signDocument` appends a `sign:` line carrying the **content**-scope hash and `spec: 4`
(identity-bound, no `freeze:`) — use it when a party signs but isn't the one locking the
document. `unsealDocument` strips the `freeze:` line (and is a no-op on an unsealed document),
so a sealed draft can be reopened for editing and then re-sealed.

```typescript
import { signDocument, unsealDocument } from "@dotit/core";

const signed = signDocument(source, { signer: "Ahmed", role: "CEO" }); // { success, hash, source, at }
const reopened = unsealDocument(sealedSource); // freeze: removed
```

### `computeDocumentHash(source)` / `computeSignatureHash(source, signer)`

Compute the SHA-256 hash of document content (above the history boundary). The two **scopes**:
`computeDocumentHash` is the **seal** scope (content + signatures + freeze metadata);
`computeSignatureHash` is the **content** scope for one signer (also binds their identity).

```typescript
import { computeDocumentHash, computeSignatureHash } from "@dotit/core";

const sealHash = computeDocumentHash(source);
// "sha256:a1b2c3..."
const sigHash = computeSignatureHash(source, { signer: "Ahmed", role: "CEO", at });
```

### `signatureIdentity(line)` / `signatureMatchesContent(source, signer)`

`signatureIdentity` extracts the bound `{ signer, role, at }` from a `sign:` line;
`signatureMatchesContent` checks whether a signer's hash still matches the current content
(the per-signer integrity check behind `verifyDocument`).

### Integrity-gated trust band — `renderTrustBand`, `TRUST_BAND_CSS`, `trustBandPositionCss`

`renderTrustBand(source, options?)` renders the on-document trust band (sealed, signed,
broken, …). It **verifies before it draws**: a tampered document renders a red
**"SEAL BROKEN"** stamp on every surface (screen, print, PDF) — never a clean seal. Pair
with `TRUST_BAND_CSS` (the stylesheet) and `trustBandPositionCss` (placement). Tiers
include the new **sealed** (indigo) and **broken** (red).

```typescript
import { renderTrustBand, TRUST_BAND_CSS, trustBandPositionCss } from "@dotit/core";

const bandHtml = renderTrustBand(source); // "SEAL BROKEN" if the content was tampered
```

### `computeTrustDiff(before, after)`

Compute semantic diff for trust history writing.

```typescript
import { computeTrustDiff } from "@dotit/core";

const diff = computeTrustDiff(oldDoc, newDoc);
// diff.added, diff.removed, diff.modified, diff.moved, diff.unchanged
```

### Trust types

```typescript
interface SealOptions {
  signer: string;
  role?: string;
  skipSign?: boolean; // freeze without adding a sign: line
}

interface SealResult {
  success: boolean;
  hash: string; // "sha256:…" — the content hash (not a hash of the raw bytes)
  source: string; // the sealed text
  at: string;
  error?: string;
}

interface VerifyResult {
  intact: boolean;
  frozen: boolean;
  frozenAt?: string;
  appearanceChanged?: boolean; // content intact, but styling changed since sealing (possible hidden-content restyle)
  spec?: number; // the recorded seal ruleset (currently 4)
  specOutdated?: boolean; // true if the seal predates the current SEAL_SPEC
  signers?: Array<{
    signer: string;
    role?: string;
    at: string;
    valid: boolean;
    signedCurrentVersion: boolean;
    spec?: number;
    specOutdated?: boolean;
  }>;
  hash?: string;
  expectedHash?: string;
  error?: string;
  warning?: string;
}

interface TrustDiff {
  added: BlockSnapshot[];
  removed: BlockSnapshot[];
  modified: BlockSnapshot[];
  moved: BlockSnapshot[];
  unchanged: BlockSnapshot[];
}
```

## History

### `updateHistory(previousSource, currentSource, options)`

Compute diff between versions and write history section.

```typescript
import { updateHistory } from "@dotit/core";

const updated = updateHistory(oldSource, newSource, { by: "Ahmed" });
```

### `parseHistorySection(raw)`

Parse a history section string into structured data.

```typescript
import { parseHistorySection } from "@dotit/core";

const { registry, revisions, registryIntact } =
  parseHistorySection(historyText);
```

## Index

### `buildShallowIndex(folder, files, coreVersion)`

Build a shallow `.it-index` for a folder.

```typescript
import { buildShallowIndex } from "@dotit/core";

const index = buildShallowIndex("./contracts", filesMap, "1.0.0");
```

### `buildIndexEntry(document, source, modifiedAt)`

Extract metadata and block summaries for a single file.

```typescript
import { buildIndexEntry } from "@dotit/core";

const entry = buildIndexEntry(doc, source, "2026-03-15T10:00:00Z");
```

### `composeIndexes(indexes)`

Merge multiple folder indexes into a flat result list.

```typescript
import { composeIndexes, queryComposed } from "@dotit/core";

const all = composeIndexes([contractsIndex, invoicesIndex]);
const deadlines = queryComposed(all, parseQuery("type=deadline"));
```

### `checkStaleness(index, document, source)`

Check if an index entry needs refresh.

### `updateIndex(existing, filename, document, source, modifiedAt)`

Update or add a single entry in an existing index.

### Index types

```typescript
interface ItIndex {
  version: "1";
  scope: "shallow";
  folder: string;
  built_at: string;
  core_version: string;
  files: Record<string, IndexFileEntry>;
}

interface IndexFileEntry {
  hash: string;
  modified_at: string;
  metadata: { title?: string; type?: string; domain?: string; track?: boolean };
  blocks: IndexBlockEntry[];
}

interface IndexBlockEntry {
  type: string;
  content: string;
  section?: string;
  properties: Record<string, string | number>;
}

interface ComposedResult {
  file: string;
  block: IndexBlockEntry;
}
```

## Diff

### `diffDocuments(before, after)`

Semantic diff between two parsed documents.

```typescript
import { diffDocuments } from "@dotit/core";

const diff = diffDocuments(oldDoc, newDoc);
// diff.added, diff.removed, diff.modified, diff.unchanged
// diff.summary — "2 added, 1 removed, 3 modified, 10 unchanged"
```

### `compareVersions(before, after, options?)` / `mergeThreeWay(base, mine, theirs, options?)`

`compareVersions` produces a **redline `.it` document** (track-change spans) between two
versions of a document's source — the same diff the editor's "Review changes" view and the
`<Redline>` viewer render. `mergeThreeWay` does a 3-way (base / mine / theirs) merge for
async co-authoring, marking conflicts as track-change regions.

```typescript
import { compareVersions, mergeThreeWay } from "@dotit/core";

const redlineSource = compareVersions(oldSource, newSource, { by: "Sarah" });

const { source, conflicts } = mergeThreeWay(baseSource, mineSource, theirsSource);
// conflicts: number of unresolved regions (0 = clean merge)
```

## Workflow

### `executeWorkflow(document, runtime)`

Run a workflow document against a runtime. Policy enforcement and gate checks are applied before execution begins.

```typescript
import { executeWorkflow } from "@dotit/core";

const result = await executeWorkflow(doc, {
  executeStep: async (block) => {
    // dispatch block to your agent/tool
    return { status: "completed", output: "Done" };
  },
  evaluateDecision: async (block) => {
    return { branch: "yes" };
  },
  checkGate: async (block) => {
    return { passed: true };
  },
  dryRun: false,
});

console.log(result.status); // "completed"
console.log(result.executedSteps); // ["step-1", "step-2", ...]
```

**Return value:**

```typescript
interface ExecutionResult {
  status: "completed" | "gate_blocked" | "policy_blocked" | "error" | "dry_run";
  executedSteps: string[];
  skippedSteps: string[];
  blockingGate?: string;
  blockingPolicy?: string;
  error?: string;
  dryRunPlan?: string[];
}
```

**Status reference:**

| Status           | Meaning                                                                  |
| ---------------- | ------------------------------------------------------------------------ |
| `completed`      | All steps executed successfully                                          |
| `gate_blocked`   | A `gate:` check returned `passed: false` — execution halted at that gate |
| `policy_blocked` | A `policy:` block's `requires: gate` was not satisfied before execution  |
| `error`          | A step threw an unhandled exception                                      |
| `dry_run`        | Runtime `dryRun: true` — plan returned without execution                 |

**Runtime interface:**

```typescript
interface WorkflowRuntime {
  executeStep: (block: IntentBlock) => Promise<StepResult>;
  evaluateDecision?: (block: IntentBlock) => Promise<DecisionResult>;
  checkGate?: (block: IntentBlock) => Promise<GateResult>;
  dryRun?: boolean;
}

interface StepResult {
  status: "completed" | "error";
  output?: string;
  error?: string;
}

interface GateResult {
  passed: boolean;
  reason?: string;
}

interface DecisionResult {
  branch: string;
}
```

**Policy enforcement:**

Before the execution loop starts, `executeWorkflow` checks every `policy:` block for `requires: gate`. If the required `gate:` block has not passed, the function returns immediately with `status: "policy_blocked"` and does not execute any steps.

```typescript
// policy enforcement example
const doc = parseIntentText(`
policy: | requires: gate | gate: security-review
step: Deploy to production
`);

const result = await executeWorkflow(doc, runtime);
// result.status === "policy_blocked" if security-review gate is unmet
// result.blockingPolicy === "policy-id"
```

### `extractWorkflow(document)`

Extract a task DAG from step/gate/decision blocks without executing.

```typescript
import { extractWorkflow } from "@dotit/core";

const graph = extractWorkflow(doc);
// graph.entryPoints, graph.steps, graph.executionOrder, graph.gatePositions
```

```typescript
interface WorkflowGraph {
  entryPoints: string[];
  steps: Record<string, WorkflowStep>;
  executionOrder: string[][]; // Topologically sorted layers
  gatePositions: number[];
  hasTerminal: boolean;
  warnings: string[];
}

interface WorkflowStep {
  block: IntentBlock;
  dependsOn: string[];
  dependedOnBy: string[];
  isGate: boolean;
  isTerminal: boolean;
  isParallel: boolean;
}
```

## Source

### `documentToSource(document)`

Convert a parsed document back to `.it` source text.

```typescript
import { documentToSource } from "@dotit/core";

const source = documentToSource(doc);
```

**Localized keywords round-trip as written.** When a line used one of the 33 Arabic
keyword names (`عنوان` → `title`, `مهمة` → `task`, `صف` → `row`, `توقيع` → `sign`, …)
the parser records the keyword as written on `block.keywordAlias`, and
`documentToSource` re-emits that form instead of normalizing to the canonical
English keyword. An Arabic document stays Arabic and a sealed document keeps its
hash through a parse → serialize cycle. Table keywords (`أعمدة`/`صف`, `headers`)
are preserved the same way. (There are **no Latin synonym aliases** — a word like
`abstract:` is not reserved, so it parses as your own `custom` block and round-trips
verbatim, never silently rewritten.) Reserved characters are re-escaped on output
(`\|`, `\\`), so escape round-trips are stable too.

### `reconcileEdit(originalSource, editedSource)`

Source-preserving edit reconciliation: returns the edited document with every **unchanged**
block restored to its **exact original bytes**. For each edited block, if a semantically
identical block (same type, content, properties, children) existed in the original, the
original's bytes are kept; only genuinely new or changed blocks take the edited
serialization. A no-op edit round-trips byte-for-byte, so a sealed document keeps its hash.

```typescript
import { reconcileEdit } from "@dotit/core";

const saved = reconcileEdit(originalSource, editorOutput);
reconcileEdit(sealedSource, sealedSource) === sealedSource; // true (no-op preserves bytes)
```

Use this whenever you accept edited `.it` text from a model-based editor. See
[Byte Preservation](../guide/byte-preservation).

### `effectiveProperties(block)` / `effectiveField(block, field)` / `defaultFor(type, field)`

The parser is a **faithful recorder**: it stores only what the author wrote, so the model
round-trips byte-for-byte. Block-type defaults (a `step:`'s `status: pending`, a `done:`'s
`status: done`, a bare `toc:`'s `depth`/`title`, an image `at:` read as `src:`) are applied
at **read time**, not baked into `block.properties`. Use these when you need a block's
*interpreted* values:

```typescript
import { effectiveProperties, effectiveField } from "@dotit/core";

const step = parseIntentText("step: Verify").blocks[0];
step.properties?.status;              // undefined — not stored (bytes stay exact)
effectiveField(step, "status");       // "pending" — the read-time default
effectiveProperties(step).status;     // "pending"
```

The renderer, query engine, and index already use these, so rendering and `status=done`
queries behave exactly as before — only the stored model changed. See
[Byte Preservation](../guide/byte-preservation#why-this-stays-true-the-parser-is-a-faithful-recorder).

## Approval routing & audit chain

In-file approval workflow — the policy, live state, and a tamper-evident trail all live in
the document. See [Approval Workflows](../guide/approval-workflows) for the full guide.

### `workflowState(source)` / `extractRoute(document)`

Derive the live approval state from a document's `route:`/`require:` policy and its
`approve:` lines. Nothing is stored — re-deriving always matches the file.

```typescript
import { workflowState, extractRoute } from "@dotit/core";

const state = workflowState(source);
// { hasRoute, order: "sequential"|"parallel", required, active,
//   fulfilled: string[], pending: string[], next: string|null, complete: boolean }

if (!state.complete) throw new Error(`Awaiting: ${state.pending.join(", ")}`);

extractRoute(parseIntentText(source)); // { order, required } | null — the raw policy
```

`require:` supports `| when: <condition>` (conditional on the document's own `metric:`/`meta:`
values) and `| optional: yes`. A document with no policy returns `complete: true`.

### `appendApproval(source, options)` / `verifyAuditChain(source)` / `auditTrail(source)`

Append a **hash-chained** approval (carries `prev:` = hash of the preceding event, so the
approval *order* is tamper-evident) and verify the chain. Use `appendApproval` before
sealing — `approve:` is part of the hashed body.

```typescript
import { appendApproval, verifyAuditChain, auditTrail } from "@dotit/core";

let src = appendApproval(doc, { by: "Sarah Chen", role: "manager", note: "Reviewed" });
src = appendApproval(src, { by: "James Miller", role: "finance" });

verifyAuditChain(src);
// { valid: true, length: 2, chained: 2 }
// on tamper → { valid: false, brokenAt: 1, reason: "audit link 1 …", … }

auditTrail(src); // ordered AuditEvent[] — kind: approve|sign|freeze|amendment|revision
```

A plain hand-written `approve:` (no `prev:`) is a valid un-chained link, never reported as
tampered.

## Forms

A document with `meta: type: form` turns `input:` lines into fields a recipient fills —
text, choice, date, number, signature, table, and attachment, with `required:`, `show-if:`
(conditional), and `compute:` (computed) modifiers. See the [fillable forms recipe](/docs/cookbook/forms/fillable-forms).

### `isForm(source)` / `isFormComplete(source)` / `extractFormFields(source)`

```typescript
import { isForm, isFormComplete, extractFormFields, missingRequiredFields } from "@dotit/core";

isForm(source); // true if meta: type: form
isFormComplete(source); // true once every required field has a value
missingRequiredFields(source); // string[] of unanswered required field ids
```

### `applyAnswers(source, answers)` / `setFieldValue` / `computeFormValues`

Fill a form programmatically and resolve computed fields. `applyAnswers` returns the
updated `.it` source — a complete form is then signable.

```typescript
import { applyAnswers, isFormComplete, computeFormValues } from "@dotit/core";

const filled = applyAnswers(blankForm, {
  legal_name: "Acme",
  qty: "10",
  unit_price: "250",
});
computeFormValues(filled); // resolves compute: fields (e.g. qty * unit_price)
if (isFormComplete(filled)) {
  /* now signable */
}
```

### `sealFormStructure(source, opts)` / `verifyFormStructure(source)`

Seal a form's **structure** (its fields, not its answers) so a recipient can fill it but
cannot add, remove, or re-type fields without detection — a tamper-evident form template.

```typescript
import { sealFormStructure, verifyFormStructure } from "@dotit/core";

const { source, structureHash } = sealFormStructure(blankForm, { sealer: "HR" });
verifyFormStructure(source); // { sealed, intact, sealer, structureHash, expected }
```

### `submitForm(source, opts)` / `buildSubmission(source, opts?)`

POST a completed form to an endpoint. `buildSubmission` builds the payload
(`{ source, answers?, hash, submittedAt, formId? }`) without sending; `submitForm` sends it.
`requireComplete` (default behavior) refuses to submit an incomplete form.

```typescript
import { submitForm } from "@dotit/core";

const result = await submitForm(filledForm, {
  endpoint: "https://hr.example.com/api/intake",
  requireComplete: true,
});
// { ok: boolean, status: number, body?, error? }
```

## Conversion

### `convertMarkdownToIntentText(markdown)`

Convert Markdown to `.it` format.

```typescript
import { convertMarkdownToIntentText } from "@dotit/core";

const itSource = convertMarkdownToIntentText("# My Doc\n\nSome text");
```

### `convertHtmlToIntentText(html)`

Convert HTML to `.it` format.

```typescript
import { convertHtmlToIntentText } from "@dotit/core";

const itSource = convertHtmlToIntentText("<h1>My Doc</h1><p>Some text</p>");
```

### Spreadsheets — `convertXlsxToIntentText(data, opts?)` / `convertIntentTextToXlsx(source, opts?)`

Round-trip `.xlsx` ⇄ `.it`. `convertXlsxToIntentText` takes the file bytes
(`Uint8Array | Buffer`) and emits `.it` source (each sheet becomes a section with a
table); `convertIntentTextToXlsx` takes `.it` source and returns `.xlsx` bytes
(`Uint8Array`) with each table written to its own sheet.

```typescript
import { readFileSync } from "node:fs";
import {
  convertXlsxToIntentText,
  convertIntentTextToXlsx,
} from "@dotit/core";

const itSource = convertXlsxToIntentText(readFileSync("report.xlsx"));
const xlsxBytes = convertIntentTextToXlsx(itSource);
```

### Word documents — `convertDocxToIntentText(data, opts?)` / `convertIntentTextToDocx(source, opts?)`

Round-trip `.docx` ⇄ `.it`. `convertDocxToIntentText` takes the file bytes
(`Uint8Array | Buffer`) and emits `.it` source; `convertIntentTextToDocx` takes `.it`
source and returns `.docx` bytes (`Uint8Array`).

```typescript
import { readFileSync } from "node:fs";
import {
  convertDocxToIntentText,
  convertIntentTextToDocx,
} from "@dotit/core";

const itSource = convertDocxToIntentText(readFileSync("contract.docx"));
const docxBytes = convertIntentTextToDocx(itSource);
```

All four converters are also exposed on the CLI via `dotit convert <in> <out>`
(extension pair dispatch — see [CLI › Convert existing files](./cli#convert-existing-files)).

## E-invoice (UBL)

### `buildUBLInvoice(input)` / `intentToUBL(source, overrides?)`

Emit a **UBL 2.1** invoice XML (the format behind EN 16931 / PEPPOL e-invoicing) from
structured input, or directly from an `.it` invoice. `buildUBLInvoice` takes a typed
object; `intentToUBL` derives the fields from a parsed `.it` document (with optional
overrides).

```typescript
import { buildUBLInvoice, intentToUBL } from "@dotit/core";

const xml = buildUBLInvoice({
  id: "INV-2026-0042",
  issueDate: "2026-06-23",
  currency: "QAR",
  supplier: { name: "Jadwal Technology", vatId: "…", country: "QA" },
  customer: { name: "Acme Corporation", country: "QA" },
  lines: [{ name: "Managed hosting", quantity: 1, unitPrice: 17325, unit: "MON" }],
  taxPercent: 5,
});

const xmlFromIt = intentToUBL(invoiceSource, { currency: "QAR" });
```

## Storage

`.it` is plain UTF-8 text, so it can live in a database field instead of a file.
These helpers guard against a storage layer silently re-encoding or corrupting the
bytes. This byte-integrity tag is **distinct** from the seal hash: the seal
(`computeDocumentHash`) covers only the canonicalized **content** and tolerates a
CRLF/whitespace transform, whereas this tag hashes the **whole** source byte-for-byte to
catch *any* storage corruption — useful when you want a hard guarantee that the bytes you
read are the bytes you wrote.

### `toStorageRecord(source)` / `fromStorageRecord(record)` / `verifyStorageRecord(record)`

```typescript
import {
  toStorageRecord,
  fromStorageRecord,
  verifyStorageRecord,
} from "@dotit/core";

const record = toStorageRecord(source);
// { source, bytesSha256 } — persist both columns as-is

const intact = verifyStorageRecord(record); // boolean
const restored = fromStorageRecord(record); // throws if the bytes were altered
```

```typescript
interface StoredDocument {
  source: string; // the exact .it source — store as UTF-8 with NO normalization
  bytesSha256: string; // SHA-256 (hex) of the exact source bytes, set at write time
}
```

## Validation

### `validateDocument(document, schema)`

Validate a document against a schema.

```typescript
import { validateDocument, PREDEFINED_SCHEMAS } from "@dotit/core";

const result = validateDocument(doc, PREDEFINED_SCHEMAS["project"]);
// result.valid, result.errors, result.warnings
```

### `validateDocumentSemantic(document)`

Semantic validation: cross-references, duplicate IDs, empty sections, unresolved variables.

```typescript
import { validateDocumentSemantic } from "@dotit/core";

const result = validateDocumentSemantic(doc);
// result.valid, result.issues
```

### `createSchema(name, config)`

Create a custom validation schema.

```typescript
import { createSchema } from "@dotit/core";

const schema = createSchema("invoice", {
  requiredBlocks: ["title", "note"],
  blockSchemas: {
    title: { type: "title", content: { required: true, minLength: 3 } },
  },
});
```

### Predefined schemas

`project`, `meeting`, `article`, `checklist`, `agentic`

### `checkConformance(input, options?)`

Check a document (source string **or** parsed `IntentDocument`) against the format's
conformance rules and return a structured report. Two levels: **`"lax"`** (default — only
hard errors count) and **`"strict"`** (warnings also fail conformance). Useful as a gate
before sealing or publishing.

```typescript
import { checkConformance } from "@dotit/core";

const report = checkConformance(source, { level: "strict" });
// { conformant: boolean, level, errors: number, warnings: number, issues: SemanticIssue[] }
if (!report.conformant) console.error(report.issues);
```

```typescript
type ConformanceLevel = "lax" | "strict";

interface ConformanceReport {
  conformant: boolean;
  level: ConformanceLevel;
  errors: number;
  warnings: number;
  issues: SemanticIssue[];
}
```

## Ask (AI Query)

### `askDocuments(results, question, options?)`

Natural language query over indexed documents. Requires `ANTHROPIC_API_KEY`.

```typescript
import { askDocuments, composeIndexes } from "@dotit/core";

const all = composeIndexes([index1, index2]);
const answer = await askDocuments(all, "Which contracts expire this quarter?");
```

```typescript
interface AskOptions {
  maxTokens?: number; // default: 1024
  format?: "text" | "json";
}
```

## Core types

### `IntentBlock`

```typescript
interface IntentBlock {
  id: string;
  type: BlockType;
  keywordAlias?: string; // keyword AS WRITTEN when the line used a localized (Arabic) keyword name — re-emitted on serialize
  content: string;
  originalContent?: string;
  properties?: Record<string, string | number>;
  inline?: InlineNode[];
  children?: IntentBlock[];
  table?: {
    headers?: string[];
    rows: string[][];
    headersKeyword?: string; // keyword as written for the headers line (e.g. أعمدة, headers)
    rowKeyword?: string; // keyword as written for row lines (e.g. صف)
  };
}
```

### `IntentDocument`

```typescript
interface IntentDocument {
  version?: string;
  blocks: IntentBlock[];
  metadata?: IntentDocumentMetadata;
  diagnostics?: Diagnostic[];
  history?: HistorySection;
}
```

### `IntentDocumentMetadata`

```typescript
interface IntentDocumentMetadata {
  title?: string;
  summary?: string;
  language?: "ltr" | "rtl";
  agent?: string;
  model?: string;
  context?: Record<string, string>;
  version?: string;
  tracking?: { version: string; by: string; active: boolean };
  signatures?: Array<{
    signer: string;
    role?: string;
    at: string;
    hash: string;
    valid?: boolean;
  }>;
  freeze?: { at: string; hash: string; status: "locked" };
  meta?: Record<string, string>;
}
```

### `BlockType`

Union type covering all 41 canonical keywords plus extension namespace blocks. The exact
list and tier split is exported as `CANONICAL_KEYWORDS` and `KEYWORD_TIERS` (so it can never
drift from the docs).

**Canonical (41 total)**, by tier (`KEYWORD_TIERS`):

- **Core (13):** `title`, `summary`, `meta`, `section`, `sub`, `text`, `info`, `quote`, `code`, `image`, `link`, `task`, `done`
- **Agent (9):** `context`, `ask`, `step`, `decision`, `gate`, `trigger`, `result`, `policy`, `audit`
- **Contract (9):** `cite`, `track`, `approve`, `sign`, `freeze`, `amendment`, `certify`, `route`, `require`
- **Data (3):** `headers`, `row`, `metric`
- **Print (7):** `toc`, `page`, `header`, `footer`, `watermark`, `style`, `break`

Notes: the table-header keyword is `headers` — write `headers:` (there are **no synonym
aliases** anymore, so `columns:` is no longer reserved; it now parses as an ordinary `custom`
block). `policy` and `context` are **agent**-tier (not Trust). `certify`/`route`/`require` are
contract-tier — they power authority certification and in-file approval routing.

**Boundary / extension keywords** (recognized, but outside the canonical 41):

- **Forms (x-form):** `input` and `output` — fillable/computed form fields. See [Forms](#forms).
- **Cross-document (x-doc):** `attach` — embed/reference another document. See [Attachments](/docs/cookbook/trust/attachments).
- Other `x-ns: type` extension blocks (e.g., `x-agent: loop`) are typed as `{ type: string; namespace: string }` and passed through the renderer without core evaluation. See [Extension keywords →](/docs/reference/keywords/#extension-keywords).

### `InlineNode`

```typescript
type InlineNode =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "strike"; value: string }
  | { type: "highlight"; value: string }
  | { type: "code"; value: string }
  | { type: "inline-quote"; value: string }
  | { type: "inline-note"; value: string }
  | { type: "date"; value: string }
  | { type: "mention"; value: string }
  | { type: "tag"; value: string }
  | { type: "label"; value: string }
  | { type: "link"; value: string; url: string }
  | { type: "footnote-ref"; value: string };
```

### `Diagnostic`

```typescript
interface Diagnostic {
  severity: "error" | "warning";
  message: string;
  line: number;
  column: number;
  code: string;
}
```

### `ALIASES`

Record mapping each **localized (Arabic) keyword name** to its canonical type. As of core
1.25 this is exactly the **33 Arabic keywords** (`عنوان` → `title`, `قسم` → `section`, `مهمة`
→ `task`, `مؤشر` → `metric`, `اعتماد` → `approve`, `تجميد` → `freeze`, …) — an Arabic
document gets full canonical semantics, and the keyword serializes back exactly as written.
The Latin synonym aliases that older versions shipped (`note`, `warning`, `tip`, `columns`,
`milestone`, `due`, …) have been **removed**: there are now **zero** non-localized aliases, so
every one of those words parses as your own `custom` block instead. Callout variants are set
with the `type:` property (`info: … | type: warning`), not a `warning:` keyword. See
[Aliases Reference](/docs/reference/keywords/aliases).

### `KEYWORDS`

Array of every recognized keyword string — the 41 canonical keywords, the 33 Arabic localized
keyword names, and the namespaced extension keywords (`def`, `contact`, `deadline`, `ref`,
`figure`, `input`, `output`, `font`, …). It contains **no synonym aliases**: any word not in
this array is a reliable, collision-free `custom` keyword of your own.


## Server-side PDFs — `@dotit/pdf`

Core stays zero-dependency; real PDF **bytes** on a server (email attachments,
compliance archiving, batch statement runs) come from the opt-in companion package:

```bash
npm i @dotit/pdf
npm i puppeteer        # or: puppeteer-core + your system Chrome (CHROME_PATH)
```

```typescript
import { issuePDF } from "@dotit/pdf";

const { source, hash, at, pdf } = await issuePDF(templateSource, data, {
  signer: "Acme Billing",
});
// `source` is the SEALED .it text — store it on the record (the verifiable legal
// artifact); `pdf` is the bytes you email/archive.
```

Also: `issueDocument()` (same flow minus Chrome — returns print-ready HTML for
sidecars like Gotenberg), `renderPDF()`, `htmlToPDF()`, and `createPdfRenderer()`
for batch runs. Full guide: [ERP / App Integration](./erp-integration).

## Cryptographic signatures and certification

`@dotit/core`'s `sign:`/`freeze:` seals are integrity hashes (they prove the content is
unchanged, not *who* signed). For real **cryptographic identity** — Ed25519 signatures that
verify offline from the bytes alone, plus an authority **certification** chain — add the
opt-in `@dotit/sign` (current **2.0.0**).

```bash
npm i @dotit/sign
```

```typescript
import {
  generateSigningKey,
  publicKeyFor,
  signDocumentCrypto,
  verifyDocumentSignatures,
  certifyDocument,
  verifyCertifications,
} from "@dotit/sign";

const { publicKey, privateKey } = generateSigningKey(); // store privateKey in a KMS
const signed = signDocumentCrypto(source, { signer: "Ahmed", role: "CEO", privateKey });

// verification needs NO key — each sign:/certify: line carries the public key
verifyDocumentSignatures(signed); // per-signer { signer, role, at, publicKey, valid }

// an authority (e.g. UTS) attests this exact content; verify against its published key
verifyCertifications(certifiedSource, { trustedKey });
```

Issuance helpers (`certifyDocument`, `issueIntermediate`, `parseIntermediateCert`,
`verifyIntermediateCert`) build the authority side; the [MCP server](./mcp-server) exposes
the *verification* tools (it never holds an authority key). Full guide:
[Trust & Signing](/docs/guide/trust-and-signing).

## Court-recognized PDF signatures

`@dotit/pades` (current **1.0.1**) applies **PAdES** (PDF Advanced Electronic Signatures,
Adobe/court-recognized) to a rendered PDF — X.509/ECDSA + CMS, with RFC 3161 timestamping
and CA/CSR issuance for self-hosted PKI.

```typescript
import { signPdf, verifyPdfSignature, requestTimestampToken } from "@dotit/pades";
// also: createCertificateAuthority, createCsr, issueCertificate, signDetachedCms, …
```

Native `.it` seals stay Ed25519; PAdES is the **standards bridge** for handing a signed PDF
to a counterparty's Adobe/eIDAS workflow.

## Math rendering

`@dotit/math` (current **0.1.0**) renders the format's math markers — dependency-free lite
MathML by default, with optional KaTeX for full fidelity.

```typescript
import { renderMath, mathToMathML, renderMathInHtml, hydrateMath } from "@dotit/math";
```
