# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog.

## [Unreleased]

## [4.3.0] - 2026-06-12

### Added

- **Scoped document styles — the `style:` block.** House styling declared once,
  document-wide, without per-line props and without arbitrary CSS:
  `style: section | color: #0a7 | weight: 600`. Targets are block types
  (`title summary section sub text quote callout info table table-header metric
  contact divider`); values are the same constrained style-key vocabulary used
  everywhere else. Rules are emitted after the theme (house style wins; per-line
  props and inline spans still override). `style:` lines are invisible in the body,
  round-trip byte-exact, and values are sanitized for the stylesheet context.
- **Editor support, first-class:** each rule shows as a visible 🎨 chip (target +
  declarations) and is applied **live** to the canvas — and therefore to the WYSIWYG
  print export — via the same `documentStyleCSS()` engine core uses, with an editor
  selector map. `style` appears in the editor's Insert menu (registry-driven) and the
  VSCode grammar highlights it (parity gates pass: 38 canonical keywords).
- New exports: `collectDocumentStyles()`, `documentStyleCSS(doc, selectorMap?, prefix?)`,
  `DOC_STYLE_TARGETS`, `DocumentStyleRule`.

## [@intenttext/pdf 1.0.0] - 2026-06-12

New opt-in package for **server-side PDF generation** (core stays zero-dependency).
For the moments no human is at a browser: emailing invoices, compliance archiving,
batch statement runs.

- `issuePDF(template, data, { signer, role?, theme? })` — the enterprise issue flow in
  one call: merge (`missing: "blank"`) → **seal** the merged document (tamper-evident
  SHA-256) → real PDF bytes. Returns `{ source, hash, at, pdf }`: store the sealed
  `.it` source on the record (the queryable, verifiable legal artifact) and email/
  archive the bytes.
- `issueDocument()` — same flow minus Chrome (returns print-ready `html`) for
  rendering sidecars like Gotenberg; `renderPDF()` / `htmlToPDF()` primitives;
  `createPdfRenderer()` for batch runs (reuses one Chrome).
- Engine resolution: `puppeteer` (bundled Chromium) → `puppeteer-core` + system Chrome
  (`executablePath` / `$PUPPETEER_EXECUTABLE_PATH` / `$CHROME_PATH` / common paths) →
  clear install guidance. Both are optional peers.
- Tests incl. a real end-to-end (system Chrome): PDF magic bytes, seal verifies intact,
  tamper detected, missing fields blanked, sealed source stays queryable.

## [4.2.1] - 2026-06-12

Production hardening for embedding as an ERP print engine (invoices, receipts,
statements). Audited against real templates; the fixes below close correctness,
parity, and security gaps found in the `renderPrint` / merge path.

### Security

- **Stored-XSS via style-property values is fixed.** A merged value used in a style
  position (e.g. `color: {{brandColor}}`) could contain a `"` and break out of the
  `style="…"` attribute to inject an event handler. Style values are now stripped of
  `;{}` and HTML-escaped, so attribute breakout is impossible while valid CSS (including
  quoted `font-family`) is preserved. Same hardening applied to `divider`'s `style:`.

### Fixed

- **Running page numbers work in print.** `{{page}}` / `{{pages}}` in a `header:`/`footer:`
  now compile to CSS `counter(page)` / `counter(pages)` instead of printing the literal
  `{{page}}`. Header/footer text is escaped for the CSS *string* context (no more stray
  `&quot;`). The editor and core now share one `cssContentValue()` for this — single
  source of truth.
- **`metric:` totals match the editor.** A plain `metric: Subtotal | value: …` renders as
  a label→value total row (amount right-aligned; `Total`/`Balance Due` emphasized), like
  the editor — not a boxed KPI card. A metric with `target:`/`trend:`/`period:` still
  renders as a KPI card. So an invoice/receipt prints the same through core as it looks in
  the editor.
