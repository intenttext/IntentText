---
sidebar_position: 9
title: Extension Keywords
---

# Extension Keywords

IntentText keeps a stable canonical core and supports namespaced extension forms for advanced domains.

## Syntax

Use the namespaced form:

```intenttext
x-<namespace>: <type> | key: value
```

Examples:

```intenttext
x-writer: byline | date: 2026-03-09
x-doc: ref | file: ./policy.it | rel: supersedes
x-agent: loop | over: invoices
x-trust: revision | version: 1.1 | by: Ahmed
x-layout: divider | style: dashed
x-exp: assert | expr: total > 0
```

## Namespaces

- `x-writer` for editorial and publishing blocks.
- `x-doc` for document cross-reference and annotation blocks.
- `x-agent` for advanced orchestration blocks.
- `x-trust` for machine-managed trust history blocks.
- `x-layout` for advanced layout helpers.
- `x-exp` for experimental blocks.

## Notes

- Extension support is parser-level and available to query/render flows.
- Some extension blocks are machine-managed and should not be edited manually.
- Bare legacy forms may still parse for compatibility, but docs use namespaced forms as canonical.
