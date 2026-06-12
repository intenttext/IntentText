---
sidebar_position: 1
title: Keywords
---

import KeywordTable from '@site/src/components/KeywordTable';

# Keywords

IntentText has **38 canonical keywords** organized into eight categories. Each keyword maps to a typed block with a fixed syntax, a defined set of pipe properties, and predictable rendering behavior.

<KeywordTable />

## How to read this table

- **Keyword** — the canonical name you write in a `.it` file
- **Category** — the functional group
- **Since** — the version when this keyword was introduced
- **Description** — what the block does
- **Properties** — keyword-specific pipe properties (not including [style properties](../style-properties) which are available on all blocks)

## Canonical keyword categories

| Category          | Count | Purpose                                                                  |
| ----------------- | ----- | ------------------------------------------------------------------------ |
| Document Identity | 4     | What the document is — title, metadata, context, tracking                |
| Structure         | 3     | How the document is organized — sections, subsections, table of contents |
| Content           | 7     | What the document says — text, quotes, callouts, code, images, links     |
| Tasks             | 3     | Actionable items — tasks, completions, open questions                    |
| Data              | 3     | Typed data — tables, rows, metrics                                       |
| Agentic Workflow  | 7     | Executable workflows — steps, decisions, gates, policy enforcement       |
| Trust             | 5     | Document integrity — approval, signing, sealing, amendments              |
| Layout            | 6     | Print and PDF — page setup, headers, footers, watermarks, document styles |

Each keyword has a dedicated entry in its category page with full syntax, properties table, examples, and behavioral notes.

## Write keywords in Arabic

The canonical keywords ship with **33 registered Arabic aliases** — `عنوان`→`title`, `قسم`→`section`, `مهمة`→`task`, `صف`→`row`, `توقيع`→`sign`, and more. An Arabic document gets full canonical semantics, and the serializer re-emits keywords **as written**, so Arabic documents stay Arabic through every round-trip (sealed documents keep their hash):

```intenttext
عنوان: عرض سعر — توريد أجهزة الحاسوب
قسم: البنود
أعمدة: الوصف | الكمية | الإجمالي
صف: حاسوب محمول | 10 | 45,000 QAR
مؤشر: الإجمالي المستحق | value: 45,000 QAR
مهمة: مراجعة العرض | owner: سارة | due: 2026-06-25
توقيع: أحمد الراشد | role: المدير التنفيذي | at: 2026-06-12T09:00:00Z
```

The `مهمة:` line is a `task` block (`type=task` queries match it), the table keywords build a real `table`, and `توقيع:` is a tamper-evident `sign:` seal. Keywords and property keys are Unicode words in general, so any-script *custom* keywords (`مصروف: كراسي | فئة: أثاث`) parse as typed, queryable blocks too. Full table: [Aliases →](./aliases#arabic-aliases).

## Extension keywords

Beyond the 38 canonical keywords, IntentText supports **extension blocks** via a namespaced `x-ns:` prefix. Extensions cover domain-specific and advanced use cases without polluting the core keyword set.

| Namespace   | Domain                       | Examples                                                                                                                                                              |
| ----------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `x-writer:` | Editorial / publishing       | `byline`, `figure`, `caption`, `footnote`, `epigraph`, `dedication`                                                                                                   |
| `x-doc:`    | Document cross-references    | `def`, `contact`, `deadline`, `ref`, `signline`                                                                                                                       |
| `x-agent:`  | Advanced agent orchestration | `loop`, `parallel`, `retry`, `wait`, `handoff`, `call`, `checkpoint`, `signal`, `import`, `export`, `progress`, `tool`, `prompt`, `memory`, `error`, `agent`, `model` |
| `x-trust:`  | Trust history                | `history`, `revision`                                                                                                                                                 |
| `x-layout:` | Advanced typography          | `font`, `divider`                                                                                                                                                     |
| `x-exp:`    | Experimental                 | `assert`, `secret`, `input`, `output`                                                                                                                                 |

Extension blocks follow the same pipe-property syntax as canonical blocks. They are parsed, rendered, and queryable through all core APIs.

See [Extension Keywords →](./extensions) for full documentation.
