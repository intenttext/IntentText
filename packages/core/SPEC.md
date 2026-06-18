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

### Two-sided rows (`end:`) and paragraph spacing

- **`end:`** on `title:`, `section:`, `sub:`, `text:`, and prose blocks renders a
  two-sided row: the content sits at the line start, the `end:` value at the line
  end (`text: Customer Name | end: 2026-06-12`). Implemented with flex start/end,
  so the sides flip automatically in RTL documents — no extra markup.
- **`leading:`** → `line-height`, **`space-before:`** → space above, and
  **`space-after:`** → space below a block (`text: … | leading: 1.9 |
  space-after: 24px`). All three also work document-wide via `style:` rules
  (`style: text | leading: 1.9`).
- **RTL is native.** Any Arabic content flips the document to `dir="rtl"`
  automatically, and all built-in CSS (including themes and print) uses logical
  properties (`text-align: start`, `border-inline-start`, …) so tables, quotes,
  callouts, and splits mirror correctly without configuration.

**Reserved characters.** ` | ` (space-pipe-space) is the property delimiter; write a
literal pipe as `\|` (and a literal backslash as `\\`) — the parser unescapes them
anywhere in content and property values, and the serializer re-escapes on output, so
round-trips are stable. Colons need **no** escaping inside content or values (`quote:
He said: watch this` is fine) — only the first word+colon of a line is a keyword. To
start a line's text with something that LOOKS like a keyword (e.g. `total: 50` as
prose), write it as explicit text: `text: total: 50`.

Keywords and property keys are **Unicode words** (`\p{L}` letters, then letters/
digits/`-`/`_`) — Arabic, Chinese, or any-script domain keywords parse as typed
`custom` blocks exactly like ASCII ones (`مصروف: كراسي | فئة: أثاث` is a queryable
`custom` block with keyword `مصروف`). The 38 canonical keywords themselves remain
English; **Arabic aliases ship in the registry** (e.g. عنوان→title, مهمة→task,
صف→row, توقيع→sign), so an Arabic document gets full canonical semantics — one
query (`type:task`) matches tasks across languages. Aliases are emitted AS WRITTEN
on serialization (`keywordAlias`), so round-trips are byte-stable and sealed Arabic
documents keep their hash.

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

### Page setup (`page:`)

`page: | size: <size> | orientation: <portrait|landscape> | margin: <css>`

- **size:** `A5` `A4` `A3` `A2` `A1` `Letter` `Legal`, or a custom `<w> <h>`
  (e.g. `80mm auto` for a continuous receipt roll — no pagination).
  ISO portrait dimensions (w×h): A5 148×210, A4 210×297, A3 297×420,
  A2 420×594, A1 594×841 mm.
- **orientation:** `portrait` (default) or `landscape`. Landscape swaps
  width/height. Shorthand `size: A3 landscape` is equivalent to
  `size: A3 | orientation: landscape`.
- The print/PDF `@page { size: … }` emits the **true physical size**
  (e.g. A3 landscape → `420mm 297mm`), so big reports and wide data tables
  output at real size.

Source of truth: `KEYWORD_TIERS` and `CORE_KEYWORDS` exported from
`@dotit/core`. Aliases, compat-only keywords, and `x-namespace:` extension
keywords remain recognized but are not part of any tier.

## 4. Trust model (contract profile)

Trust is **tamper-evidence, not PKI**: anyone with the source and SHA-256 can reproduce a
hash and detect any change. Proving *who* really signed is a layer **above** the hash —
cryptographic signatures (`@dotit/sign`, ed25519), certification (`certify:`), and legal
PAdES (`@dotit/pades`); see the identity ladder in `INTEGRATION.md`.

- `sign:` records an actor's approval against a content hash that **binds their identity**.
- `freeze:` **seals** the document — its hash covers the content *and* the signatures *and*
  the seal's own metadata.
- `approve:` records a workflow approval (part of the hashed body).
- `verifyDocument()` recomputes and reports tamper status + per-signer validity.
- The `history:` boundary separates the live document from its append-only audit log; only
  content **above** the boundary is hashed.

### 4.1 Versioned canonicalization — the exact bytes that get hashed

Every seal/signature stamps a **`spec:` version** recording WHICH byte-rules produced its
hash; verification applies exactly that version **forever**, so a future rule change can
never silently break a historical seal. The current version is **`SEAL_SPEC = 3`**.

Versions (each frozen once shipped — `CANONICALIZERS` in [`src/trust.ts`](src/trust.ts)):

| spec | rules |
| ---- | ----- |
| v0 | raw bytes (pre-NFC) |
| v1 | NFC normalization |
| v2 | NFC; excludes comments; the seal scope covers signatures |
| **v3** (current) | NFC; **also excludes styling**, covers the seal's own metadata, and **binds the signer identity** |

**Two scopes.** A hash covers one of two scopes:

- **content** — each `sign:` line's hash. Co-signers commit to the same content, so adding a
  signature never changes it.
- **seal** — the `freeze:` line's hash. Covers content **+ the signatures + the freeze line's
  own metadata**, so tampering the body, *a signature*, or *the seal metadata* all break it.

**The v3 algorithm** (`computeDocumentHash` / `computeSignatureHash`), on the raw source:

1. **Cut at the history boundary** — keep only bytes before the first trimmed `history:`
   line. The audit log is never hashed.
