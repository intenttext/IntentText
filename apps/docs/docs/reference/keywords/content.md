---
sidebar_position: 3
title: Content Keywords
---

# Content Keywords

Seven keywords for the substance of a document — text, callouts, quotations, citations, code, images, and links.

## `text:`

**Category:** Content
**Aliases:** `نص:`, `note:`, `body:`, `content:`, `paragraph:`, `p:`

General body text — the default block type.

### Syntax

```
text: content | style-properties
```

### Examples

```intenttext
text: The project is on track for a June delivery.
text: Total contract value: USD 24,000 | weight: bold
text: Please review by end of week | color: #dc2626 | italic: true
```

### Notes

- Supports all [style properties](../style-properties)
- Supports [inline formatting](../style-properties#inline-formatting): `*bold*`, `_italic_`, `~strike~`, `` ```code``` ``, `^highlight^`, `` `label` ``, `{Label}`
- `note:` is the most common alias — both `text:` and `note:` work identically

---

## `info:`

**Category:** Content
**Aliases:** `تنبيه:`, plus the variant forms below

Callout block. Renders with a colored background and visual indicator.

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

### Callout aliases

The variant forms `warning:`, `danger:`, `tip:`, and `success:` are aliases for `info:` with the `type:` property set automatically:

| Alias      | Equivalent                    | Visual style       |
| ---------- | ----------------------------- | ------------------ |
| `warning:` | `info: ... \| type: warning`  | Amber / yellow     |
| `danger:`  | `info: ... \| type: danger`   | Red                |
| `tip:`     | `info: ... \| type: tip`      | Green / blue       |
| `success:` | `info: ... \| type: success`  | Green              |

```intenttext
// These are equivalent:
info: This contract expires in 14 days. | type: warning
warning: This contract expires in 14 days.
```

The parser resolves both forms to `{ type: "info", properties: { type: "warning" } }`. There is no behavioral difference.

---

## `quote:`

**Category:** Content
**Aliases:** `اقتباس:`, `blockquote:`, `excerpt:`, `pullquote:`

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

## `cite:`

**Category:** Content
**Aliases:** `استشهاد:`, `citation:`, `source:`, `reference:`

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
**Aliases:** `شيفرة:`, `snippet:`

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
text: Call the ```render()``` function to generate output.
text: Set ```NODE_ENV=production``` before deploying.
````

### Notes

- Properties (`| lang: js`, etc.) go after the closing ` ``` `, like any other pipe property
- Plain `code: content` (without backtick wrapper) still works for simple one-liners

---

## `image:`

**Category:** Content
**Aliases:** `صورة:`, `img:`, `photo:`, `picture:`

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
**Aliases:** `رابط:`, `url:`, `href:`

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
link: IntentText Hub | to: https://intenttext-hub.vercel.app
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
