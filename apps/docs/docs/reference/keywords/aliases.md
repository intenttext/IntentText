---
sidebar_position: 9
title: Aliases
---

# Keyword Aliases

Many IntentText keywords have **aliases** — alternative names that compile to the same canonical form. Use whichever reads best in your document. There is no behavioral difference between a canonical keyword and its alias.

## How aliases work

```intenttext
// These are all identical:
text: Payment is due within 30 days.
note: Payment is due within 30 days.
body: Payment is due within 30 days.
paragraph: Payment is due within 30 days.
```

The parser normalizes every alias to its canonical keyword. Templates, queries, and the API always use canonical names.

---

## Callout aliases

`info:` is the canonical callout block. The four variant forms — `warning:`, `danger:`, `tip:`, and `success:` — are aliases that set the callout's `type` property automatically.

```intenttext
// Canonical form
info: Aliases are supported across all categories. | type: warning

// Equivalent — both produce { type: "info", properties: { type: "warning" } }
warning: Aliases are supported across all categories.
```

| Alias      | Equivalent canonical form    |
| ---------- | ---------------------------- |
| `warning:` | `info: ... \| type: warning` |
| `danger:`  | `info: ... \| type: danger`  |
| `tip:`     | `info: ... \| type: tip`     |
| `success:` | `info: ... \| type: success` |

Secondary callout aliases:

| Alias          | Resolves to              |
| -------------- | ------------------------ |
| `alert:`       | `info: \| type: warning` |
| `caution:`     | `info: \| type: warning` |
| `hint:`        | `info: \| type: tip`     |
| `advice:`      | `info: \| type: tip`     |
| `critical:`    | `info: \| type: danger`  |
| `destructive:` | `info: \| type: danger`  |

---

## Complete alias table

### Document Identity

| Canonical  | Aliases     |
| ---------- | ----------- |
| `title:`   | `h1:`       |
| `summary:` | `abstract:` |
| `meta:`    | —           |
| `context:` | —           |

### Structure

| Canonical  | Aliases                       |
| ---------- | ----------------------------- |
| `section:` | `h2:`, `heading:`, `chapter:` |
| `sub:`     | `h3:`, `subheading:`          |
| `toc:`     | —                             |

### Content

| Canonical | Aliases                                                                             |
| --------- | ----------------------------------------------------------------------------------- |
| `text:`   | `note:`, `body:`, `content:`, `paragraph:`, `p:`                                    |
| `info:`   | `warning:`, `danger:`, `tip:`, `success:` (see [Callout aliases](#callout-aliases)) |
| `quote:`  | `blockquote:`, `excerpt:`, `pullquote:`                                             |
| `cite:`   | `citation:`, `source:`, `reference:`                                                |
| `code:`   | `snippet:`                                                                          |
| `image:`  | `img:`, `photo:`, `picture:`                                                        |
| `link:`   | `url:`, `href:`                                                                     |

### Tasks

| Canonical | Aliases                               |
| --------- | ------------------------------------- |
| `task:`   | `check:`, `todo:`, `action:`, `item:` |
| `done:`   | `completed:`, `finished:`             |
| `ask:`    | `question:`                           |

### Data

| Canonical  | Aliases                          |
| ---------- | -------------------------------- |
| `columns:` | `headers:`                       |
| `row:`     | —                                |
| `metric:`  | `kpi:`, `measure:`, `indicator:` |

### Agentic Workflow

| Canonical   | Aliases                                          |
| ----------- | ------------------------------------------------ |
| `step:`     | `run:`                                           |
| `decision:` | `if:`                                            |
| `gate:`     | —                                                |
| `trigger:`  | `on:`                                            |
| `result:`   | —                                                |
| `policy:`   | `rule:`, `constraint:`, `guard:`, `requirement:` |
| `audit:`    | `log:`                                           |

### Trust

| Canonical    | Aliases             |
| ------------ | ------------------- |
| `track:`     | —                   |
| `approve:`   | —                   |
| `sign:`      | —                   |
| `freeze:`    | `lock:`             |
| `amendment:` | `amend:`, `change:` |

### Layout

| Canonical    | Aliases |
| ------------ | ------- |
| `page:`      | —       |
| `header:`    | —       |
| `footer:`    | —       |
| `watermark:` | —       |
| `break:`     | —       |

---

## Extension keyword aliases

Extension blocks (`x-ns: type`) do not have aliases — the full `x-ns: type` form is always used. See [Extension Keywords →](./extensions).

---

## Using aliases in queries

Queries normalize aliases automatically:

```bash
# These return the same results:
intenttext query . --type text
intenttext query . --type note
intenttext query . --type body
```

## Using aliases in templates

Templates always use canonical names. Even if the source document uses an alias, the parsed output uses the canonical keyword:

```json
{
  "type": "text",
  "content": "Payment is due within 30 days."
}
```
