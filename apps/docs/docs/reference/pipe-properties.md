---
sidebar_position: 10
title: Pipe Properties
---

# Pipe Properties

Every IntentText block follows the same grammar:

```
keyword: content | property: value | property: value
```

Properties appear after the pipe separator `|` (space-pipe-space). Any keyword can carry any property — the parser preserves everything without error.

## Syntax rules

1. Split on `|` (space-pipe-space)
2. First segment → `keyword: content`
3. Every subsequent segment → `key: value`
4. Escaped pipe `\|` is treated as a literal character, not a separator
5. Unknown properties are stored, queryable, and carried through merge
6. For `code:`, triple backticks delimit the value — everything between ` ``` ` and ` ``` ` is the content, properties go after the closing backticks

````intenttext
text: Payment due in 30 days | color: red | id: payment-note
quote: The only limit is imagination | by: Anonymous | size: 1.2em
code: ```fetch("/api/data")``` | lang: js
````

## Reserved characters & escaping

` | ` (space-pipe-space) is the **only** reserved delimiter in a line. Two escape sequences exist, and they are all you ever need:

- **Literal pipe** — write `\|` (backslash-pipe). Works in content **and** in property values.
- **Literal backslash** — write `\\` (double backslash).

```intenttext
task: Review the A \| B comparison | owner: Ada
text: Windows path: C:\\Users\\ahmed\\docs
metric: Margin | value: 40\|60 split
```

The parser unescapes `\|` and `\\` anywhere in content and property values, and the serializer **re-escapes them on output** — so escape round-trips are a stable fixpoint. A parsed-and-reserialized document never silently turns a literal pipe back into a property delimiter.

**Colons need no escaping.** Only the first word-plus-colon of a line is interpreted as a keyword — every later colon is plain text:

```intenttext
quote: He said: watch this | by: Ada
text: Schedule — 09:00: standup, 14:30: review
```

The only edge case: starting a line's *prose* with something that looks like a keyword. `total: 50` on its own line would parse as a custom `total` block — if you mean it as text, say so explicitly:

```intenttext
text: total: 50
```

## Standard properties by keyword

Each keyword documents its own properties on its reference page. Here is a cross-reference of common properties and where they appear.

### Identity properties

| Property | Used by                                                                       | Description                             |
| -------- | ----------------------------------------------------------------------------- | --------------------------------------- |
| `by:`    | `quote:`, `approve:`, `sign:`, `audit:`, `revision:`, `amendment:`            | Author or attribution                   |
| `at:`    | `image:`, `audit:`, `approve:`, `sign:`, `freeze:`, `revision:`, `amendment:` | File path, URL, or ISO 8601 timestamp   |
| `id:`    | Any block                                                                     | Explicit block identifier               |
| `ref:`   | `ref:`, `approve:`, `amendment:`                                              | Reference identifier or cross-reference |

### Structural properties

| Property   | Used by                   | Description                   |
| ---------- | ------------------------- | ----------------------------- |
| `section:` | `revision:`, `amendment:` | Section the block relates to  |
| `was:`     | `revision:`, `amendment:` | Previous value                |
| `now:`     | `revision:`, `amendment:` | New value                     |
| `label:`   | `signline:`               | Text below the signature line |
| `width:`   | `signline:`               | Width of the signature line   |

### Data properties

| Property  | Used by             | Description                  |
| --------- | ------------------- | ---------------------------- |
| `format:` | `input:`, `output:` | Data format (json, csv, xml) |
| `schema:` | `input:`            | Expected schema              |
| `type:`   | `meta:`, `ref:`     | Type classification          |
| `unit:`   | `metric:`           | Unit of measurement          |
| `value:`  | `metric:`           | Numeric value                |
| `target:` | `metric:`           | Target value                 |
| `min:`    | `metric:`           | Minimum acceptable value     |
| `max:`    | `metric:`           | Maximum acceptable value     |
| `trend:`  | `metric:`           | `up`, `down`, `flat`         |

### Agent properties

