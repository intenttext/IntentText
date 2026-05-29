---
sidebar_position: 1
title: Reference Overview
---

# Reference

The complete technical reference for the current IntentText language and tooling.

## Keywords

IntentText supports a compact canonical keyword set plus compatibility aliases and extension forms.

- [All Keywords](./keywords) — sortable, filterable keyword table
- [Document Identity](./keywords/document-identity) — `title:`, `summary:`, `meta:`, `context:`, `track:`, `agent:`, `model:`
- [Content](./keywords/content) — `text:`, `quote:`, `cite:`, `warning:`, `danger:`, `tip:`, `info:`, `success:`, `code:`, `image:`, `link:`, `def:`, `figure:`, `contact:`, `byline:`, `epigraph:`, `caption:`, `footnote:`, `dedication:`
- [Structure](./keywords/structure) — `section:`, `sub:`, `break:`, `ref:`, `deadline:`, `embed:`, `toc:`
- [Data](./keywords/data) — `columns:`, `row:`, `input:`, `output:`, `metric:`
- [Agent](./keywords/agent) — `step:`, `gate:`, `trigger:`, `signal:`, `decision:`, `memory:`, `prompt:`, `tool:`, `audit:`, `done:`, `error:`, `result:`, `handoff:`, `wait:`, `parallel:`, `retry:`, `call:`, `loop:`, `checkpoint:`, `import:`, `export:`, `progress:`, `task:`, `ask:`, `assert:`, `secret:`
- [Trust](./keywords/trust) — `approve:`, `sign:`, `freeze:`, `revision:`, `policy:`, `amendment:`, `history:`
- [Layout](./keywords/layout) — `page:`, `font:`, `header:`, `footer:`, `watermark:`, `signline:`, `divider:`
- [Aliases](./keywords/aliases) — alias forms mapped to canonical keywords

## Properties

- [Pipe Properties](./pipe-properties) — keyword-specific properties
- [Style Properties](./style-properties) — visual properties available on any block

## Systems

- [Templates](./templates) — `{{variables}}`, `each:`, merge API
- [Query](./query) — block queries, document queries, output formats
- [Index Files](./index-file) — `.it-index` shallow architecture
- [CLI](./cli) — every command, every flag
