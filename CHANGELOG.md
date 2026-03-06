# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog.

## [Unreleased]

## [2.10.0] - 2026-03-07

### Added

- **Theme System** — JSON-based design value sets applied by the renderer. 8 built-in themes: `corporate`, `minimal`, `warm`, `technical`, `print`, `legal`, `editorial`, `dark`. Themes control typography, colors, spacing, and block-level styling. Applied via `meta: | theme: name` or `renderHTML(doc, { theme: "name" })`. `generateThemeCSS(theme, mode)` produces CSS custom properties. Resolution order: options → meta → none.
- **Shallow Index Builder** — `.it-index` architecture for folder-level querying. `buildShallowIndex()`, `checkStaleness()`, `updateIndex()` for incremental index maintenance. Each index covers only direct files in its folder — never recursive.
- **Index Composition and Query** — `composeIndexes()` merges multiple shallow indexes. `queryComposed()` filters by type, content, by, status, section. Three output formatters: `formatTable()`, `formatJSON()`, `formatCSV()`.
- **Natural Language Query** — `askDocuments()` uses Anthropic API to answer questions about `.it` documents. `serializeContext()` converts composed results to LLM-ready context.
- **CLI Commands** — `query <dir>`, `index <dir> [--recursive]`, `ask <dir> "question"`, `theme list`, `theme info <name>`, `--theme` flag on render commands.
- **Hub Platform** — GitHub OAuth authentication, user accounts, publish/review workflow, theme browsing, community and curated template tiers, admin review queue, user profile pages.
- **60 Templates** — 8 domains: business (14), reports (8), editorial (8), book (6), personal (6), agent (8), organization (6), developer (4). Each with paired `.data.json` example data.
- 62 new tests (628 total passing across 17 test files).

## [2.7.0] - 2026-03-06

### Added

- **`policy:` keyword** — standing behavioural rules for AI agents. Supports `if:`, `always:`, `never:`, `action:`, `requires:`, `notify:`, `priority:`, `id:`, `scope:`, `after:` properties. Rendered as styled rule cards in HTML output. Validated for missing conditions (`POLICY_NO_CONDITION`) and missing actions (`POLICY_NO_ACTION`). `documentToSource()` canonical property order. 19 new tests (445 total).

## [2.6.0] - 2026-03-05

### Added

- **`parseIntentTextSafe()`** — production-grade parser wrapper that never throws. Adds configurable unknown-keyword handling (`'note'` / `'skip'` / `'throw'`), `maxBlocks` cap, `maxLineLength` truncation, and strict mode. Returns a `SafeParseResult` with `document`, `warnings`, and `errors` arrays.
- **`documentToSource()`** — reverse of the parser. Converts a parsed `IntentDocument` (JSON) back to valid `.it` source text with round-trip guarantee. Serialises properties in canonical order per block type.
- **`validateDocumentSemantic()`** — semantic validation beyond syntax. Checks cross-block references (`STEP_REF_MISSING`, `DEPENDS_REF_MISSING`, `PARALLEL_REF_MISSING`), self-referencing calls (`CALL_LOOP`), structural rules (`RESULT_NOT_TERMINAL`, `DUPLICATE_STEP_ID`, `EMPTY_SECTION`), missing required properties (`GATE_NO_APPROVER`, `STEP_NO_TOOL`, `HANDOFF_NO_TO`, `RETRY_NO_MAX`), unresolved `{{variables}}`, and template detection.
- **`queryDocument()`** — simple, intuitive block query API. Filter by `type` (single or array), `content` (string or RegExp), `properties` (exact or RegExp), `section`, and `limit`. All conditions are ANDed; type arrays are ORed.
- **`diffDocuments()`** — semantic diff between two document versions. Matches blocks by content similarity (Levenshtein-based), detects added/removed/modified/unchanged blocks, tracks content and property changes, and produces a human-readable summary string.
- 68 new tests (426 total passing across 12 test files).

