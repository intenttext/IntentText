# IntentText Core — Hardening Prompt
# Repo: github.com/intenttext/IntentText
# Package: @intenttext/core
# Run this BEFORE building any other tools — they all depend on a stable core.

---

## MISSION

Add five missing operations to `@intenttext/core` that complete the public API
and make the library production-safe. No breaking changes. All 255 existing
tests must continue to pass. Target: 60+ new tests on top.

The five additions:

1. `parseIntentTextSafe()` — parser that never throws
2. `documentToSource()` — JSON → .it source (the missing reverse direction)
3. `validateDocument()` — semantic validation beyond syntax
4. `queryDocument()` — query blocks by type, content, and properties
5. `diffDocuments()` — semantic diff between two document versions

---

## PART 1 — parseIntentTextSafe()

File: `packages/core/src/parser.ts` (add to existing file)

### ParseOptions

```typescript
export interface ParseOptions {
  // How to handle unrecognised keywords. Default: 'note'
  unknownKeyword: 'note' | 'skip' | 'throw';

  // Maximum number of blocks to parse. Prevents runaway on huge inputs.
  // Default: 10000
  maxBlocks: number;

  // Maximum line length in characters. Lines longer than this are truncated.
  // Prevents catastrophic regex backtracking.
  // Default: 50000
  maxLineLength: number;

  // If true, throw on any parse warning. Default: false.
  strict: boolean;
}

export const DEFAULT_PARSE_OPTIONS: ParseOptions = {
  unknownKeyword: 'note',
  maxBlocks: 10000,
  maxLineLength: 50000,
  strict: false,
};
```

### ParseWarning and ParseError

```typescript
export interface ParseWarning {
  line: number;          // 1-indexed line number in source
  message: string;
  code: string;          // e.g. 'UNKNOWN_KEYWORD', 'LINE_TRUNCATED'
  original: string;      // the raw line that caused the warning
}

export interface ParseError {
  line: number;
  message: string;
  code: string;
  original: string;
}
```

### ParseResult

```typescript
export interface ParseResult {
  document: IntentDocument;
  warnings: ParseWarning[];
  errors: ParseError[];    // only populated in strict mode
}
```

### parseIntentTextSafe()

```typescript
export function parseIntentTextSafe(
  source: string,
  options?: Partial<ParseOptions>
): ParseResult
```

Behaviour:
- Merges options with DEFAULT_PARSE_OPTIONS
- Never throws under any input — wraps the existing parser in try/catch
- If a line exceeds maxLineLength, truncate it and add a 'LINE_TRUNCATED' warning
- If an unknown keyword is encountered:
  - `'note'`: treat as note: block, add 'UNKNOWN_KEYWORD' warning
  - `'skip'`: skip the line entirely, add 'UNKNOWN_KEYWORD' warning
  - `'throw'` (strict): add to errors array
- If total blocks would exceed maxBlocks, stop parsing and add 'MAX_BLOCKS_REACHED' warning
- In strict mode, if errors array is non-empty, still returns a ParseResult
  (does not throw) — caller decides what to do with errors

The existing `parseIntentText()` function stays unchanged. It is the simple API.
`parseIntentTextSafe()` is the production API.

---

## PART 2 — documentToSource()

File: `packages/core/src/source.ts` (new file)

This is the reverse of the parser. Takes a parsed IntentDocument (JSON) and
produces a valid `.it` source string that, when re-parsed, produces an identical
document.

```typescript
export function documentToSource(doc: IntentDocument): string
```

### Serialisation rules

**Document header blocks** — emit first, in this order if present:
`agent:`, `context:`, `font:`, `page:`

Each header block serialises as:
`keyword: content | prop1: value1 | prop2: value2`

**Content blocks** — emit in order of `doc.blocks` array.

**For each block:**

1. Start with the keyword: `${block.type}: `
2. Append `block.originalContent` if present, else `block.content`
   (originalContent preserves inline formatting like `*bold*`)
3. If `block.properties` is non-empty, append each key-value as `| key: value`
   — skip internal properties: `id`, `status` if it is 'pending' (default)
4. Special cases:
   - `---` divider: emit as `---` with no keyword
   - `//` comment: emit as `// ${block.content}`
   - `break:`: emit as `break:` with no content
   - `toc:`: emit as `toc:` then properties only
   - Fenced code blocks: emit as ` ``` ` then content lines then ` ``` `
   - Pipe tables: reconstruct from block data

