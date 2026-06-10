---
sidebar_position: 8
title: Python SDK
---

# Python SDK

> **Experimental.** Not part of the supported v4 release surface. The canonical
> implementation is the TypeScript `@intenttext/core`.

A thin Python client over the canonical IntentText core. It does **not** re-implement
the grammar — parsing is delegated to the core CLI and mapped into Python dataclasses,
so Python results can never drift from the JS parser. For rendering, querying, merging,
and trust operations, use `@intenttext/core` (Node) or the core CLI directly.

## Installation

```bash
pip install intenttext
```

Requires Python 3.10+ and the IntentText core CLI reachable (see below).

## Quick start

```python
from intenttext import parse

doc = parse("""
title: Quarterly Report
task: Ship auth | owner: Ada | priority: high
""")

print(doc.metadata.title)            # "Quarterly Report"
for block in doc.blocks:
    print(block.type, block.content, block.properties)
```

`parse_safe(source)` returns a `ParseResult` wrapping the same document.

## Configuring the core

The client locates the core CLI in this order:

1. `INTENTTEXT_CLI` — path to `cli.js` (or any executable that accepts
   `<file.it>` and prints the document JSON to stdout).
2. `cli.js` discovered by walking up from the package (monorepo checkout).
3. `intenttext` on `PATH` (a globally installed core CLI).

If none is found, `parse()` raises `IntentTextCoreNotFound`.

```bash
export INTENTTEXT_CLI=/path/to/intenttext/cli.js
```

## Exports

| Symbol | Purpose |
| --- | --- |
| `parse(source)` | Parse `.it` source → `IntentDocument` |
| `parse_safe(source)` | Parse → `ParseResult` (document + warnings/errors) |
| `IntentTextCoreNotFound`, `IntentTextParseError` | Raised on missing core / parse failure |
| `IntentDocument`, `IntentBlock`, `IntentMetadata`, `InlineSegment`, … | Dataclasses for the parsed shape |

## What changed in 4.0

Earlier versions shipped a separate Python parser, renderer, validator, query engine,
and trust helpers. Those duplicated the grammar and could drift, so they were removed.
Python now exposes only `parse` / `parse_safe` over the canonical core. Everything else
lives in `@intenttext/core` / the CLI.

## Source

Repository: [`packages/python`](https://github.com/intenttext/IntentText/tree/main/packages/python)
