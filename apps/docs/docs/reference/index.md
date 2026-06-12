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
- [Aliases](./keywords/aliases) — alias forms mapped to canonical keywords, including the **33 Arabic aliases** (`عنوان`→`title`, `مهمة`→`task`, `صف`→`row`, …) that round-trip as written

## Keyword tiers

The canonical keywords are grouped into a small everyday **core** set plus opt-in
**profiles**, so a plain `.it` document needs only ~13 keywords and everything else is
opt-in. Tiering is contract metadata — the parser still recognizes every keyword, and
unknown keywords pass through as `custom`.

| Tier | Keywords |
| --- | --- |
| **core** (13) | `title` `summary` `meta` `section` `sub` `text` `info` `quote` `code` `image` `link` `task` `done` |
| **agent** | `step` `decision` `gate` `trigger` `result` `policy` `audit` `ask` `context` |
| **contract** | `sign` `approve` `freeze` `track` `amendment` `cite` |
| **data** | `columns` `row` `metric` |
| **print** | `page` `header` `footer` `watermark` `style` `break` `toc` |

The `history:` boundary and `revision:` entries remain recognized alongside the contract
tier (they live below the audit-log boundary rather than in the stable keyword set).
Exposed from `@dotit/core` as `KEYWORD_TIERS`, `CORE_KEYWORDS`, and `tierOf`. See
the canonical [SPEC](https://github.com/intenttext/IntentText/blob/main/packages/core/SPEC.md).

## Properties

- [Pipe Properties](./pipe-properties) — keyword-specific properties
- [Style Properties](./style-properties) — visual properties available on any block

## Systems

- [Templates](./templates) — `{{variables}}`, `each:`, merge API
- [Query](./query) — block queries, document queries, output formats
- [Index Files](./index-file) — `.it-index` shallow architecture
- [CLI](./cli) — every command, every flag