**Property serialisation order** — use a canonical order per block type
so that round-tripped documents are deterministic. For `step:`:
`tool`, `input`, `output`, `depends`, `id`, `status`, `timeout`
For `task:`: `owner`, `due`, `priority`, `status`
For all others: alphabetical.

### Round-trip guarantee

```typescript
// This must hold for any valid .it document:
const original = parseIntentText(source);
const roundTripped = parseIntentText(documentToSource(original));

// Block types, content, and properties must be identical
// (IDs may differ — they are generated fresh on each parse)
```

Write tests that verify this for every block type.

---

## PART 3 — validateDocument()

File: `packages/core/src/validate.ts` (new file)

```typescript
export interface ValidationIssue {
  blockId: string;
  blockType: string;
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;          // true if no errors (warnings are ok)
  issues: ValidationIssue[];
}

export function validateDocument(doc: IntentDocument): ValidationResult
```

### Validation rules

Collect all issues — do not stop at the first error.

**ERRORS** (valid: false):

- `STEP_REF_MISSING` — a `decision:` block's `then:` or `else:` references a
  step ID that does not exist in the document
- `DEPENDS_REF_MISSING` — a `step:` block's `depends:` references a step ID
  that does not exist in the document
- `PARALLEL_REF_MISSING` — a `parallel:` block's `steps:` list contains a
  step ID that does not exist in the document
- `CALL_LOOP` — a `call:` block references the document's own title/filename
  (simple self-reference check — full cycle detection is a runtime concern)
- `RESULT_NOT_TERMINAL` — a `result:` block is not the last block in its
  section (or in the document if no sections)
- `DUPLICATE_STEP_ID` — two blocks share the same explicit `id:` property

**WARNINGS** (valid: true, but flagged):

- `GATE_NO_APPROVER` — a `gate:` block has no `approver:` property
- `STEP_NO_TOOL` — a `step:` block has no `tool:` property
- `UNRESOLVED_VARIABLE` — a `{{variable}}` reference in any block content or
  property value that is not declared in `context:` and not produced as
  `output:` by any step
- `EMPTY_SECTION` — a `section:` block is immediately followed by another
  `section:` or the end of document with no content in between
- `HANDOFF_NO_TO` — a `handoff:` block has no `to:` property
- `RETRY_NO_MAX` — a `retry:` block has no `max:` property

**INFO** (informational only, never affects valid):

- `DOCUMENT_NO_TITLE` — document has no `title:` block
- `TEMPLATE_HAS_UNRESOLVED` — document contains `{{variables}}` (normal for
  templates, but flagged so the caller knows this is a template, not a
  filled document)

---

## PART 4 — queryDocument()

File: `packages/core/src/query.ts` (new file)

```typescript
export interface QueryOptions {
  // Filter by block type or array of types
  type?: string | string[];

  // Filter by content (string = substring match, RegExp = regex match)
  content?: string | RegExp;

  // Filter by properties — all specified key/value pairs must match
  // Value can be a string (exact match) or RegExp
  properties?: Record<string, string | RegExp>;

  // Only return blocks within a specific section (match section content)
  section?: string | RegExp;

  // Maximum number of results to return
  limit?: number;
}

export function queryDocument(
  doc: IntentDocument,
  query: QueryOptions
): IntentBlock[]
```

### Query behaviour

- All conditions are ANDed — a block must match every specified condition
- `type` array: block must match ANY of the listed types (OR within type list)
- `content` string: case-insensitive substring match against `block.content`
- `properties` matching: each key must exist on the block and value must match
- `section` matching: returns only blocks that appear after a `section:` block
  whose content matches, up to the next `section:` block
- `limit`: return at most N results

### Usage examples (these become tests):

```typescript
// All open tasks
queryDocument(doc, { type: 'task' })

// All tasks owned by Ahmed
queryDocument(doc, { type: 'task', properties: { owner: 'Ahmed' } })

// All steps that use email tools
queryDocument(doc, { type: 'step', properties: { tool: /email/ } })

// All gate blocks
queryDocument(doc, { type: 'gate' })

// All blocks in the "Deployment" section
queryDocument(doc, { section: 'Deployment' })

// Multiple types
queryDocument(doc, { type: ['step', 'gate', 'decision'] })

// Content search
queryDocument(doc, { content: 'database' })

// Combined
queryDocument(doc, {
  type: 'task',
  section: 'Action Items',
  properties: { priority: '1' }
})
```

---

## PART 5 — diffDocuments()

File: `packages/core/src/diff.ts` (new file)

