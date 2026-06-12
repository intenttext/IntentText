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

Keywords and property keys are **Unicode words** (`\p{L}` letters, then letters/
digits/`-`/`_`) — Arabic, Chinese, or any-script domain keywords parse as typed
`custom` blocks exactly like ASCII ones (`مصروف: كراسي | فئة: أثاث` is a queryable
`custom` block with keyword `مصروف`). The 38 canonical keywords themselves remain
English; localized *aliases* may be added through the registry's alias mechanism.

**Dates are ISO 8601.** Date-bearing properties (`date`, `due`, `at`, `expires`,
`issued`) canonically hold `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm[:ss]Z` — locale forms
like `09/03/2026` are ambiguous and break date-range queries; the semantic validator
flags them (`DATE_NOT_ISO`, warning). Template placeholders are exempt.

### Properties

After the content, ` | key: value` segments attach as `properties`:

```
task: Ship auth | owner: Ada | priority: high | due: 2026-03-08
```

### Inline marks

Within content: `*bold*`, `_italic_`, `~strike~`, `` `code` ``, `@mention`,
`#tag`, `[label](href)`, dates, and footnote refs parse into `inline` nodes.

An **inline styled span** `[text]{ key: value; key: value }` styles part of a line with
the same keys as block-level style props (see [style-properties](../../apps/docs/docs/reference/style-properties.md)),
but **`;`-separated** — `|` is reserved for the line-level property delimiter and cannot
appear inside a line. Spans parse into a `styled` inline node and render to `<span
style="…">` via the same property→CSS mapping as block props, so partial styling is
reproduced identically by any renderer. It is distinct from `[label](url)` (link) and
`[[note]]` (side-note), which are matched first.

### Scoped document styles (v4.3)

`style: <target> | key: value | …` declares house styling for a **block type** once,
document-wide: `style: section | color: #0a7 | weight: 600`. Targets are a fixed set
(`title summary section sub text quote callout info table table-header metric contact
divider`; unknown targets ignored); values are the same constrained style-key vocabulary
(never arbitrary CSS). Rules render as CSS scoped to the target's element classes —
emitted **after** the theme stylesheet (rules override theme; per-line props and inline
spans override rules). `style:` blocks are document-level metadata: invisible in the
rendered body, byte-preserved on round-trip, values sanitized for the stylesheet context.
`collectDocumentStyles()` / `documentStyleCSS()` are the single implementation; the
editor applies the same rules to its canvas via a selector map.

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

### 4.1 Canonicalization — the exact bytes that get hashed

The document hash is **tamper-evidence, not PKI**: anyone with the source and a SHA-256
implementation can reproduce it. The algorithm (`computeDocumentHash` in
[`src/trust.ts`](src/trust.ts)) is deliberately tiny and operates on the **raw source
string**, in this exact order:

1. **Cut at the history boundary.** Scan lines top-to-bottom; the boundary is the first
   line that, *trimmed*, equals `history:` (legacy: a `---` line immediately followed by
   a `// history` line). Keep only the bytes **before** that line. If there is no
   boundary, keep the whole source. The append-only audit log below `history:` is never
   hashed, so adding history entries never changes the document hash.
2. **Drop the seal lines.** From the kept content, remove every line whose **raw,
   un-trimmed** text starts with `sign:`, `freeze:`, or `amendment:`. These carry the
   seal metadata whose own `hash:` field references the body *without* them — so they
   must be excluded to avoid a circular definition. (Prefix match is literal: an indented
   `  sign:` is **not** removed.)
3. **Join and trim.** Re-join the surviving lines with a single `\n` (LF), then apply one
   `String.trim()` to the whole result (strips leading/trailing whitespace, including a
   trailing newline).
4. **Hash.** `"sha256:" + sha256(utf8Bytes(body)).toHex()`.

Determinism notes for re-implementers:

- **Encoding is UTF-8; line ending is LF (`\n`).** A file saved with CRLF hashes
  differently — normalize to LF before hashing.
- The hash covers the **canonical source text**, not the parsed model — property order,
  spacing inside a line, and inline marks are all significant. Round-tripping through
  `documentToSource()` produces canonical text; editing in the visual editor preserves
  trust lines verbatim (see the editor's `itTrust` node) so a save does not perturb the
  hash.
- `approve:` lines are **not** stripped — an approval is part of the body it approves and
  is included in the hash.

`sealDocument()` computes the hash, then inserts (just above the `history:` boundary, or
at end of file) a `sign:` line — `sign: <signer> | role: <role> | at: <ISO8601> | hash:
<hash>` — followed by `freeze: | at: <ISO8601> | hash: <hash> | status: locked`.
`verifyDocument()` recomputes the hash and compares it to the `freeze` block's `hash:`
(`intact`), and reports, per signer, whether their recorded hash matches the frozen hash
(`valid`) and/or the current hash (`signedCurrentVersion`).

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
