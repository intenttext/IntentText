---
sidebar_position: 1
title: Reference Overview
---

# Reference

The complete technical reference for the current IntentText language and tooling.

## Keywords

IntentText supports a compact canonical keyword set plus namespaced extension forms and the
Arabic localized keyword names — and **no Latin synonym aliases**, so every other word you write
is reliably your own custom block.

- [All Keywords](./keywords) — sortable, filterable keyword table
- [Document Identity](./keywords/document-identity) — canonical `title:`, `summary:`, `meta:`, `context:`, `track:` (plus the `x-agent:` `agent:`/`model:` extensions)
- [Content](./keywords/content) — canonical `text:`, `quote:`, `info:` (callout variant set with `type: warning|danger|tip|success`), `code:`, `image:`, `link:` (plus `x-doc:`/`x-writer:` extensions: `def:`, `figure:`, `contact:`, `byline:`, `epigraph:`, `caption:`, `footnote:`, `dedication:`)
- [Structure](./keywords/structure) — canonical `section:`, `sub:`, `toc:` (plus the `x-doc:` `ref:`/`deadline:`/`embed:` extensions)
- [Tasks](./keywords/tasks) — canonical `task:`, `done:`, `ask:`
- [Data](./keywords/data) — canonical `headers:`, `row:`, `metric:` (plus the `x-form:` `input:`/`output:` extensions)
- [Agent](./keywords/agent) — canonical `step:`, `gate:`, `trigger:`, `decision:`, `audit:`, `result:`, `policy:`, `context:`, `ask:` (plus the `x-agent:` orchestration extensions: `signal:`, `memory:`, `prompt:`, `tool:`, `error:`, `handoff:`, `wait:`, `parallel:`, `retry:`, `call:`, `loop:`, `checkpoint:`, `import:`, `export:`, `progress:`, `agent:`, `model:`)
- [Trust](./keywords/trust) — canonical contract-tier `track:`, `approve:`, `sign:`, `freeze:`, `amendment:`, `certify:`, `route:`, `require:` (plus the machine-managed `x-trust:` `history:`/`revision:` blocks)
- [Layout](./keywords/layout) — canonical `page:`, `header:`, `footer:`, `watermark:`, `style:`, `break:` (plus the `x-layout:` `font:`/`divider:` and `x-doc:` `signline:` extensions)
- [Localized (Arabic) Keywords](./keywords/aliases) — the **32 Arabic localized keyword names** (`عنوان`→`title`, `مهمة`→`task`, `صف`→`row`, …) that round-trip as written; every non-reserved word is a collision-free custom block

## Keyword tiers

The canonical keywords are grouped into a small everyday **core** set plus opt-in
**profiles**, so a plain `.it` document needs only ~13 keywords and everything else is
opt-in. Tiering is contract metadata — the parser still recognizes every keyword, and
unknown keywords pass through as `custom`.

| Tier | Count | Keywords |
| --- | --- | --- |
| **core** | 13 | `title` `summary` `meta` `section` `sub` `text` `info` `quote` `code` `image` `link` `task` `done` |
| **agent** | 9 | `context` `ask` `step` `decision` `gate` `trigger` `result` `policy` `audit` |
| **contract** | 8 | `track` `approve` `sign` `freeze` `amendment` `certify` `route` `require` |
| **data** | 3 | `headers` `row` `metric` |
| **print** | 7 | `toc` `page` `header` `footer` `watermark` `style` `break` |

That is the complete set of **40 canonical keywords**. `route:`/`require:` declare a
document's in-file approval policy and `certify:` records an authority certification — all
three are stable contract-tier keywords. The `history:` boundary and `revision:` entries are
**not** tier members: they live below the audit-log boundary as machine-managed `x-trust:`
blocks. The exact, authoritative set is exported from `@dotit/core` as `KEYWORD_TIERS` and
`CANONICAL_KEYWORDS` (with `CORE_KEYWORDS` for the everyday core tier). See the canonical
[SPEC](https://github.com/intenttext/IntentText/blob/main/SPEC.md).

## Format version stamp (optional)

A document MAY declare the grammar version it targets with a single comment in the
leading header (SPEC §5.2):

```intenttext
// it-format: 1.0
title: Quarterly Report
```

It is a **comment**, so it is excluded from every seal hash and round-trips as trivia —
adding or changing it never breaks a seal. The parser exposes it as `document.version`; the
feature level inferred from the blocks actually used is `document.detectedFeatureLevel` (when
no stamp is present, `version` mirrors it). The stamp is advisory self-description for
long-term archives — never required, and never a top-level keyword, so it cannot collide with
content. Only the header comment block is honored (never a comment in the body or inside a
`code:` block).

## Properties

- [Pipe Properties](./pipe-properties) — keyword-specific properties
- [Style Properties](./style-properties) — visual properties available on any block

## Systems

- [Templates](./templates) — `{{variables}}`, `each:`, merge API
- [Query](./query) — block queries, document queries, output formats
- [Index Files](./index-file) — `.it-index` shallow architecture
- [CLI](./cli) — every command, every flag
