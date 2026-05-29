---
sidebar_position: 9
title: Core API
---

# Core API

TypeScript/JavaScript API reference for `@intenttext/core`.

```bash
npm install @intenttext/core
```

## Parser

### `parseIntentText(source, options?)`

Parse `.it` source into a document object.

```typescript
import { parseIntentText } from "@intenttext/core";

const doc = parseIntentText(`
title: Quarterly Report
meta: | author: Finance Team | date: 2026-Q1

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

### `parseIntentTextSafe(source, options?)`

Like `parseIntentText` but collects errors instead of throwing.

```typescript
import { parseIntentTextSafe } from "@intenttext/core";

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
import { parseIntentText, renderHTML } from "@intenttext/core";

const doc = parseIntentText(source);
const html = renderHTML(doc, { theme: "corporate" });
```

### `renderPrint(document, options?)`

Print-optimized HTML with `@page` rules, headers, footers, and watermarks.

```typescript
import { renderPrint } from "@intenttext/core";

const printHtml = renderPrint(doc, { theme: "print" });
```

### `collectPrintLayout(document)`

Extract page, header, footer, and watermark blocks.

```typescript
import { collectPrintLayout } from "@intenttext/core";

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
import { getBuiltinTheme, listBuiltinThemes } from "@intenttext/core";

const theme = getBuiltinTheme("corporate");
const names = listBuiltinThemes();
// ['corporate', 'minimal', 'warm', 'technical', 'print', 'legal', 'editorial', 'dark']
```

### `generateThemeCSS(theme, mode?)`

Generate CSS custom properties from a theme object.

```typescript
import { generateThemeCSS } from "@intenttext/core";

const css = generateThemeCSS(theme, "web"); // or 'print'
```

### `registerBuiltinTheme(theme)`

Register a custom theme for use by name.

```typescript
import { registerBuiltinTheme } from "@intenttext/core";

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
import { parseIntentText, queryBlocks } from "@intenttext/core";

const doc = parseIntentText(source);
const result = queryBlocks(doc, "type=deadline sort:date:asc limit:10");
// result.blocks, result.total, result.matched
```

### `parseQuery(queryString)`

Parse query syntax into a `QueryOptions` object.

```typescript
import { parseQuery } from "@intenttext/core";

const opts = parseQuery(
  "type=task owner=Ahmed due<2026-03-01 sort:due:asc limit:10",
);
```

### `queryDocument(document, field, value)`

Simple field=value query helper.

```typescript
import { queryDocument } from "@intenttext/core";

const tasks = queryDocument(doc, "type", "step");
```

### `formatQueryResult(result, format?)`

Format query results as text or JSON.

```typescript
import { formatQueryResult } from "@intenttext/core";

const text = formatQueryResult(result, "text");
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

## Merge

### `mergeData(document, data, agentName?)`

Resolve `{{variable}}` interpolations.

```typescript
import { parseIntentText, mergeData } from "@intenttext/core";

const template = parseIntentText(`
title: Invoice {{number}}
text: Amount due: {{amount}}
`);

const merged = mergeData(template, { number: "INV-2847", amount: "$5,000" });
```

### `parseAndMerge(source, data, options?)`

Parse and merge in one call.

```typescript
import { parseAndMerge } from "@intenttext/core";

const doc = parseAndMerge(templateSource, { client: "Acme Corp" });
```

## Trust

### `sealDocument(source, options)`

Seal a document by adding a `freeze:` block with SHA-256 hash.

```typescript
import { sealDocument } from "@intenttext/core";

const result = sealDocument(source, { by: "Ahmed Al-Rashid", role: "CEO" });
// result.valid, result.freezeBlock, result.updatedSource
```

### `verifyDocument(source)`

Verify document integrity against its seal.

```typescript
import { verifyDocument } from "@intenttext/core";

const result = verifyDocument(source);
// result.intact, result.hash, result.frozen, result.signers
```

### `computeDocumentHash(source)`

Compute SHA-256 hash of document content (above history boundary).

```typescript
import { computeDocumentHash } from "@intenttext/core";

const hash = computeDocumentHash(source);
// "sha256:a1b2c3..."
```

### `computeTrustDiff(before, after)`

Compute semantic diff for trust history writing.

```typescript
import { computeTrustDiff } from "@intenttext/core";

const diff = computeTrustDiff(oldDoc, newDoc);
// diff.added, diff.removed, diff.modified, diff.moved, diff.unchanged
```

### Trust types

```typescript
interface SealOptions {
  by: string;
  role?: string;
}

interface SealResult {
  valid: boolean;
  freezeBlock: IntentBlock;
  updatedSource: string;
}

