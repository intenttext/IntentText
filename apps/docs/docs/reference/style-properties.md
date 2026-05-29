---
sidebar_position: 11
title: Style Properties
---

# Style Properties

Style properties control the visual appearance of blocks when rendered to HTML or print. They are pipe properties that the renderer maps directly to CSS.

## The 10 style properties

| Property   | CSS Mapping                      | Example Values                   | Notes                                       |
| ---------- | -------------------------------- | -------------------------------- | ------------------------------------------- |
| `color:`   | `color`                          | `red`, `#ff0000`, `rgb(255,0,0)` | Any CSS color value                         |
| `size:`    | `font-size`                      | `0.85em`, `18px`, `12pt`         | Any CSS size unit                           |
| `family:`  | `font-family`                    | `Georgia`, `Inter`               | Font name                                   |
| `weight:`  | `font-weight`                    | `bold`, `600`, `normal`          | CSS font-weight values                      |
| `align:`   | `text-align`                     | `center`, `right`, `justify`     | Also adds class `.intent-align-center` etc. |
| `bg:`      | `background-color`               | `yellow`, `#fffde7`              | Any CSS color value                         |
| `indent:`  | `padding-left`                   | `2em`, `20px`                    | Any CSS length                              |
| `opacity:` | `opacity`                        | `0.5`, `0.6`                     | 0–1 range                                   |
| `italic:`  | `font-style: italic`             | `true`                           | Boolean — only `"true"` applies             |
| `border:`  | `border: 1px solid currentColor` | `true`                           | Boolean — only `"true"` applies             |

## Usage examples

```intenttext
text: This is important | color: red | weight: bold
text: Subtle aside | color: #666 | size: 0.85em | italic: true
quote: Key insight | bg: #fffde7 | border: true | indent: 2em
warning: Deadline tomorrow | color: #d32f2f | bg: #ffebee | weight: bold
text: Fine print | size: 0.75em | opacity: 0.7 | align: center
```

## How style properties work

1. The parser stores all pipe properties as key-value pairs
2. The renderer checks each property against the 10 known style names
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