- **`margin:` (singular) is honored,** matching the editor and most authors — previously
  only `margins:` was read, so a custom margin was silently ignored. With no margin set,
  narrow pages (≤120mm, e.g. an 80mm receipt) default to a tight 4mm instead of a 20mm A4
  margin that would consume half the roll.

### Added

- **`parseAndMerge` / `mergeData` accept `{ missing: "keep" | "blank" }`.** In `"blank"`
  mode a `{{field}}` with no data renders empty, so a finished document never shows a
  literal `{{customer.phone}}`. Default stays `"keep"` for template authoring; the ERP
  kit defaults to `"blank"`.
- Exported `cssContentValue()` and the `MergeOptions` type.
- `demo/erp-integration/`: an 80mm `receipt-template.it`; the kit now merges with
  `missing: "blank"`. New ecosystem docs cover receipts, missing-data, totals, and Arabic.
- 13 production-printing regression tests (metric parity, page counters, CSS/style
  escaping, missing-field modes, multi-page header repeat, RTL) — 888 total, all passing.

## [4.2.0] - 2026-06-10

### Added

- **Inline styled spans — `[text]{ key: value; key: value }`.** Style _part_ of a line
  (one word colored, a phrase bold-and-larger, combined styles) without affecting the
  rest. Carries the same style keys as block-level props, but `;`-separated (the `|` is
  the reserved line delimiter). Parses to a `styled` inline node and renders to
  `<span style="…">` via the **same** property→CSS mapping as block props, so partial
  styling is reproduced identically by `renderHTML`, `renderPrint`, the editor, and any
  consumer. Matched after `[text](url)` links and `[[notes]]` so it never shadows them.
- **New style keys `underline:` / `strike:` / `valign:`.** Map to `text-decoration`
  (underline + line-through combine) and `vertical-align` (`sub` / `super`), so spans —
  and blocks — can carry underline, strikethrough, and sub/superscript.
- **ERP integration kit** (`demo/erp-integration/`, `pnpm demo:erp`): a portable,
  one-file pattern for using IntentText as a print/report engine inside an app — store
  a `.it` template as a string, `parseAndMerge(template, data)` →
  `renderHTML`/`renderPrint`, browser print (zero-dep) or server PDF (puppeteer).
  Documented in the **ERP Integration** ecosystem guide.

### Changed

- **Visual editor styling is now faithful end-to-end.** The editor previously flattened
  every mark in a line to whole-line properties (so partial styling was lost or smeared)
  and emitted style keys that didn't match core's (`style`/`font`/`bgcolor` vs core's
  `italic`/`family`/`bg`), so whole-line italic/font/highlight never rendered through
  core. The bridge now serializes each text run independently (semantic marks or a
  `[text]{…}` span), parses marks/spans back from core's inline AST, and is unified on
  core's canonical keys — so what you style in the editor prints identically through the
  template/print path. A fidelity guard surfaces any styling that can't be saved to
  `.it` (regression net).
- **Enterprise-themes showcase** (`pnpm demo:themes`, one `.it` → three themes) and
  **WYSIWYG editor export** (the PDF/HTML now prints the editor's own rendered DOM, so
  it matches the on-screen view exactly).

## [4.1.2] - 2026-06-10

### Fixed

- **Print/PDF was unstyled ("primitive").** `renderPrint` only carried a sparse base
  stylesheet, so the line-items table, contacts, and most elements rendered unstyled.
  The full `.intent-*`/`.it-*` element CSS is now shared between `renderHTML` (screen)
  and `renderPrint` (print) via a single `DOCUMENT_CSS` module, so PDFs are styled the
  same as the on-screen document (themes layer colors/fonts on top).
- **Table rows clipped at page breaks.** Rows that straddled a page boundary were
  hidden behind the running footer/header. Added `break-inside: avoid` on rows, repeat
  the table header per page (`thead{display:table-header-group}`), and let sections
  flow across pages while keeping headings with their content.

### Notes