interface VerifyResult {
  intact: boolean;
  frozen: boolean;
  frozenAt?: string;
  signers?: Array<{
    signer: string;
    role?: string;
    at: string;
    valid: boolean;
    signedCurrentVersion: boolean;
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
import { updateHistory } from "@intenttext/core";

const updated = updateHistory(oldSource, newSource, { by: "Ahmed" });
```

### `parseHistorySection(raw)`

Parse a history section string into structured data.

```typescript
import { parseHistorySection } from "@intenttext/core";

const { registry, revisions, registryIntact } =
  parseHistorySection(historyText);
```

## Index

### `buildShallowIndex(folder, files, coreVersion)`

Build a shallow `.it-index` for a folder.

```typescript
import { buildShallowIndex } from "@intenttext/core";

const index = buildShallowIndex("./contracts", filesMap, "3.1.0");
```

### `buildIndexEntry(document, source, modifiedAt)`

Extract metadata and block summaries for a single file.

```typescript
import { buildIndexEntry } from "@intenttext/core";

const entry = buildIndexEntry(doc, source, "2026-03-15T10:00:00Z");
```

### `composeIndexes(indexes)`

Merge multiple folder indexes into a flat result list.

```typescript
import { composeIndexes, queryComposed } from "@intenttext/core";

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
import { diffDocuments } from "@intenttext/core";

const diff = diffDocuments(oldDoc, newDoc);
// diff.added, diff.removed, diff.modified, diff.unchanged
// diff.summary — "2 added, 1 removed, 3 modified, 10 unchanged"
```

## Workflow

### `executeWorkflow(document, runtime)`

Run a workflow document against a runtime. Policy enforcement and gate checks are applied before execution begins.

```typescript
import { executeWorkflow } from "@intenttext/core";

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
import { extractWorkflow } from "@intenttext/core";

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
import { documentToSource } from "@intenttext/core";

const source = documentToSource(doc);
```

## Conversion

### `convertMarkdownToIntentText(markdown)`

Convert Markdown to `.it` format.

```typescript
import { convertMarkdownToIntentText } from "@intenttext/core";

const itSource = convertMarkdownToIntentText("# My Doc\n\nSome text");
```

### `convertHtmlToIntentText(html)`

Convert HTML to `.it` format.

```typescript
import { convertHtmlToIntentText } from "@intenttext/core";

const itSource = convertHtmlToIntentText("<h1>My Doc</h1><p>Some text</p>");
```

## Validation

### `validateDocument(document, schema)`

Validate a document against a schema.

```typescript
import { validateDocument, PREDEFINED_SCHEMAS } from "@intenttext/core";

const result = validateDocument(doc, PREDEFINED_SCHEMAS["project"]);
// result.valid, result.errors, result.warnings
```

### `validateDocumentSemantic(document)`

Semantic validation: cross-references, duplicate IDs, empty sections, unresolved variables.

```typescript
import { validateDocumentSemantic } from "@intenttext/core";

const result = validateDocumentSemantic(doc);
// result.valid, result.issues
```

### `createSchema(name, config)`

Create a custom validation schema.

```typescript
import { createSchema } from "@intenttext/core";

const schema = createSchema("invoice", {
  requiredBlocks: ["title", "note"],
  blockSchemas: {
    title: { type: "title", content: { required: true, minLength: 3 } },
  },
});
```

### Predefined schemas

`project`, `meeting`, `article`, `checklist`, `agentic`

## Ask (AI Query)

### `askDocuments(results, question, options?)`

Natural language query over indexed documents. Requires `ANTHROPIC_API_KEY`.

```typescript
import { askDocuments, composeIndexes } from "@intenttext/core";

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
  content: string;
  originalContent?: string;
  properties?: Record<string, string | number>;
  inline?: InlineNode[];
  children?: IntentBlock[];
  table?: { headers?: string[]; rows: string[][] };
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

Union type covering all 37 canonical keywords plus extension namespace blocks.

**Canonical (37 total):**

- **Document Identity (4):** `title`, `summary`, `meta`, `context`
- **Structure (3):** `section`, `sub`, `toc`
- **Content (7):** `text`, `info`, `quote`, `cite`, `code`, `image`, `link`
- **Tasks (3):** `task`, `done`, `ask`
- **Data (3):** `columns`, `row`, `metric`
- **Agentic Workflow (7):** `step`, `decision`, `gate`, `trigger`, `result`, `policy`, `audit`
- **Trust (5):** `track`, `approve`, `sign`, `freeze`, `amendment`
- **Layout (5):** `page`, `header`, `footer`, `watermark`, `break`

**Extension blocks:**

Extension blocks have the form `x-ns: type` (e.g., `x-agent: loop`, `x-doc: def`). They are typed as `{ type: string; namespace: string }` and passed through the renderer without core evaluation. See [Extension Keywords →](/docs/reference/keywords/extensions).

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

Record mapping alias keywords to their canonical types. Includes callout aliases (`warning:` → `info:` with `type: warning`), shorthand forms, and per-category aliases. See [Aliases Reference](/docs/reference/keywords/aliases).

### `KEYWORDS`

Array of all recognized keyword strings — 37 canonical keywords plus their registered aliases.