## [2.5.0] - 2026-03-06

### Added

- **Document Generation Engine** — full template-to-print pipeline.
- **Layout blocks**: `font:`, `page:`, `break:` — declare typography, page size, margins, and explicit page breaks.
- **Writer blocks**: `byline:`, `epigraph:`, `caption:`, `footnote:`, `toc:`, `dedication:` — semantic elements for book-style and professional documents.
- **`footnote-ref` inline** — `{1}` syntax renders superscript footnote references linked to `footnote:` definitions.
- **`mergeData(doc, data)`** — template merge engine resolving `{{variable}}` placeholders from JSON data. Supports dot notation, array indices, system variables (`{{date}}`, `{{year}}`), and runtime variables (`{{page}}`, `{{pages}}`).
- **`parseAndMerge(itString, data)`** — parse and merge in one step.
- **`renderPrint(doc)`** — print-optimized HTML renderer with dynamic CSS from `font:`/`page:` blocks, `@media print` rules, and `@page` sizing.
- **CLI flags**: `--data <file.json>` for template merge, `--print` for print-optimized HTML, `--pdf <output.pdf>` for PDF generation via Puppeteer.
- Seven example templates: invoice, purchase-order, contract, book-chapter, article, meeting-minutes, report — with matching `.data.json` files.
- 44 new tests (308 total passing across 10 test files).

### Changed

- **HTML renderer CSS overhauled** — minimal, professional, serif-based book-like styling. No colors, neutral grays, Georgia font stack. Designed for book writers, journalists, court writers, and general readers.
- Footnotes are collected and rendered as a numbered list at the bottom of the document.
- Section and sub-section headings now include `id` attributes for TOC anchor linking.
- Parser detects document generation blocks and sets `version: "2.5"` on the document.
- Parser handles pipe-first property syntax (e.g., `font: | family: Georgia`) correctly.

## [2.4.0] - 2026-03-05

### Added

- Native single-backtick inline code parsing (`` `code` ``) in core parser.
- New inline node types for writer-first flows:
  - `highlight` from `^text^`
  - `inline-quote` from `==text==`
  - `inline-note` from `[[text]]`
  - shorthand inline links from `[[label|url]]`
  - `date` from `@today`, `@tomorrow`, `@YYYY-MM-DD`
  - `mention` from `@person`
  - `tag` from `#topic`
- Paragraph-first prose behavior for plain lines:
  - consecutive no-keyword lines merge into one `body-text` paragraph
  - blank lines split paragraphs
- Optional per-block alignment via `align:` (`center`, `right`, `justify`).
- Dedicated prose render style (`.intent-prose`) for long-form readability.

### Changed

- Markdown-to-IntentText converter now preserves inline code as single backticks instead of converting to triple-backtick inline form.
- Docs updated for writer-first syntax and prose behavior in README, SPEC, USAGE, and cheatsheet.

### Planned (Not Implemented Yet)

- Smart typing replacements (`--`, `...`, typographic quotes).
- App-level writing UX modes: `Book`, `News`, `Journal`, `Plain`; focus mode; typewriter scroll.

## [2.3.0] - 2026-03-05

### Added

- **`gate:` block** — Human approval checkpoint with `approver:`, `timeout:`, `fallback:` properties. Status defaults to `blocked`.
- **`call:` block** — Synchronous sub-workflow composition with `input:`, `output:` properties. Status defaults to `pending`.
- **`emit:` block** — Workflow signal / status event with `phase:`, `level:` properties. Default `level: info`.
- **`{{variable}}` interpolation** — Variable references in property values (e.g. `input: {{userId}}`). Preserved as strings for runtime substitution.
- **`join:` property** on `parallel:` — Barrier semantics: `all` (default), `any`, `none`.
- **`on:` property** on `wait:` — Trigger condition (e.g. `on: smoketest.complete`).
- **`approver:` property** on `gate:` — Person/role required for approval.
- New `AgenticStatus` values: `approved`, `rejected`, `waiting`.
- `VariableRef` interface exported from core.
- 35 new tests (255 total).