- Remaining for a visual polish pass: `.intent-metric` styling in print, page margins,
  and overall enterprise invoice/contract layout refinement.

## [4.1.1] - 2026-06-10

### Fixed

- **Template placeholders no longer flagged as warnings.** A document that uses
  `{{…}}` placeholders but declares no context (`context:` block / metadata / step
  outputs) is now treated as a template — its placeholders resolve at merge time, so
  they are not "unresolved variable" warnings. When a context IS declared, undeclared
  `{{vars}}` remain warnings (typo detection). Fixes the noisy
  "Unresolved variable {{…}}" warning on template files in the editor and VSCode.

## [4.1.0] - 2026-06-10

The finalization release: one canonical implementation, a tiered format, and a
focused supported surface.

### Removed

- **Rust/WASM core deleted.** `packages/rust` and the `rust-core` compatibility
  shim are gone; the TypeScript parser is the single source of truth. Internal
  callers now import `parseIntentText` directly from `./parser`. The no-op
  `initRustCore`/`setRustCoreRuntimeMode`/fallback-telemetry API was removed from
  the public surface.
- **Python duplicate parser deleted.** The Python package no longer re-implements
  the grammar. It is now a thin client (`parse`/`parse_safe`) that delegates to the
  canonical core CLI, so Python results can never drift. Bumped to 4.0.0.
- Removed the dead `prepare:wasm` build step and stale `public/rust-wasm/` assets
  from the editor and desktop apps, and obsolete core scripts
  (`report-fallback-telemetry`, `check-no-parser-runtime-coupling`).

### Added

- **Keyword tiers.** Canonical keywords are now grouped into a small everyday
  `core` set (13) plus opt-in `agent`, `contract`, `data`, and `print` profiles.
  Exposed as `KEYWORD_TIERS`, `CORE_KEYWORDS`, `tierOf`, and `KeywordTier`.
- **Consumer parity gate** (`parity:check`) — fails the build if the VSCode grammar
  drifts from the canonical `LANGUAGE_REGISTRY`.
- Canonical [`SPEC.md`](packages/core/SPEC.md) and root
  [`ARCHITECTURE.md`](ARCHITECTURE.md).

### Changed

- Scope focused: **core, mcp, vscode, editor** are the supported surface; hub,
  desktop, docs, builder, and the Python client are marked experimental.
- CI now runs the keyword + parity gates and builds the full supported surface.

### Notes

- **No breaking grammar changes.** Documents that parsed under v3.x parse
  identically. Tiering is contract metadata; every keyword is still recognized, and
  unknown keywords still pass through as `custom`.

## [3.1.0] - 2026-03-09

### Changed

- **Rust Core Default On** - `@intenttext/core` now defaults to Rust/WASM mode without requiring any environment variable.
- **Engine Override Policy** - TypeScript mode remains available only as an explicit override (`INTENTTEXT_CORE_ENGINE=ts` or `globalThis.__INTENTTEXT_CORE_ENGINE = "ts"`).
- **Safety Fallbacks Retained** - Temporary TS fallback behavior remains in place for compatibility-sensitive paths (options/theme and WASM failure scenarios) while parity hardening continues.

### Docs

- Updated engine-selection documentation to reflect Rust-default behavior and explicit TS override usage.

## [3.0.0] - 2026-03-09

### Added

- **Rust Core Engine Path** — `@intenttext/core` now ships Rust/WASM artifacts generated from `intenttext-rust` under `dist/rust-wasm`.
- **Rust Engine API Bridge** — `parseIntentText`, `renderHTML`, `documentToSource`, and `validateDocumentSemantic` now flow through a Rust-core bridge module when Rust mode is enabled.

### Changed

- **Engine Selection** — Added explicit Rust engine activation via `INTENTTEXT_CORE_ENGINE=rust` (or `globalThis.__INTENTTEXT_CORE_ENGINE = "rust"`) for controlled cutover while parity hardening continues.
- **Build Output** — Core build now copies Rust WASM runtime artifacts into the published package.

