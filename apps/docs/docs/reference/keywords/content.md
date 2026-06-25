---
sidebar_position: 3
title: Content Keywords
---

# Content Keywords

Seven keywords for the substance of a document — text, callouts, quotations, citations, code, images, and links.

## `text:`

**Category:** Content
**Arabic:** `نص:`

General body text — the default block type.

### Syntax

```
text: content | style-properties
```

### Examples

```intenttext
The project is on track for a June delivery.
text: Total contract value: USD 24,000 | weight: bold
text: Please review by end of week | color: #dc2626 | italic: true
```

### Notes

- Supports all [style properties](../style-properties)
- Supports [inline formatting](../style-properties#inline-formatting): `*bold*`, `_italic_`, `~strike~`, `` ```code``` ``, `^highlight^`, `` `label` ``, `{Label}`
- There is no `note:`/`body:`/`paragraph:` synonym — those parse as your own `custom` blocks. Use `text:` for body prose (or just write bare prose, below)

### Bare prose — `text:` is optional

`text:` is the **default** block, so a line with no keyword at all is read as a text
block. You can write a document as ordinary prose and only reach for keywords when a line
needs a specific meaning:

```intenttext
title: Project Brief

The team shipped the beta on schedule. Adoption is ahead of plan, and
support volume is down 12% quarter over quarter.

task: Draft the Q3 roadmap | owner: Sarah | due: 2026-07-01
```

Both prose lines above parse to `text:` blocks. This keeps the source natural for readers
who don't think in keywords (reviewers, executives, government clerks) while staying fully
structured for code.

A bare line is re-emitted **without** the `text:` prefix — so natural source round-trips
byte-for-byte and a sealed document keeps its hash. A line is treated as prose *unless* it
would otherwise parse as another construct, in which case it stays explicit. A bare line
is **not** used when the content:

- looks like a keyword or custom block — `word:` followed by a space or end of line
- starts a list (`- ` or `1. `), a code fence (` ``` `), a divider (`---`), or a comment (`//`)
- begins with a pipe `|` (a table row or pipe-property line)
- is empty (a blank line is a paragraph break, not an empty paragraph)

To force a literal `text:` block even when bare would do, just write the keyword:
`text: …`.

---

## `info:`

**Category:** Content
**Arabic:** `تنبيه:`

Callout block. Renders with a colored background and visual indicator. Choose the variant with
the `type:` property — there is no separate `warning:`/`danger:`/`tip:`/`success:` keyword.

### Syntax

```
info: content | type: variant
```

### Properties

| Property | Type   | Description                                                         |
| -------- | ------ | ------------------------------------------------------------------- |
| `type`   | string | Callout variant: `info` (default), `warning`, `danger`, `tip`, `success` |

### Examples

```intenttext
info: This document uses the IntentText 1.0 format.
info: This contract expires in 14 days. Renewal required. | type: warning
info: Deleting this record is irreversible. | type: danger
info: Use dotit query to find all deadlines across your folder. | type: tip
info: Migration completed — 12,450 records transferred. | type: success
```

### Callout variants — set with `type:`

Pick the callout variant with the `type:` **property**. There is **no** `warning:`/`danger:`/`tip:`/`success:` keyword — a bare `warning:` line is your own `custom` block, not a callout.

| `type:`   | Variant   | Visual style       |
| --------- | --------- | ------------------ |
| (default) | `info`    | Blue / neutral     |
| `warning` | warning   | Amber / yellow     |
| `danger`  | danger    | Red                |
| `tip`     | tip       | Green / blue       |
| `success` | success   | Green              |

```intenttext
info: This contract expires in 14 days. | type: warning
info: Deleting this record is irreversible. | type: danger
```

The parser produces `{ type: "info", properties: { type: "warning" } }`.

---

## `quote:`

**Category:** Content
**Arabic:** `اقتباس:`

Block quotation with optional attribution.

### Syntax

```
quote: content | by: source
```

### Properties

| Property | Type   | Description      |
| -------- | ------ | ---------------- |
| `by`     | string | Attribution text |

### Examples

```intenttext
quote: The best way to predict the future is to invent it. | by: Alan Kay
quote: All documents should be machine-readable from birth. | by: IntentText Manifesto
```

---

## `cite:` (recommended custom keyword)

**Category:** Content (recommended convention)

`cite:` is a **recommended custom keyword** (see [RECOMMENDED-KEYWORDS.md](https://github.com/intenttext/IntentText/blob/main/RECOMMENDED-KEYWORDS.md)), **not** a reserved/canonical keyword — it was demoted from the canonical set in core 3.0.0. It parses as a typed `custom` block (`type: "custom"`, `keyword: "cite"`), renders as a `[cite]` labeled block, and stays queryable by `keyword=cite`.

Bibliographic citation with author, date, and URL.

### Syntax

```
cite: title | author: name | date: year | url: link
```

### Properties

| Property | Type   | Description              |
| -------- | ------ | ------------------------ |
| `author` | string | Author name(s)           |
| `date`   | string | Publication date or year |
| `url`    | string | Link to the source       |

### Examples

```intenttext
cite: The Pragmatic Programmer | author: Hunt, Thomas | date: 2019
cite: Structured Documents in Enterprise | author: Chen, Wei | date: 2025 | url: https://arxiv.org/example
```

---

## `code:`

**Category:** Content
**Arabic:** `شيفرة:`

Code block with optional language for syntax highlighting.

### Syntax

**Single-line code** — wrap the value in triple backticks:

````
code: ```content``` | lang: language
````

**Multi-line code** — open with triple backticks, close on a separate line:

````
code: ```
line 1
line 2
``` | lang: language
````

### Properties

| Property | Type   | Description                           |
| -------- | ------ | ------------------------------------- |
| `lang`   | string | Programming language for highlighting |

### Examples

````intenttext
code: ```const doc = parseIntentText(source);``` | lang: typescript
code: ```
SELECT *
FROM users
WHERE active = true
``` | lang: sql
````

### Inline code

To include code inline within any text block, use triple backticks:

````intenttext
Call the ```render()``` function to generate output.
Set ```NODE_ENV=production``` before deploying.
````

### Notes

- Properties (`| lang: js`, etc.) go after the closing ` ``` `, like any other pipe property
- Plain `code: content` (without backtick wrapper) still works for simple one-liners

---

## `image:`

**Category:** Content
**Arabic:** `صورة:`

Inline image. No caption, no number — flows with surrounding text.

### Syntax

```
image: alt text | src: url | caption: text
```

### Properties

| Property  | Type   | Required | Description       |
| --------- | ------ | -------- | ----------------- |
| `src`     | string | yes      | Image URL or path |
| `caption` | string | no       | Caption rendered below the image |

### Examples

```intenttext
image: Company logo | src: ./images/logo.png | caption: Our logo
image: Architecture diagram | src: ./diagrams/arch.png
```

### Notes

- For numbered, captioned figures use `x-writer: figure` instead
- `image:` is inline; `x-writer: figure` is a formal numbered element

---

## `link:`

**Category:** Content
**Arabic:** `رابط:`

Hyperlink to an external resource.

### Syntax

```
link: display text | to: target | title: tooltip
```

### Properties

| Property | Type   | Required | Description                                       |
| -------- | ------ | -------- | ------------------------------------------------- |
| `to`     | string | yes      | Link target (falls back to the content if absent) |
| `title`  | string | no       | Tooltip text                                      |

### Examples

```intenttext
link: IntentText docs | to: https://dotit.uts.qa
link: View the full contract | to: ./contracts/acme-2026.it | title: Acme Services Contract
```

---

## Extension keywords

Editorial and document cross-reference blocks are available as extension keywords.

### `x-writer:` — Editorial / Publishing

| Extension              | Purpose                                     |
| ---------------------- | ------------------------------------------- |
| `x-writer: byline`     | Author name and publication date            |
| `x-writer: figure`     | Numbered, captioned figure                  |
| `x-writer: caption`    | Figure or table caption                     |
| `x-writer: footnote`   | Numbered footnote with inline reference     |
| `x-writer: epigraph`   | Introductory quotation                      |
| `x-writer: dedication` | Document dedication                         |

### `x-doc:` — Document Cross-References

| Extension           | Purpose                                     |
| ------------------- | ------------------------------------------- |
| `x-doc: def`        | Term definition / glossary entry            |
| `x-doc: contact`    | Person or organization contact information  |
| `x-doc: deadline`   | Date-bound milestone                        |
| `x-doc: ref`        | Cross-document reference with relationship  |
| `x-doc: signline`   | Signature line for print documents          |

See the extensions overview in [Keywords →](./index.md#extension-keywords) for full syntax.
