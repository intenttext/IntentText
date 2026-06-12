# IntentText for Python

[![PyPI](https://img.shields.io/pypi/v/intenttext)](https://pypi.org/project/intenttext/)

> **Experimental.** Not part of the supported IntentText v4 release surface. The
> canonical implementation is the TypeScript `@dotit/core`.

A thin Python client over the canonical IntentText core. It does **not** re-implement
the grammar — parsing is delegated to the core CLI and mapped into Python dataclasses,
so Python results can never drift from the JS parser.

## Install

```bash
pip install intenttext
```

You also need the IntentText core CLI reachable (see *Configuring the core* below).

## Quick start

```python
from intenttext import parse

doc = parse("""
title: Sprint Planning
task: Ship auth | owner: Ada | priority: high
""")

print(doc.metadata.title)            # "Sprint Planning"
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

## What changed in 4.0

The Python package used to ship its own parser, renderer, validator, query engine,
and trust helpers (and a Rust bridge). Those duplicated the grammar and could drift.
They were removed. Python now exposes only `parse` / `parse_safe` over the canonical
core. For rendering, validation, query, and trust, use `@dotit/core` (Node) or
the core CLI directly.