## [2.14.0] - 2026-03-09

### Added

- **Workflow Executor** — `executeWorkflow(document, runtime)` runs agentic workflow documents. Handles `step:`, `decision:`, `gate:`, `trigger:`, `result:`, and `audit:` blocks. Caller provides tool implementations via `WorkflowRuntime`. Outputs flow between steps via shared `ExecutionContext`. Decision conditions evaluated with a safe recursive-descent parser (no `eval()`). Gate blocks pause execution for external approval. Dry-run mode validates flow without calling tools. Status written back to every processed block. 38 new tests.

### Changed

- **Keyword Freeze at 37 Canonical Keywords** — `CANONICAL_KEYWORDS` frozen at exactly 37 entries. Extension keywords (`signal`, `figure`, `byline`, etc.) now emit their real block type directly (e.g. `type: "signal"`) instead of wrapping in `type: "extension"` with `x-type` metadata. Eliminates `effectiveType()` indirection layer entirely.
- **Callout Consolidation** — `warning:`, `danger:`, `tip:`, `success:` are now aliases of `info:` with `properties.type` injection for variant styling. Removed dead `BlockType` union members (`"warning"`, `"tip"`, `"success"`, `"danger"`). Renderer consolidated to single `case "info":` handler.
- **Code Quality** — Removed dead `interpolateVariables()` function. Standardized `Object.create(null)` for property dictionaries (prototype pollution guard). Fixed stale type comments.

## [2.11.0] - 2026-03-08

### Added

- **8 New Keywords** — `ref:` (redesigned as cross-document reference with `file:`/`url:`/`rel:` properties), `def:` (glossary/definitions), `metric:` (measurable values with trend indicators), `amendment:` (formal changes to frozen documents), `figure:` (document figures with `<figure>`/`<figcaption>` rendering), `signline:` (physical signature placeholders for print), `contact:` (structured contact information with `mailto:`/`tel:` links), `deadline:` (temporal commitments with urgency coloring).
- **14 Validation Rules** — `REF_MISSING_TARGET`, `REF_MISSING_REL`, `DEF_MISSING_MEANING`, `DEF_DUPLICATE_TERM`, `METRIC_MISSING_VALUE`, `METRIC_INVALID_TREND`, `AMENDMENT_WITHOUT_FREEZE`, `AMENDMENT_MISSING_REF`, `AMENDMENT_MISSING_NOW`, `FIGURE_MISSING_SRC`, `FIGURE_MISSING_CAPTION`, `CONTACT_NO_REACH`, `DEADLINE_MISSING_DATE`, `DEADLINE_PAST`.
- **23 New Aliases** — `references`/`see`/`related` → `ref`, `define`/`term`/`glossary` → `def`, `kpi`/`measure`/`stat` → `metric`, `amend`/`change` → `amendment`, `fig`/`diagram`/`chart` → `figure`, `signature-line`/`sign-here`/`sig` → `signline`, `person`/`party` → `contact`, `due`/`milestone`/`due-date` → `deadline`, `citation`/`source`/`reference` → `quote`.
- **CLI `amend` Command** — `intenttext amend <file> --section --was --now --ref` to add amendment blocks to frozen documents with interactive confirmation.
- **VS Code Extension** — Syntax highlighting, hover docs, snippets, and schemas for all 8 new keywords.
- **17 New Templates** — Contract references, glossaries, executive dashboards, SLA reports, agent monitoring, contract amendments, research reports with figures, signature pages, contact directories, milestone trackers, and regulatory calendars.
- 90 new tests (718 total passing across 18 test files).

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

- Native single-backtick inline label parsing (`` `label` ``) in core parser — renders as badge/pill.
- Triple-backtick inline code (` ```code``` `) for monospace code spans.
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

- Markdown-to-IntentText converter now converts inline code to triple backticks (` ```code``` `), since single backtick is label syntax in IntentText.
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
