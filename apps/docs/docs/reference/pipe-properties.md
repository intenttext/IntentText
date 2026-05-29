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

## Standard properties by keyword

Each keyword documents its own properties on its reference page. Here is a cross-reference of common properties and where they appear.

### Identity properties

| Property | Used by                                                                       | Description                             |
| -------- | ----------------------------------------------------------------------------- | --------------------------------------- |
| `by:`    | `quote:`, `approve:`, `sign:`, `audit:`, `revision:`, `amendment:`            | Author or attribution                   |
| `at:`    | `image:`, `audit:`, `approve:`, `sign:`, `freeze:`, `revision:`, `amendment:` | File path, URL, or timestamp            |
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

## Open-ended properties

Properties are **fully open-ended**. The parser stores everything — any `key: value` pair is valid:

```intenttext
text: Custom data | department: Engineering | priority: high | reviewed: true
```

Custom properties are preserved in parsed output, appear in queries, and survive merge operations. This makes `.it` files extensible without schema changes.