```typescript
export interface BlockModification {
  blockId: string;          // uses 'before' block's id
  before: IntentBlock;
  after: IntentBlock;
  contentChanged: boolean;
  propertiesChanged: string[];   // list of property keys that changed
  typeChanged: boolean;
}

export interface DocumentDiff {
  added: IntentBlock[];
  removed: IntentBlock[];
  modified: BlockModification[];
  unchanged: IntentBlock[];
  summary: string;          // human-readable: "3 added, 1 removed, 2 modified"
}

export function diffDocuments(
  before: IntentDocument,
  after: IntentDocument
): DocumentDiff
```

### Diff algorithm

Blocks are matched by content similarity, not by ID (IDs are regenerated on
each parse so they cannot be used for comparison across versions).

Matching strategy:
1. Exact content + type match → unchanged
2. Same type, content similarity > 80% (Levenshtein-based) → modified
3. No match found → added (in after) or removed (in before)

Keep the matching algorithm simple and deterministic. Do not import any
string similarity library — implement a simple character-level comparison.

The diff is best-effort. For the use cases (editor change history, git commit
summaries), approximate matching is sufficient.

---

## PART 6 — Public API Updates

File: `packages/core/src/index.ts`

Add all new exports to the public API:

```typescript
// Existing exports — unchanged
export { parseIntentText } from './parser';
export { renderHTML, renderPrint } from './renderer';
export { mergeData, parseAndMerge } from './merge';

// New exports
export { parseIntentTextSafe } from './parser';
export type { ParseOptions, ParseResult, ParseWarning, ParseError } from './parser';

export { documentToSource } from './source';

export { validateDocument } from './validate';
export type { ValidationResult, ValidationIssue } from './validate';

export { queryDocument } from './query';
export type { QueryOptions } from './query';

export { diffDocuments } from './diff';
export type { DocumentDiff, BlockModification } from './diff';
```

Also update `intenttext.browser.js` bundle to include the new exports.

---

## PART 7 — TESTS

File: `packages/core/tests/hardening.test.ts`

Minimum test coverage required:

**parseIntentTextSafe:**
- Returns ParseResult with empty warnings on valid input
- Never throws on null, undefined, empty string, random garbage
- Truncates lines over maxLineLength and adds LINE_TRUNCATED warning
- Unknown keyword with 'note' option: treated as note, warning added
- Unknown keyword with 'skip' option: line skipped, warning added
- Respects maxBlocks limit, adds MAX_BLOCKS_REACHED warning

**documentToSource:**
- Round-trip: parse → source → parse produces identical block types and content
- Round-trip works for every block type
- Properties serialise in canonical order
- `---` divider round-trips correctly
- `//` comment round-trips correctly
- `break:` round-trips correctly
- Inline formatting (`*bold*`, `_italic_`) is preserved via originalContent
- Pipe tables round-trip correctly

**validateDocument:**
- Valid document with no issues returns `{ valid: true, issues: [] }`
- decision: with missing then/else step ID returns STEP_REF_MISSING error
- step: with missing depends target returns DEPENDS_REF_MISSING error
- duplicate id: properties returns DUPLICATE_STEP_ID error
- gate: without approver: returns GATE_NO_APPROVER warning
- step: without tool: returns STEP_NO_TOOL warning
- {{unresolved}} variable returns UNRESOLVED_VARIABLE warning
- Document with only warnings is still valid: true

**queryDocument:**
- Returns all blocks when no options specified (or empty options)
- Filters by single type correctly
- Filters by type array (OR logic)
- Filters by content substring
- Filters by content RegExp
- Filters by properties exact match
- Filters by properties RegExp
- Filters by section
- Combined filter (type + section + properties)
- Respects limit option
- Returns empty array when no match

**diffDocuments:**
- Identical documents: all unchanged, none added/removed/modified
- One block added: appears in added
- One block removed: appears in removed
- Content change: appears in modified with contentChanged: true
- Property change: appears in modified with correct propertiesChanged array
- summary string is correctly formatted

Target: 60+ new tests. All 255 existing tests must still pass.

---

## CONSTRAINTS

- No new npm dependencies
- No breaking changes to existing API
- TypeScript strict mode — no `any` without comment
- `documentToSource` must be pure (no mutation)
- `validateDocument` must be pure (no mutation)
- `queryDocument` must be pure (returns new array, never mutates doc)
- `diffDocuments` must be pure

---

## VERSION

Bump `packages/core/package.json` version to `2.2.0`.
Add CHANGELOG.md entry covering all five new additions.

*IntentText Core Hardening Prompt — March 2026*
