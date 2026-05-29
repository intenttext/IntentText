---
sidebar_position: 4
title: Web Editor
---

# Web Editor

The IntentText web editor at [iteditor.vercel.app](https://iteditor.vercel.app) is a browser-based authoring tool for `.it` files. No CLI, no terminal, no installation.

## Who it's for

- **HR managers** writing offer letters and policies
- **Legal teams** drafting contracts without technical tooling
- **Journalists** authoring articles with structured formatting
- **Anyone** who wants to work with `.it` files without a terminal

## Features

### Live preview

Write `.it` syntax on the left, see the rendered output on the right. Changes appear in real time.

### Theme picker

A dropdown menu to select from all 8 built-in themes. The preview updates immediately. The selected theme is written to `meta:` automatically:

```intenttext
meta: | type: document | theme: warm
```

### Trust UI

Visual indicators for trust status:

- **Approval stamps** — green badges showing who approved and when
- **Signature badges** — signed blocks show the signer name and role
- **Sealed banner** — frozen documents display a "Document Sealed" banner with the hash
- **Amendment cards** — each amendment is displayed as a card with before/after values

### History panel

For tracked documents (`track: true`), the history panel shows:

- Revision timeline
- Who changed what and when
- Before/after values for each change

### Export

- **HTML** — download the rendered HTML with the selected theme
- **PDF** — export to PDF with full print layout
- **JSON** — download the parsed AST

### Block editor

Point-and-click block addition:

1. Click the **+** button between blocks
2. Select a keyword from the menu
3. Fill in the content and properties
4. The `.it` source is updated automatically

### Syntax highlighting

IntentText keywords and aliases are highlighted by category:

| Category  | Color      |
| --------- | ---------- |
| Trust     | Gold       |
| Agent     | Orange     |
| Content   | Green      |
| Structure | Blue       |
| Data      | Purple     |
| Layout    | Gray       |
| Identity  | Light blue |

## Getting started

1. Go to [iteditor.vercel.app](https://iteditor.vercel.app)
2. Start writing `.it` syntax — or use the block editor
3. Select a theme from the dropdown
4. Export to HTML or PDF when ready

No accounts required for basic editing. Sign in with GitHub to save and share documents.
