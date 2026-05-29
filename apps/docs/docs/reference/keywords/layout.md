---
sidebar_position: 9
title: Layout Keywords
---

# Layout Keywords

Five keywords for controlling how a document looks when rendered — pagination, headers, footers, watermarks, and print page breaks.

## `page:`

**Category:** Layout
**Since:** v2.0

Defines the page layout settings for print and PDF output.

### Syntax

```
page: | size: value | orientation: value | margin: value
```

### Properties

| Property      | Type   | Description                                          |
| ------------- | ------ | ---------------------------------------------------- |
| `size`        | string | Paper size — `A4`, `letter`, `legal`, `A3`           |
| `orientation` | string | `portrait` (default) or `landscape`                  |
| `margin`      | string | CSS margin value — `1in`, `2cm`, `normal`, `narrow`  |

### Examples

```intenttext
page: | size: A4 | orientation: portrait | margin: 1in
page: | size: letter | orientation: landscape | margin: 2cm
```

### Notes

- Browser rendering inherits the system default — `page:` primarily affects PDF export and print
- Only one `page:` block per document is valid
- `margin: normal` is equivalent to `1in` top/bottom, `1.25in` left/right (Word defaults)
- `margin: narrow` is equivalent to `0.5in` on all sides

---

## `header:`

**Category:** Layout
**Since:** v2.0
**Aliases:** `running-head:`

Defines the running header for multi-page output.

### Syntax

```
header: content | align: value | show-on: value
```

### Properties

| Property   | Type   | Description                                  |
| ---------- | ------ | -------------------------------------------- |
| `align`    | string | `left` (default), `center`, or `right`       |
| `show-on`  | string | `all` (default), `odd`, `even`, `after-first` |

### Examples

```intenttext
header: Acme Corporation Confidential
header: | align: right | show-on: all
header: Service Agreement v1.0 | align: center | show-on: after-first
```

### Notes

- Header is hidden in web rendering — visible in print and PDF only
- `show-on: after-first` is standard for formal documents — suppresses the header on the title page
- Content can include template variables: `{{title}}`, `{{page}}`, `{{date}}`

---

## `footer:`

**Category:** Layout
**Since:** v2.0

Defines the running footer for multi-page output, including page numbers.

### Syntax

```
footer: content | align: value | show-on: value
```

### Properties

| Property   | Type   | Description                                  |
| ---------- | ------ | -------------------------------------------- |
| `align`    | string | `left`, `center` (default), or `right`       |
| `show-on`  | string | `all` (default), `odd`, `even`, `after-first` |

### Examples

```intenttext
footer: Page {{page}} of {{pages}}
footer: Confidential — Acme Corporation | align: center | show-on: all
footer: {{date}} | align: right | show-on: after-first
```

### Template variables

| Variable     | Output                         |
| ------------ | ------------------------------ |
| `{{page}}`   | Current page number            |
| `{{pages}}`  | Total page count               |
| `{{title}}`  | Document title                 |
| `{{date}}`   | Current date (render time)     |
| `{{author}}` | Author from `meta:` block      |

### Notes

- Footer is hidden in web rendering — visible in print and PDF only
- `show-on: after-first` is standard practice — suppresses footer on the title/cover page

---

## `watermark:`

**Category:** Layout
**Since:** v2.2

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

### Notes

- Printed diagonally across every page in print/PDF output
- Visible in web rendering as a CSS background layer
- Remove by deleting the `watermark:` block — sealing the document with `freeze:` prevents removal

---

## `break:`

**Category:** Layout
**Since:** v1.0

Page break for print output. Invisible in web rendering — renders as `display:none` with `aria-hidden="true"`. In print and PDF, forces a page break at the point where `break:` appears.

### Syntax

```
break:
break: | before: value | keep: value
```

### Properties

| Property | Type    | Description                                                   |
| -------- | ------- | ------------------------------------------------------------- |
| `before` | boolean | Force a page break before the following content               |
| `keep`   | string  | Keep surrounding content together — `together` or `avoid`    |

### Examples

```intenttext
section: Chapter One
text: Introduction material...

break:

section: Chapter Two
text: New chapter starts on a fresh page.
```

```intenttext
break: | before: true | keep: together
```

### `break:` vs `x-layout: divider`

|                | `break:`                       | `x-layout: divider`         |
| -------------- | ------------------------------ | ----------------------------|
| **Visible in** | Print/PDF only                 | Both web and print          |
| **Effect**     | Forces page boundary           | Visual horizontal rule      |
| **Print**      | New page                       | `<hr>` on the page          |
| **Web**        | Invisible (`display:none`)     | Rendered thematic break     |

Use `break:` for structural pagination. Use `x-layout: divider` for visible section dividers.

---

## Extension keywords

Typography and decorative layout keywords are available in the `x-layout:` and `x-doc:` namespaces. These are rendered by the renderer but do not affect the core document model.

| Extension         | Purpose                                                         |
| ----------------- | --------------------------------------------------------------- |
| `x-layout: font`    | Typography settings — family, size, line-height                 |
| `x-layout: divider` | Visual horizontal rule, shown in both web and print             |
| `x-doc: signline`   | Physical signature line for printed/PDF contracts               |

See [Extension Keywords →](./extensions) for full syntax documentation.
