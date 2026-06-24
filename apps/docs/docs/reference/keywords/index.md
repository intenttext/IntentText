---
sidebar_position: 1
title: Keywords
---

import KeywordTable from '@site/src/components/KeywordTable';

# Keywords

IntentText has **41 canonical keywords** (13 in the everyday core tier), grouped by purpose. Each keyword maps to a typed block with a fixed syntax, a defined set of pipe properties, and predictable rendering behavior.

<KeywordTable />

## How to read this table

- **Keyword** — the canonical name you write in a `.it` file
- **Category** — the functional group
- **Since** — the version when this keyword was introduced
- **Description** — what the block does
- **Properties** — keyword-specific pipe properties (not including [style properties](../style-properties) which are available on all blocks)

## Canonical keyword tiers

The 41 canonical keywords are grouped into five tiers (`KEYWORD_TIERS` in `@dotit/core`).
The tier counts are authoritative; the documentation splits the everyday **core** tier
across several category pages (Document Identity, Structure, Content, Tasks) for readability.

| Tier         | Count | Keywords / purpose                                                                                  |
| ------------ | ----- | -------------------------------------------------------------------------------------------------- |
| **core**     | 13    | `title` `summary` `meta` `section` `sub` `text` `info` `quote` `code` `image` `link` `task` `done` |
| **agent**    | 9     | `context` `ask` `step` `decision` `gate` `trigger` `result` `policy` `audit`                       |
| **contract** | 9     | `cite` `track` `approve` `sign` `freeze` `amendment` `certify` `route` `require`                   |
| **data**     | 3     | `headers` `row` `metric`                                                                            |
| **print**    | 7     | `toc` `page` `header` `footer` `watermark` `style` `break`                                          |

Each keyword has a dedicated entry in its category page with full syntax, properties table, examples, and behavioral notes. The documentation pages map onto the tiers as: Document Identity / Structure / Content / Tasks cover the **core** tier (plus `context` and `cite`); Agent covers **agent**; Trust covers **contract**; Data covers **data**; Layout covers **print**.

## Write keywords in Arabic

The canonical keywords ship with **33 registered Arabic localized keyword names** — `عنوان`→`title`, `قسم`→`section`, `مهمة`→`task`, `صف`→`row`, `توقيع`→`sign`, and more. These are first-class localized names, not aliases: an Arabic document gets full canonical semantics, and the serializer re-emits keywords **as written**, so Arabic documents stay Arabic through every round-trip (sealed documents keep their hash):

```intenttext
عنوان: عرض سعر — توريد أجهزة الحاسوب
قسم: البنود
أعمدة: الوصف | الكمية | الإجمالي
صف: حاسوب محمول | 10 | 45,000 QAR
مؤشر: الإجمالي المستحق | value: 45,000 QAR
مهمة: مراجعة العرض | owner: سارة | due: 2026-06-25
توقيع: أحمد الراشد | role: المدير التنفيذي | at: 2026-06-12T09:00:00Z
```

The `مهمة:` line is a `task` block (`type=task` queries match it), the table keywords build a real `table`, and `توقيع:` is a tamper-evident `sign:` seal. Keywords and property keys are Unicode words in general, so any-script *custom* keywords (`مصروف: كراسي | فئة: أثاث`) parse as typed, queryable blocks too. Full table: [Localized (Arabic) Keywords →](./aliases#the-33-arabic-localized-keyword-names).

## Extension keywords

Beyond the 41 canonical keywords, IntentText supports **extension blocks** via a namespaced `x-ns:` prefix. Extensions cover domain-specific and advanced use cases without polluting the core keyword set.

| Namespace   | Domain                       | Stability    | Examples                                                                                                                                                              |
| ----------- | ---------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `x-form:`   | Typed I/O parameters         | **stable**   | `input`, `output`                                                                                                                                                    |
| `x-writer:` | Editorial / publishing       | stable       | `byline`, `figure`, `caption`, `footnote`, `epigraph`, `dedication`                                                                                                  |
| `x-doc:`    | Document cross-references    | stable       | `def`, `contact`, `deadline`, `ref`, `signline`, `attach`                                                                                                            |
| `x-agent:`  | Advanced agent orchestration | stable       | `loop`, `parallel`, `retry`, `wait`, `handoff`, `call`, `checkpoint`, `signal`, `import`, `export`, `progress`, `tool`, `prompt`, `memory`, `error`, `agent`, `model` |
| `x-trust:`  | Trust history                | machine-managed | `history`, `revision`                                                                                                                                             |
| `x-layout:` | Advanced typography          | stable       | `font`, `divider`                                                                                                                                                    |
| `x-exp:`    | Experimental                 | experimental | `assert`, `secret`                                                                                                                                                   |

Extension blocks follow the same pipe-property syntax as canonical blocks — `x-<namespace>: <type> | key: value` — and are parsed, rendered, and queryable through all core APIs:

```intenttext
x-form: input | label: Company name | key: company | type: text | required: yes
x-writer: byline | date: 2026-03-09
x-doc: ref | file: ./policy.it | rel: supersedes
x-doc: attach | name: receipt.pdf | mime: application/pdf | sha256: <hash>
x-agent: loop | over: invoices
x-trust: revision | version: 1.1 | by: Ahmed
x-layout: divider | style: dashed
x-exp: assert | expr: total > 0
```

Some extension blocks (notably `x-trust:` history entries) are machine-managed — don't edit them by hand. Bare legacy forms may still parse for compatibility, but the namespaced form is canonical.

## Custom keywords & recommended conventions

Beyond the 41 canonical keywords and the `x-` extensions, **any word you write before a `:` is a valid keyword** — it parses as a typed, queryable `custom` block, so domain vocabulary never makes a document non-conformant (`risk:`, `clause:`, `مصروف:`). Because the set is open, teams interoperate best when they converge on the *same* word for the same concept.

The **[Recommended Keywords appendix](https://github.com/intenttext/IntentText/blob/main/RECOMMENDED-KEYWORDS.md)** is a curated, **non-binding** best-practice list of the words real documents use most (`clause:`, `obligation:`, `sla:`, `risk:`, `milestone:`, …) — convention to reduce synonym drift across a folder of documents, never a schema. Ignoring it never makes a document non-conformant.
