---
sidebar_position: 4
title: Web Editor
---

# Web Editor

The IntentText web editor at [editor.uts.qa](https://editor.uts.qa) is a browser-based authoring tool for `.it` files. No CLI, no terminal, no installation.

## Who it's for

- **HR managers** writing offer letters and policies
- **Legal teams** drafting contracts without technical tooling
- **Journalists** authoring articles with structured formatting
- **Anyone** who wants to work with `.it` files without a terminal

## Features

### Word-like WYSIWYG pages

The visual editor shows your document as **real pages** — page size and margins come
from the document's own `page:` block, the header and footer (with live
`{{page}} of {{pages}}` numbers) are visible **on every page** exactly where print puts
them, and page breaks fall where the printed PDF breaks. What you see while editing is
what prints — 100% WYSIWYG, including pages, headers, and footers. Receipt sizes
(`page: | size: 80mm auto`) render as a continuous roll.

### Two modes: Visual and Source

Edit visually (rich text, tables, totals, trust chips) or switch to **Source** for the
raw `.it` text with full syntax highlighting and diagnostics — both stay in sync, and a
visual-editor round-trip never changes your bytes (signed documents stay verifiable).

### Template mode

Author merge templates for your app or team without leaving the editor:

- `{{path.to.value}}` placeholders render as **chips** in text, table cells, and totals.
- The **Template** button (with a live variable-count badge) opens a panel showing every
  detected variable — click to insert at the cursor.
- Enter **sample data** (JSON, persisted per file; a skeleton is auto-built from your
  variables) and produce a **PDF with data** — the exact `parseAndMerge → renderPrint`
  pipeline your production app runs, so what you test is what ships.
- Start from the **Invoice Template** sample (Samples menu).

### Theme picker

Select any of the 8 built-in themes; the view updates immediately. Per-document house
styling goes in [`style:` rules](../reference/style-properties#house-styling-for-the-whole-document--style-blocks),
which apply live on the canvas and identically in print.

### Trust UI

The **Trust** panel drives the full lifecycle — track → approve → sign → seal → verify →
amend — and the document shows styled trust chips (signatures, approvals, frozen banner)
that print exactly as displayed.

### Export

- **PDF** — prints the editor's own pages (true WYSIWYG) via the browser, no PDF library
- **HTML** — self-contained document with the selected theme

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

1. Go to [editor.uts.qa](https://editor.uts.qa)
2. Write in the visual editor (or switch to Source) — or load a sample from **Samples**
3. Select a theme from the dropdown
4. Export to PDF or HTML when ready

No account required — documents live in your files (Open/Save) and autosave locally.
