---
sidebar_position: 3
title: Themes
---

# Themes

IntentText themes control the visual appearance of rendered documents — colors, fonts, spacing, and component styling.

## The 8 built-in themes

### Corporate

Blue accents, Inter font, professional appearance. Best for business documents, reports, and proposals.

| Property      | Value      |
| ------------- | ---------- |
| Primary color | `#2563eb`  |
| Background    | `#ffffff`  |
| Font          | Inter      |
| Heading       | Inter Bold |

### Minimal

Clean, maximum whitespace, simple typography. Best for documents where content should be the only focus.

| Property      | Value          |
| ------------- | -------------- |
| Primary color | `#333333`      |
| Background    | `#ffffff`      |
| Font          | System default |

### Warm

Warm colors, Georgia serif, friendly tone. Best for HR documents, newsletters, and communications.

| Property      | Value        |
| ------------- | ------------ |
| Primary color | `#d97706`    |
| Background    | `#fffbeb`    |
| Font          | Georgia      |
| Heading       | Georgia Bold |

### Technical

Monospace accents, compact layout, data-dense presentation. Best for specs, runbooks, and architecture docs.

| Property      | Value          |
| ------------- | -------------- |
| Primary color | `#10b981`      |
| Background    | `#ffffff`      |
| Font          | Inter          |
| Code font     | JetBrains Mono |

### Print

Maximum readability on paper. Optimized for physical printing with appropriate margins and font sizes.

| Property      | Value           |
| ------------- | --------------- |
| Primary color | `#000000`       |
| Background    | `#ffffff`       |
| Font          | Times New Roman |

### Legal

Formal, serif font, minimal color. Convention over personality. Best for contracts, agreements, and compliance docs.

| Property      | Value        |
| ------------- | ------------ |
| Primary color | `#1e293b`    |
| Background    | `#ffffff`    |
| Font          | Georgia      |
| Heading       | Georgia Bold |

### Editorial

Magazine-style, large headings, prominent pull quotes. Best for newsletters, articles, and publications.

| Property      | Value      |
| ------------- | ---------- |
| Primary color | `#7c3aed`  |
| Background    | `#ffffff`  |
| Font          | Georgia    |
| Heading       | Inter Bold |

### Dark

Dark background, light text, screen-optimized. Not ideal for printing.

| Property      | Value     |
| ------------- | --------- |
| Primary color | `#60a5fa` |
| Background    | `#1e1e1e` |
| Text          | `#e5e5e5` |
| Font          | Inter     |

## Applying a theme

### In the CLI

```bash
# HTML rendering
dotit document.it --html --theme corporate

# Print rendering
dotit document.it --print --theme legal

# PDF export
dotit document.it --pdf --theme editorial
```

### In the document

```intenttext
meta: | type: document | theme: corporate
```

### In the editor

The web editor (and the embeddable `@dotit/editor` component) has a theme picker dropdown — select a theme and it's applied in real time.

## Theme resolution order

When rendering, the theme is resolved in this order:

1. **CLI flag / render option** — `--theme corporate` (highest priority)
2. **Document metadata** — `meta: | theme: corporate`
3. **Built-in fallback** — `corporate` (used when none is given or the name is unknown)

The 8 built-in themes are available everywhere with no download step.

## Theme object format

A theme is a plain object with `colors`, `fonts`, and `spacing` groups (plus optional
`description`, `author`, `blocks`, and `print`). Register one at runtime with
[`registerBuiltinTheme`](./core-api#registerbuiltinthemetheme) so it resolves by name:

```typescript
import { registerBuiltinTheme } from "@dotit/core";

registerBuiltinTheme({
  name: "my-brand",
  version: "1.0",
  description: "Custom brand theme",
  colors: {
    text: "#1e293b",
    heading: "#0f172a",
    muted: "#64748b",
    accent: "#e11d48",
    border: "#e2e8f0",
    background: "#ffffff",
    "code-bg": "#f5f5f5",
  },
  fonts: {
    body: "Helvetica, Arial, sans-serif",
    heading: "Helvetica Bold, Arial Bold, sans-serif",
    mono: "Menlo, Monaco, monospace",
    size: "11pt",
    leading: "1.6",
  },
  spacing: {
    "page-margin": "1in",
    "section-gap": "2rem",
    "block-gap": "0.75rem",
    indent: "0",
  },
});
```

See the full [`IntentTheme` interface](./core-api#intenttheme) in the Core API.

## Managing themes

```bash
# List the built-in themes
dotit theme list

# Show a theme's fonts, colors, and metadata
dotit theme info corporate
```

`theme list` and `theme info` are the only `dotit theme` subcommands. Custom themes
are registered programmatically via `registerBuiltinTheme` (above) or passed inline
as a theme object to `renderHTML` / `renderPrint`.

:::note Planned
A Hub-backed theme gallery with `dotit theme install` / `publish` is **planned** —
today themes are the 8 built-ins plus any you register in code.
:::
