---
sidebar_position: 11
title: Style Properties
---

# Style Properties

Style properties control the visual appearance of blocks when rendered to HTML or print. They are pipe properties that the renderer maps directly to CSS.

## The style properties

| Property     | CSS Mapping                      | Example Values                   | Notes                                       |
| ------------ | -------------------------------- | -------------------------------- | ------------------------------------------- |
| `color:`     | `color`                          | `red`, `#ff0000`, `rgb(255,0,0)` | Any CSS color value                         |
| `size:`      | `font-size`                      | `0.85em`, `18px`, `12pt`         | Any CSS size unit                           |
| `family:`    | `font-family`                    | `Georgia`, `Inter`               | Font name                                   |
| `weight:`    | `font-weight`                    | `bold`, `600`, `normal`          | CSS font-weight values                      |
| `align:`     | `text-align`                     | `center`, `right`, `justify`     | Also adds class `.intent-align-center` etc. |
| `bg:`        | `background-color`               | `yellow`, `#fffde7`              | Any CSS color value                         |
| `indent:`    | `padding-left`                   | `2em`, `20px`                    | Any CSS length                              |
| `opacity:`   | `opacity`                        | `0.5`, `0.6`                     | 0–1 range                                   |
| `italic:`    | `font-style: italic`             | `true`                           | Boolean — only `"true"` applies             |
| `border:`    | `border: 1px solid currentColor` | `true`                           | Boolean — only `"true"` applies             |
| `underline:` | `text-decoration: underline`     | `true`                           | Boolean — combines with `strike:`           |
| `strike:`    | `text-decoration: line-through`  | `true`                           | Boolean — combines with `underline:`        |
| `valign:`    | `vertical-align`                 | `sub`, `super`                   | Subscript / superscript positioning         |

## Usage examples

```intenttext
text: This is important | color: red | weight: bold
text: Subtle aside | color: #666 | size: 0.85em | italic: true
quote: Key insight | bg: #fffde7 | border: true | indent: 2em
warning: Deadline tomorrow | color: #d32f2f | bg: #ffebee | weight: bold
text: Fine print | size: 0.75em | opacity: 0.7 | align: center
```

## Styling part of a line — inline styled spans

Block-level props above style the **whole** block. To style **part** of a line — one
word red, a phrase bold-and-larger, the rest normal — use an inline **styled span**:

```
[text]{ key: value; key: value }
```

The braces carry the **same style keys** as block props, but separated by **`;`** (the
`|` is reserved for the line-level property delimiter). Spans combine freely and sit
alongside the semantic marks (`*bold*`, `_italic_`, `~strike~`, `` `code` ``):

```intenttext
text: Payment is [overdue]{ color: #c00; weight: bold } — please act _now_.
metric: Total Due | value: [17,325 QAR]{ size: 1.2em; weight: bold }
text: A [combined]{ color: blue; weight: bold; italic: true; underline: true } word.
```

Spans render to `<span style="…">` using the exact same mapping as block props, so a
template styled this way prints **identically** through the editor, the CLI, and the
core renderer (`renderHTML` / `renderPrint`). Use marks for plain emphasis and spans for
color/size/font or combined styling; keep the systematic look (fonts, heading style) in
the **theme** rather than repeating spans everywhere.

## House styling for the whole document — `style:` blocks

To style **every** block of a type — all section headers teal, all totals dark — don't
repeat props on each line. Declare a scoped **`style:` rule** once:

```intenttext
style: section | color: #0a7 | weight: 600
style: title | family: Georgia | size: 26pt
style: metric | color: #333

title: Branded Invoice
section: Items
```

- The **target** is a block type: `title`, `summary`, `section`, `sub`, `text`, `quote`,
  `callout`/`info`, `table`, `table-header`, `metric`, `contact`, `divider`. Unknown
  targets are ignored.
- The **values** are the same constrained style keys as everywhere else (the table
  above) — not arbitrary CSS, so content stays clean and queryable.
- Rules apply **after the theme**, so house styling wins; per-line props and inline
  spans still override a rule (most-specific wins).
- In the **editor**, each rule shows as a 🎨 chip at the top of the document and is
  applied **live** to the canvas — what you see while editing is what `renderPrint`
  produces (the same `documentStyleCSS()` engine drives both).
- `style:` lines never render as body content, and rule values are sanitized (a value
  can't escape the stylesheet).

This is the three-layer model: **theme** (document class) → **`style:` rules** (this
document's house style) → **per-line props / inline spans** (exceptions).

## How style properties work

1. The parser stores all pipe properties as key-value pairs
2. The renderer checks each property against the known style names
3. Known style properties are mapped to inline CSS styles
4. `align:` additionally adds a CSS class (e.g., `.intent-align-center`)
5. Unknown style values are silently ignored — the document remains valid

```html
<!-- note: Important | color: red | weight: bold -->
<div class="intent-block intent-note" style="color: red; font-weight: bold;">
  <p>Important</p>
</div>
```

## Boolean properties

`italic:` and `border:` are boolean. Only the value `"true"` activates them — any other value (or omitting the property) means no effect.

```intenttext
text: Emphasized | italic: true
text: Boxed content | border: true
text: Both | italic: true | border: true
```

## Combining style and functional properties

Style properties coexist with functional properties on any block:

```intenttext
quote: The future belongs to those who believe | by: Eleanor Roosevelt | color: #1a237e | bg: #e8eaf6 | italic: true
metric: Revenue | value: 1200000 | target: 1000000 | unit: USD | color: green | weight: bold | size: 1.4em
contact: Sarah Chen | role: CEO | email: sarah@acme.co | color: #2563eb
```

---

## Inline formatting

IntentText supports inline formatting within any content string. These follow WhatsApp-style conventions and are processed within a single line only.

| Syntax           | Result            | Description                     |
| ---------------- | ----------------- | ------------------------------- |
| `*text*`         | **text**          | Bold                            |
| `_text_`         | _text_            | Italic                          |
| `~text~`         | ~~text~~          | Strikethrough                   |
| ` ```text``` `   | `text`            | Inline code (triple backtick)   |
| `` `text` ``     | Label             | Label / badge (single backtick) |
| `{text}`         | Label             | Label / badge (curly braces)    |
| `^text^`         | <mark>text</mark> | Highlight                       |
| `==text==`       | Quoted emphasis   | Inline quote                    |
| `[text](url)`    | Hyperlink         | Hyperlink                       |
| `[[text]]`       | Side-note         | Inline note / comment           |
| `[[label\|url]]` | Link              | Inline link shorthand           |
| `@person`        | @person           | Mention                         |
| `#topic`         | #topic            | Tag                             |
| `@today`         | Current date      | Date — resolves to ISO string   |
| `@tomorrow`      | Tomorrow's date   | Date — resolves to ISO string   |
| `@YYYY-MM-DD`    | Explicit date     | Date literal                    |
| `[^N]`           | Superscript N     | Footnote reference              |

### Rules

- Inline formatting is processed within a **single line only** — no multi-line spans
- **Non-nesting** — overlapping marks are treated as plain text
- Unmatched delimiters are treated as literal characters
- Inline parsing happens _after_ pipe splitting
- Maximum inline content length: 100K characters

### Examples

````intenttext
text: The deadline is *tomorrow* at _5pm_. Contact @sarah for details.
text: Use the ```render()``` function to generate output. See #api-reference.
text: Revenue is ^up 12%^ this quarter — exceeding our ~original~ revised target.
text: Read the [full report](https://example.com/report) for details.
````
