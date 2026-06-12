# IntentText — Architecture

_Last updated: 2026-06-09_

## Single source of truth

**`@dotit/core` (TypeScript) is the one canonical implementation** of the
IntentText language. The grammar, parser, merge, query, render, validation, and
trust/freeze logic live in [`packages/core/src`](packages/core/src) and nowhere
else. No other language or package re-implements the grammar.

Historical note: earlier versions (≤ v3.3) routed parsing through a Rust/WASM core
and a separate Python parser. Both were **removed** — Rust/WASM in v3.4.0, the
Python and Rust duplicates in the v4.1 finalization. Any document, plan, or comment
that describes Rust as "the source of truth" is obsolete; this file is authoritative.

## The keyword contract

The reserved keyword set is defined once in
[`packages/core/src/language-registry.ts`](packages/core/src/language-registry.ts)
(`LANGUAGE_REGISTRY`). Everything else is **derived** from it: the `KEYWORDS` array,
the `BlockType` union, and the alias map in [`types.ts`](packages/core/src/types.ts).

Downstream consumers (README table, VSCode snippets/grammar, docs reference) must not
hand-maintain their own keyword lists. The consistency gate
(`pnpm --filter @dotit/core keywords:check`) enforces that they match the
registry; CI fails on drift.

## Packages — supported (v4.1)

| Package | Role |
| --- | --- |
| `packages/core` | The language: parser, merge, query, render, trust. The only grammar implementation. |
| `packages/mcp` | MCP server exposing `.it` parsing/querying to AI agents. |
| `packages/vscode` | VSCode extension: syntax highlighting, snippets, hover. |
| `apps/editor` | Web editor (the primary human-facing app). Imports `@dotit/core` directly; pure TS, no WASM. |

## Packages — experimental (kept, not part of the supported release)

`apps/hub`, `apps/desktop`, `apps/docs`, `apps/builder`. These build against the same
core but carry no support or stability promise. See each app's README banner.

## Data flow

```
.it text ──▶ parseIntentText() ──▶ IntentDocument (typed blocks)
                                         │
              ┌──────────────────────────┼───────────────────────────┐
              ▼                          ▼                           ▼
        renderHTML()              queryBlocks()              trust: sign/freeze/verify
```

Custom (non-reserved) keywords pass through as `type: "custom"` blocks, preserved
verbatim — so the format is extensible without growing the reserved set.
