# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog.

## [Unreleased]

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
