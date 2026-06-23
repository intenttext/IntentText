---
sidebar_position: 9
title: Layout Keywords
---

# Layout Keywords

Six keywords for controlling how a document looks when rendered — pagination, headers, footers, watermarks, document-wide style rules, and print page breaks.

## `page:`

**Category:** Layout
**Arabic:** `صفحة:`

Defines the page layout settings for print and PDF output.

### Syntax

```
page: | size: value | orientation: value | margin: value
```

### Properties

| Property      | Type   | Description                                                          |
| ------------- | ------ | ------------------------------------------------------------------- |
| `size`        | string | `A5` `A4` `A3` `A2` `A1` `Letter` `Legal`, or a custom `<w> <h>`     |
| `orientation` | string | `portrait` (default) or `landscape` — landscape swaps width/height  |
| `margin`      | string | CSS margin value — e.g. `20mm`, `1in`, `2cm` (also accepts `margins:`) |

### Examples

```intenttext
page: | size: A4 | orientation: portrait | margin: 20mm
page: | size: A3 | orientation: landscape | margin: 18mm
page: | size: A3 landscape | margin: 18mm
page: | size: 80mm auto | margin: 4mm
```

### Notes

- Browser rendering inherits the system default — `page:` primarily affects PDF export and print
- Only one `page:` block per document is valid
- **True physical size.** The print/PDF `@page { size: … }` emits the real sheet size,
  so A3/A2/A1 reports and wide tables output at full scale. ISO portrait dimensions
  (w×h, mm): A5 148×210, A4 210×297, A3 297×420, A2 420×594, A1 594×841.
- **Orientation** can be a separate property (`orientation: landscape`) or baked into the
  size value as a shorthand (`size: A3 landscape`).
- **Custom size** `<w> <h>` (e.g. `80mm auto`) makes a continuous roll with no
  pagination — useful for thermal receipts. Narrow pages (≤120mm) default to a tight
  4mm margin when none is set.

---

## `header:`

**Category:** Layout
**Arabic:** `ترويسة:`

Defines the running header for multi-page output.

### Syntax

```
header: content | left: text | center: text | right: text | skip-first: true
```

### Properties

| Property     | Type   | Description                                                       |
| ------------ | ------ | ---------------------------------------------------------------- |
| `left`       | string | Text in the top-left zone                                        |
| `center`     | string | Text in the top-center zone                                      |
| `right`      | string | Text in the top-right zone                                       |
| `skip-first` | string | `true` suppresses the header on the first (title) page           |

### Examples

```intenttext
header: Acme Corporation Confidential
header: | left: Acme Corp | right: Confidential
header: | center: Service Agreement v1.0 | skip-first: true
```

### Notes

- Header is hidden in web rendering — visible in print and PDF only (uses CSS `@top-*` margin boxes)
- The content-only form (`header: ACME Corp`) renders in the **center** zone
- `skip-first: true` is standard for formal documents — suppresses the header on the title page
- Content can include the print tokens `{{page}}` and `{{pages}}`

---

## `footer:`

**Category:** Layout
**Arabic:** `تذييل:`

Defines the running footer for multi-page output, including page numbers.

### Syntax

```
footer: content | left: text | center: text | right: text | skip-first: true
```

### Properties

| Property     | Type   | Description                                                       |
| ------------ | ------ | ---------------------------------------------------------------- |
| `left`       | string | Text in the bottom-left zone                                     |
| `center`     | string | Text in the bottom-center zone                                   |
| `right`      | string | Text in the bottom-right zone                                    |
| `skip-first` | string | `true` suppresses the footer on the first (title) page           |

### Examples

```intenttext
footer: Page {{page}} of {{pages}}
footer: | left: Confidential | right: Page {{page}} of {{pages}}
footer: | center: ACME — Confidential | skip-first: true
```

### Template variables

The print tokens `{{page}}` and `{{pages}}` become live page numbers in print and in
the editor (they compile to CSS `counter(page)` / `counter(pages)`). These are the
only substituted tokens — any other text in a header/footer zone renders literally.

| Variable    | Output              |
| ----------- | ------------------- |
| `{{page}}`  | Current page number |
| `{{pages}}` | Total page count    |

### Notes

- Footer is hidden in web rendering — visible in print and PDF only
- The content-only form (`footer: …`) renders in the **center** zone
- `skip-first: true` suppresses the footer on the title/cover page

---

## `watermark:`

