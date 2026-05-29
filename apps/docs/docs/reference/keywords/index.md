---
sidebar_position: 1
title: Keywords
---

import KeywordTable from '@site/src/components/KeywordTable';

# Keywords

IntentText has **37 canonical keywords** organized into eight categories. Each keyword maps to a typed block with a fixed syntax, a defined set of pipe properties, and predictable rendering behavior.

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
| Layout            | 5     | Print and PDF — page setup, headers, footers, watermarks                 |

Each keyword has a dedicated entry in its category page with full syntax, properties table, examples, and behavioral notes.

## Extension keywords

Beyond the 37 canonical keywords, IntentText supports **extension blocks** via a namespaced `x-ns:` prefix. Extensions cover domain-specific and advanced use cases without polluting the core keyword set.

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