| Property      | Used by                | Description                  |
| ------------- | ---------------------- | ---------------------------- |
| `depends:`    | `step:`                | Step dependency (runs after) |
| `input:`      | `step:`                | Input data reference         |
| `output:`     | `step:`                | Output data reference        |
| `tool:`       | `step:`, `tool:`       | Tool reference               |
| `model:`      | `step:`                | AI model to use              |
| `status:`     | `step:`                | Execution status             |
| `confidence:` | `step:`                | Confidence threshold (0–1)   |
| `approver:`   | `gate:`                | Required approver            |
| `fallback:`   | `gate:`                | Step if approval times out   |
| `if:`         | `decision:`, `policy:` | Condition to evaluate        |
| `then:`       | `decision:`            | Branch if true               |
| `else:`       | `decision:`            | Branch if false              |
| `event:`      | `trigger:`             | Triggering event             |
| `scope:`      | `policy:`, `context:`  | Scope boundary               |
| `always:`     | `policy:`              | Unconditional rule           |
| `never:`      | `policy:`              | Prohibition rule             |
| `action:`     | `policy:`              | Response when policy fires   |
| `requires:`   | `policy:`              | Required block type          |
| `notify:`     | `policy:`              | Alert target                 |
| `timeout:`    | `step:`                | Maximum execution time       |
| `retries:`    | `step:`                | Number of retry attempts     |
| `priority:`   | `step:`                | Execution priority           |
| `phase:`      | `step:`                | Pipeline phase               |

### Trust properties

| Property       | Used by                                      | Description        |
| -------------- | -------------------------------------------- | ------------------ |
| `role:`        | `approve:`, `sign:`, `signline:`, `contact:` | Person's role      |
| `hash:`        | `sign:`, `freeze:`, `amendment:`             | Content hash       |
| `approved-by:` | `amendment:`                                 | Amendment approver |

### Layout properties

| Property       | Used by                                              | Description               |
| -------------- | ---------------------------------------------------- | ------------------------- |
| `size:`        | `page:`, `font:`, `header:`, `footer:`, `watermark:` | Dimensions or font size   |
| `margins:`     | `page:`                                              | Page margins              |
| `orientation:` | `page:`                                              | `portrait` or `landscape` |
| `body:`        | `font:`                                              | Body font family          |
| `heading:`     | `font:`                                              | Heading font family       |
| `mono:`        | `font:`                                              | Monospace font family     |
| `align:`       | `header:`, `footer:`                                 | Text alignment            |
| `color:`       | `watermark:`                                         | Color value               |
| `opacity:`     | `watermark:`                                         | Opacity (0–1)             |
| `angle:`       | `watermark:`                                         | Rotation angle            |
| `end:`         | `title:`, `section:`, `sub:`, `text:`, prose         | Two-sided row — value rendered at the line end |
| `leading:`     | Any text-bearing block                               | Line height (`leading: 1.9`) |
| `space-before:` | Any text-bearing block                              | Space above the block     |
| `space-after:` | Any text-bearing block                               | Space below the block     |

## Two-sided rows — `end:`

`end:` renders a block as a two-sided row: the content sits at the line **start**, the
`end:` value at the line **end** — the invoice/report "label left, value right" pattern:

```intenttext
title: Invoice INV-2026-042 | end: 2026-06-12
text: Customer | end: Acme Corp
section: Payment Terms | end: Net 30
```

It works on `title:`, `section:`, `sub:`, `text:`, and prose blocks. The row is flex
start/end, so RTL documents flip it automatically — no extra markup. The `end:` value is
bidi-isolated (`dir="auto"`), so a date or amount keeps its internal order inside an
Arabic line. `leading:`, `space-before:`, and `space-after:` are spacing props — see
[Style Properties](./style-properties) for the full mapping.

## Direction — RTL and bidi isolation

Direction is automatic and per-value:

- A document with Arabic (or other RTL) content flips to `dir="rtl"` automatically; all
  built-in CSS uses logical properties, so tables, quotes, callouts, and splits mirror
  correctly without configuration.
- **Override explicitly** with `meta: | dir: rtl` (or `dir: ltr`) — the explicit value
  beats auto-detection in either direction. The Arabic alias works too:
  `بيانات: | dir: rtl`.
- **Mixed-language values stay readable.** Table cells, task owner/due dates, metric
  values, deadline dates, contact email/phone, and `end:` values carry `dir="auto"` —
  each value resolves its own direction from its first strong character, so
  `10,200 QAR` and `2026-06-20` keep their internal order inside RTL lines. Never
  manually reorder or pad mixed-language values.

## Open-ended properties

Properties are **fully open-ended**. The parser stores everything — any `key: value` pair is valid:

```intenttext
text: Custom data | department: Engineering | priority: high | reviewed: true
```

Custom properties are preserved in parsed output, appear in queries, and survive merge operations. This makes `.it` files extensible without schema changes.

One convention applies across all properties: the date-bearing keys (`date`, `due`, `at`, `expires`, `issued`) hold **ISO 8601** values (`2026-03-09` or `2026-03-09T14:00:00Z`). Locale formats are ambiguous and break [date-range queries](./query#dates-are-iso-8601) — the validator flags them with a `DATE_NOT_ISO` warning.
