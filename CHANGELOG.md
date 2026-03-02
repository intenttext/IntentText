# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog.

## [Unreleased]

## [1.3.0] - 2026-03-02

### Added

- `//` comment syntax — lines starting with `//` are silently ignored by the parser
- `subsection:` keyword alias for `sub:`
- `version` field on parsed `IntentDocument` (now emits `"1.2"`)
- `info:`, `warning:`, `tip:`, `success:` callout keywords in types.ts KEYWORDS export
- Pipe escaping with `\|` inside content

### Changed

- `done:` now normalizes to `{type: "task", properties: {status: "done"}}` instead of `{type: "done"}`
- Checkbox `[x]` also normalizes to `type: "task"` with `status: "done"`
- Removed unused modules: ai-features, knowledge-graph, collaboration, export, templates, dates
- Removed deprecated `InlineMark` type and `marks` field from `IntentBlock`
- Browser bundle reduced from ~60KB to ~19KB

### Fixed

- `//` comment lines inside code blocks are now preserved as code content (previously swallowed as comments)

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
