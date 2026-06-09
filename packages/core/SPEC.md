# IntentText Specification (v4.1)

The canonical, single-source grammar for the `.it` format. Where any README, doc
page, or tool disagrees with this file, **this file wins**. The reserved keyword set
is derived from
[`src/language-registry.ts`](src/language-registry.ts) (`LANGUAGE_REGISTRY`) — never
hand-maintained elsewhere; the `keywords:check` and `parity:check` gates enforce that.

---

## 1. Document model

An IntentText document is a sequence of **blocks**. Each block has a `type`,
`content`, optional `properties`, and optional `inline` nodes. Parsing is
line-oriented: in general, one line is one block.

```
parseIntentText(source) -> { version, blocks: IntentBlock[], metadata }
```

## 2. Line grammar

A non-blank, non-indented line is parsed by trying these forms in order; the first
that matches wins:

1. **Code fence** — ` ``` ` opens/closes a verbatim `code` block. Lines inside are
   literal (keywords are not interpreted).
2. **Blank line** — terminates (flushes) the current block.
3. **Continuation** — a line indented by 2+ spaces or a tab appends to the current
   block's content.
4. **Divider / table / list shorthand** — `---` is a `divider`; `|`-delimited rows
   form `table`; `- ` bullets form list items.
5. **Keyword line** — `keyword: content | key: value | key: value`. The keyword
   before the first colon is resolved against the registry (canonical, alias,
   extension, or boundary).
6. **Custom keyword** — a `word: ...` line whose `word` is **not** a reserved
   keyword is preserved verbatim as `type: "custom"` with `keyword` retained.
7. **Implicit text** — any remaining non-empty line becomes a `text` block.

### Properties

After the content, ` | key: value` segments attach as `properties`:

```
task: Ship auth | owner: Ada | priority: high | due: 2026-03-08
```

### Inline marks

Within content: `*bold*`, `_italic_`, `~strike~`, `` `code` ``, `@mention`,
`#tag`, `[label](href)`, dates, and footnote refs parse into `inline` nodes.

## 3. Keyword tiers

The format is **small by default**. A plain document needs only the **core** tier.
Everything else is an opt-in **profile**. Tiering is contract metadata — the parser
recognizes every keyword regardless of tier; profiles signal document intent and
drive tooling/validation. Non-reserved keywords always pass through as `custom`, so
the reserved surface can stay small without losing extensibility.

| Tier | Keywords | Use for |
| --- | --- | --- |
| **core** (13) | `title` `summary` `meta` `section` `sub` `text` `info` `quote` `code` `image` `link` `task` `done` | Everyday documents: notes, READMEs, plans |
| **agent** | `step` `decision` `gate` `trigger` `result` `policy` `audit` `ask` `context` | AI / workflow documents |
| **contract** | `sign` `approve` `freeze` `track` `revision` `amendment` `history` `cite` | Signed, frozen, auditable documents |
| **data** | `columns` `row` `metric` | Structured tabular / metric data |
| **print** | `page` `header` `footer` `watermark` `break` `toc` | Print / PDF layout |

Source of truth: `KEYWORD_TIERS` and `CORE_KEYWORDS` exported from
`@intenttext/core`. Aliases, compat-only keywords, and `x-namespace:` extension
keywords remain recognized but are not part of any tier.

## 4. Trust model (contract profile)

- `sign:` / `approve:` record an actor against the current document hash.
- `freeze:` locks the document; the content hash is recorded.
- `verifyDocument()` recomputes the hash and reports tamper status.
- The `history:` boundary separates the live document from its append-only audit
  log; content above the boundary is what gets hashed.

## 5. Stability guarantees

- **Explicit syntax is stable.** A document that parsed under v3.x parses the same
  under v4.1. Tiering and the v4.1 cleanup added no breaking grammar changes.
- **Unknown keywords never error** — they become `custom` blocks, preserved verbatim.
- **One implementation.** The TypeScript core is canonical (see
  [`ARCHITECTURE.md`](../../ARCHITECTURE.md)). No other language re-implements the
  grammar.

## 6. Indexing & folder query

Documents are made queryable across a folder tree by a per-folder, shallow `.it-index`
cache (the `.it` files remain the source of truth). Recursive search composes per-folder
indexes explicitly; the index is kept fresh by lazy self-healing on query. Full model:
[INDEXING.md](./INDEXING.md).

## 7. Governance

Changing the keyword contract means editing `LANGUAGE_REGISTRY` and nothing else by
hand. The CI gates (`keywords:check`, `parity:check`) fail the build if the
`BlockType` union or the VSCode grammar drift from the registry.