**Category:** Layout
**Arabic:** `علامة:`

Watermark printed diagonally across every page.

### Syntax

```
watermark: text | opacity: value | color: value | angle: degrees
```

### Properties

| Property  | Type   | Description                                          |
| --------- | ------ | ---------------------------------------------------- |
| `opacity` | number | 0.0–1.0, default `0.15`                              |
| `color`   | string | CSS color — default `gray`                           |
| `angle`   | number | Rotation in degrees, default `45`                    |

### Examples

```intenttext
watermark: DRAFT
watermark: CONFIDENTIAL | opacity: 0.2 | color: red
watermark: For Review Only | opacity: 0.1 | angle: 30
```

In a template, make the watermark a variable — pass empty data to skip it, or different
values per version:

```intenttext
watermark: {{watermark_text}} | color: {{watermark_color}}
```

### Notes

- Printed diagonally across every page in print/PDF output
- Visible in web rendering as a CSS background layer
- Opacity guide: `0.03–0.05` very subtle, `0.06–0.10` standard, `0.10–0.15` strong, above that it obscures content
- Remove by deleting the `watermark:` block — sealing the document with `freeze:` prevents removal

---

## `break:`

**Category:** Layout
**Arabic:** `فاصل:`

Page break for print output. Invisible in web rendering — renders as `display:none` with `aria-hidden="true"`. In print and PDF, forces a page break at the point where `break:` appears.

### Syntax

```
break:
```

A bare `break:` forces a page break at that point. The block carries no content — it is
invisible in web output and forces a new page in print/PDF.

### Examples

```intenttext
section: Chapter One
text: Introduction material...

break:

section: Chapter Two
text: New chapter starts on a fresh page.
```

### Advanced: scoped break rules

A `break:` block may also carry `before:` and `keep:` properties whose **values name a CSS
class** the renderer emits page-break rules for (`before:` → `page-break-before: always` on
`.it-<value>`; `keep:` → `break-inside: avoid` on `.it-<value>`). These are for advanced
print tuning; most documents only ever need a bare `break:`.

### `break:` vs `x-layout: divider`

|                | `break:`                       | `x-layout: divider`         |
| -------------- | ------------------------------ | ----------------------------|
| **Visible in** | Print/PDF only                 | Both web and print          |
| **Effect**     | Forces page boundary           | Visual horizontal rule      |
| **Print**      | New page                       | `<hr>` on the page          |
| **Web**        | Invisible (`display:none`)     | Rendered thematic break     |

Use `break:` for structural pagination. Use `x-layout: divider` for visible section dividers.

---

## `style:`

**Category:** Layout
**Arabic:** `نمط:`

Scoped document style rule — house styling for a **block type**, declared once,
document-wide. Keeps presentation out of the content body: lines stay clean and
queryable while the document carries its own look (e.g. per-tenant branding in a
stored template).

### Syntax

```
style: target | key: value | key: value
```

### Properties

The **target** (the content before the first `|`) is a block type:
`title`, `summary`, `section`, `sub`, `text`, `quote`, `callout`, `info`, `table`,
`table-header`, `metric`, `contact`, `divider`. Unknown targets are ignored.

The values are the standard [style properties](../style-properties) — `color`, `size`,
`family`, `weight`, `bg`, `align`, `indent`, `opacity`, `italic`, `border`,
`underline`, `strike` — never arbitrary CSS.

### Examples

```intenttext
style: section | color: #0a7 | weight: 600
style: title | family: Georgia | size: 26pt
style: metric | color: #333
```

### Notes

- Rules apply **after the theme** (house style wins); per-line props and inline
  `[text]{…}` spans still override a rule (most-specific wins).
- `style:` lines never render as body content and round-trip byte-exact.
- The web editor shows each rule as a 🎨 chip and applies it **live** to the canvas —
  identical to print output.

---

## Extension keywords

Typography and decorative layout keywords are available in the `x-layout:` and `x-doc:` namespaces. These are rendered by the renderer but do not affect the core document model.

| Extension         | Purpose                                                         |
| ----------------- | --------------------------------------------------------------- |
| `x-layout: font`    | Typography settings — family, size, line-height                 |
| `x-layout: divider` | Visual horizontal rule, shown in both web and print             |
| `x-doc: signline`   | Physical signature line for printed/PDF contracts               |

See the extensions overview in [Keywords →](./index.md#extension-keywords) for full syntax.
