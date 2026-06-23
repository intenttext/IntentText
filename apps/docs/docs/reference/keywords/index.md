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

## Canonical keyword categories

| Category          | Count | Purpose                                                                  |
| ----------------- | ----- | ------------------------------------------------------------------------ |
| Document Identity | 4     | What the document is — title, metadata, context, tracking                |
| Structure         | 3     | How the document is organized — sections, subsections, table of contents |
| Content           | 7     | What the document says — text, quotes, callouts, code, images, links     |
| Tasks             | 3     | Actionable items — tasks, completions, open questions                    |
| Data              | 3     | Typed data — tables, rows, metrics                                       |
| Agentic Workflow  | 9     | Executable workflows — steps, decisions, gates, approval routing, policy |
| Trust             | 6     | Document integrity — approval, signing, sealing, certification, amendments |
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

Beyond the 41 canonical keywords, IntentText supports **extension blocks** via a namespaced `x-ns:` prefix. Extensions cover domain-specific and advanced use cases without polluting the core keyword set.

| Namespace   | Domain                       | Examples                                                                                                                                                              |
| ----------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `x-writer:` | Editorial / publishing       | `byline`, `figure`, `caption`, `footnote`, `epigraph`, `dedication`                                                                                                   |
| `x-doc:`    | Document cross-references    | `def`, `contact`, `deadline`, `ref`, `signline`                                                                                                                       |
| `x-agent:`  | Advanced agent orchestration | `loop`, `parallel`, `retry`, `wait`, `handoff`, `call`, `checkpoint`, `signal`, `import`, `export`, `progress`, `tool`, `prompt`, `memory`, `error`, `agent`, `model` |
| `x-trust:`  | Trust history                | `history`, `revision`                                                                                                                                                 |
| `x-layout:` | Advanced typography          | `font`, `divider`                                                                                                                                                     |
| `x-exp:`    | Experimental                 | `assert`, `secret`                                                                                                                                 |

Extension blocks follow the same pipe-property syntax as canonical blocks — `x-<namespace>: <type> | key: value` — and are parsed, rendered, and queryable through all core APIs:

```intenttext
x-writer: byline | date: 2026-03-09
x-doc: ref | file: ./policy.it | rel: supersedes
x-agent: loop | over: invoices
x-trust: revision | version: 1.1 | by: Ahmed
x-layout: divider | style: dashed
x-exp: assert | expr: total > 0
```

Some extension blocks (notably `x-trust:` history entries) are machine-managed — don't edit them by hand. Bare legacy forms may still parse for compatibility, but the namespaced form is canonical.