2. **Drop comments** — any line whose trimmed text starts with `//`.
3. **Drop styling** — whole presentation lines (`page:`, `font:`, `style:`) and presentation
   *properties* on content lines (`color`, `size`, `family`, `align`, `bg`, `indent`,
   `leading`, `space-before/after`, `opacity`, `border`, `valign`, `theme`, `margin(s)`,
   `orientation`, `width`, `height`). **Restyling never breaks a seal** — only real content
   does ("sign content, not presentation").
4. **Apply the scope to trust lines:**
   - _content scope:_ drop `sign:`/`freeze:`/`certify:`/`amendment:`.
   - _seal scope:_ keep `sign:` lines whole; keep the `freeze:` line with its self-referential
     `hash:` value blanked (its `at:`/`status:`/`spec:` stay, so tampering them breaks the
     seal); drop `certify:`/`amendment:`.
5. **NFC-normalize → join with `\n` → `trim()` → SHA-256** ⇒ `"sha256:" + hex`.
6. **Signature identity** (content scope only): a signature hash appends ` sig:<signer>|<role>|<at>`
   to the content body before hashing, so editing the signer's name/role/date breaks *that*
   signature — even before the document is sealed.

Determinism for re-implementers: **UTF-8, LF (`\n`) line endings, NFC.** A serialize
round-trip — `documentToSource(parseIntentText(src))` — preserves the hashed bytes (the
parser captures comments, blank lines, and prose-merge boundaries as trivia, §5.1), so a
sealed document still verifies after parse → serialize. Seal *after* canonicalizing (the
editor and `documentToSource` emit canonical text). `approve:` is **not** stripped — an
approval is part of the body it approves.

**Sealing & verifying.** `signDocument()` inserts `sign: <signer> | role: <role> | at:
<ISO8601> | hash: <contentHash> | spec: 3`. `sealDocument()` adds (optionally) a `sign:`
line then `freeze: | at: <ISO8601> | hash: <sealHash> | spec: 3 | status: locked`.
`verifyDocument()` returns:

- `intact` — the seal-scope hash matches `freeze.hash` (any content / signature / seal-metadata
  change → `false`).
- `signers[].signedCurrentVersion` / `valid` — per signer, whether their signature still
  matches the current content. **Multi-sign aware:** a signer who signed an earlier version
  is reported as such, not as a blanket failure.
- `spec` / `specOutdated` — the recorded ruleset and whether it predates the current one (an
  older, weaker seal — re-seal to upgrade).

The trust band (`renderTrustBand`) **verifies before it draws**: a tampered document renders
a red **"SEAL BROKEN"** stamp on every surface (screen, print, PDF) — never a clean seal.

## 5. Stability guarantees

- **Explicit syntax is stable.** A document that parsed under v3.x parses the same
  under v4.1. Tiering and the v4.1 cleanup added no breaking grammar changes.
- **Unknown keywords never error** — they become `custom` blocks, preserved verbatim.
- **One implementation.** The TypeScript core is canonical (see
  [`ARCHITECTURE.md`](../../ARCHITECTURE.md)). No other language re-implements the
  grammar.

### 5.1 Lossless text ↔ JSON interchange

`.it` **text** and its parsed **JSON model** (`IntentDocument`) are **losslessly
interchangeable**: `parseIntentText` (text → JSON) and `documentToSource` (JSON → text)
are inverses at the information level. Concretely:

- **`documentToSource` is idempotent.** For any valid `.it` text `t`, one serialize pass
  canonicalizes and every further pass is a no-op:
  `documentToSource(parseIntentText(documentToSource(parseIntentText(t))))` equals
  `documentToSource(parseIntentText(t))`.
- **Canonical text round-trips exactly.** For a canonical document `doc`,
  `parseIntentText(documentToSource(doc))` deep-equals `doc`. The only field excluded
  from this equality is the **`id`** — block ids are sequential (`b-1`, `b-2`, …) and
  regenerated on every parse, so they are volatile by design.
- **No information loss.** Every block, every pipe property and value, every block-level
  `dir`/`align`/style, tables, lists, trust lines (`approve:`/`sign:`/`freeze:`/
  `certify:`/`amendment:`), and `meta:`/`track:` lines survive a round-trip — nothing is
  dropped or merged away. Comment lines and blank-line layout are preserved verbatim
  (the parser captures them as trivia: `_lead` on blocks, `_liftedLines`/`_trailing` on
  the document; two consecutive prose lines that merge into one paragraph block keep
  their original per-line form in `_merged` so they re-emit unchanged).

**What is *not* guaranteed:** byte-preservation of *arbitrary* author formatting. The
**first** serialize pass may normalize representation — a markdown `| a | b |` table
becomes the canonical `headers:`/`row:` form, and bare prose gains its implicit `text:`
prefix. After that single canonicalizing pass, text ↔ JSON round-trip exactly (byte-for-
byte for text, deep-equal for JSON). The guarantee is **canonical-form + information
losslessness**, not preservation of every incidental keystroke.

## 6. Indexing & folder query

Documents are made queryable across a folder tree by a per-folder, shallow `.it-index`
cache (the `.it` files remain the source of truth). Recursive search composes per-folder
indexes explicitly; the index is kept fresh by lazy self-healing on query. Full model:
[INDEXING.md](./INDEXING.md).

## 7. Governance

Changing the keyword contract means editing `LANGUAGE_REGISTRY` and nothing else by
hand. The CI gates (`keywords:check`, `parity:check`) fail the build if the
`BlockType` union or the VSCode grammar drift from the registry.
