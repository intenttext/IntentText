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
intenttext document.it --html --theme corporate

# Print rendering
intenttext document.it --print --theme legal

# PDF export
intenttext document.it --pdf --theme editorial
```

### In the document

```intenttext
meta: | type: document | theme: corporate
```

### In the editor

The web editor and VS Code extension have a theme picker dropdown — select a theme and it's applied in real time.

## Theme resolution order

When rendering, the theme is resolved in this order:

1. **CLI flag** — `--theme corporate` (highest priority)
2. **Document metadata** — `meta: | theme: corporate`
3. **Local theme** — `~/.intenttext/themes/custom.json`
4. **Installed theme** — themes installed from the Hub
5. **Built-in theme** — the 8 themes shipped with IntentText
6. **Hub fetch** — download from the Hub on first use

## Theme JSON format

Create custom themes as JSON files:

```json
{
  "name": "my-brand",
  "version": "1.0.0",
  "description": "Custom brand theme",
  "colors": {
    "primary": "#e11d48",
    "background": "#ffffff",
    "text": "#1e293b",
    "heading": "#0f172a",
    "accent": "#e11d48",
    "muted": "#64748b",
    "border": "#e2e8f0"
  },
  "fonts": {
    "body": "Helvetica, Arial, sans-serif",
    "heading": "Helvetica Bold, Arial Bold, sans-serif",
    "mono": "Menlo, Monaco, monospace"
  },
  "spacing": {
    "sectionGap": "2em",
    "blockGap": "1em",
    "sideMargin": "0"
  }
}
```

## Managing themes

```bash
# List installed themes
intenttext theme list

# Theme details
intenttext theme info corporate

# Install from Hub
intenttext theme install my-brand

# Publish to Hub
intenttext theme publish my-brand.json
```

## Local themes

Save custom theme files to `~/.intenttext/themes/`:

```bash
cp my-brand.json ~/.intenttext/themes/
```

Local themes are available to all projects on the machine.