### Changed

- `status:` standalone block is now an alias for `emit:` (backward compatible).
- `context:` block now supports both `key = "value"` and `| key: value` pipe syntax.
- `result:` is now terminal-only — ends workflow and declares output. Use `output:` property on `step:` for step-level outputs.
- Smart defaults: `gate` → `status: blocked`, `parallel` → `join: all`, `call` → `status: pending`, `emit` → `level: info`.
- SPEC.md updated to v2.3, all keyword tables reflect final design.
- USAGE.md updated to v2.3 with gate/call/emit examples.
- README.md keyword tables updated, test count updated to 255.

### Removed

- **`schema:` block** — Runtime concern, not format concern. Removed from parser and keyword set.

## [1.4.0] - 2026-03-03

### Changed

- Parser now emits `version: "1.4"` on parsed documents
- SPEC.md section 12 rewritten — separates implemented features from roadmap
- `html-to-it.ts` JSDoc updated to clarify Node.js-only requirement
- Fixture JSON files updated to match parser version output
- `fixtures.test.ts` normalize function now strips `undefined` values

### Removed

- Removed `vscode-extension/` directory (will be a separate repo)

### Fixed

- Fixture tests were asserting `version: "1.2"` while parser emitted `"1.3"` — now aligned

## [1.3.0] - 2026-03-02

### Added

- **`convertHtmlToIntentText(html)`** — new HTML-to-IntentText converter. Maps semantic HTML elements (`<h1>` → `title:`, `<h2>` → `section:`, `<ul>` → list items, `<table>` → pipe tables, `<blockquote>` → `quote:`, etc.) with full inline formatting support
- **`convertMarkdownToIntentText`** now exported from browser bundle
- Blockquote (`>`) → `quote:` conversion in markdown converter
- Horizontal rule (`---`, `***`) → `---` divider in markdown converter
- Markdown table support in markdown converter
- `subsection:` keyword alias for `sub:`
- `version` field on parsed `IntentDocument` (emits `"1.2"`)
- `info:`, `warning:`, `tip:`, `success:` added to exported KEYWORDS array
- `//` comment syntax — lines starting with `//` are silently ignored

### Changed

- **Breaking**: Removed stub modules `ai-features`, `knowledge-graph`, `collaboration`, `export`, `templates`, `dates` — these were never production-ready
- **Breaking**: `done:` normalizes to `{type: "task", properties: {status: "done"}}` instead of `{type: "done"}`
- Checkbox `[x]` also normalizes to `type: "task"` with `status: "done"`
- Removed deprecated `InlineMark` type and `marks` field from `IntentBlock`
- `flattenBlocks()` extracted to shared `utils.ts` (internal refactor)
- KEYWORDS array is now the single source of truth in `types.ts`
- Browser bundle reduced from ~60KB to ~21KB

### Fixed

- `//` comment lines inside code blocks are now preserved (previously swallowed)
- `**multiple** bold **segments**` in markdown converter now converts correctly
- `query.ts`: `total` field now counts all blocks including nested children
- `schema.ts`: `allowUnknownProperties` now only warns when explicitly set to `false`

## [1.2.0] - 2026-03-01

### Added

- `subsection:` alias for `sub:`
- `done:` normalization to `{type: "task", status: "done"}`
- `version: "1.1"` field on IntentDocument
- `//` comment syntax

## [1.1.0] - 2026-02-28

### Added

- Polished HTML renderer with callouts, tables, tasks, RTL support
- Query engine (`queryBlocks`, `parseQuery`)
- Schema validation (`validateDocument`, `createSchema`)

## [1.0.0] - 2026-02-27

### Added

- Initial public release of the IntentText v1.0 parser and HTML renderer.
