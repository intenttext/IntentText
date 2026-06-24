---
sidebar_position: 4
title: Editor
---

# Editor

The IntentText editor comes in two forms, same engine:

- **The web editor** at [editor.uts.qa](https://editor.uts.qa) — a browser-based authoring tool for `.it` files. No CLI, no terminal, no installation.
- **[`@dotit/editor`](#embed-it-in-your-app--dotiteditor)** — the same WYSIWYG editor as an embeddable React component for your own app (ERPs, portals, back offices).

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
visual-editor round-trip never changes your bytes (signed documents stay verifiable). Prose
serializes **bare** by default — a plain paragraph emits with no `text:` keyword — so the
source reads like natural writing.

### Change awareness — you always know what you're saving

The editor never silently mutates a file. When (and only when) you've actually changed
something, a subtle **change bar** appears — an ambient dot, a live count ("3 unsaved
changes"), and **Undo / Redo** — and a **Review changes** button opens a real redline of
exactly what changed (the same `compareVersions` diff core uses, rendered with the
`<Redline>` viewer). With nothing changed, the bar is invisible and the canvas stays
pristine. So before you save or seal, you can see precisely what's different from the
version you opened — no surprises, no hidden reformatting.

Under the hood, saves run through core's [`reconcileEdit`](../guide/byte-preservation#editing-without-breaking-the-seal-reconcileedit),
so unchanged blocks keep their **original bytes** and a sealed document keeps its hash.
Sealed documents are read-only by default — a second guard on top of source preservation.

### Documents, forms & templates

**New** offers three document kinds — **Document**, **Form**, and **Template** — each with
its own two-tab workflow:

- **Templates** (`Edit | Preview`): author merge templates without leaving the editor.
  `{{path.to.value}}` placeholders render as **chips** in text, table cells, and totals; the
  **Template** button (with a live variable-count badge) lists every detected variable —
  click to insert at the cursor. Enter **sample data** (JSON, persisted per file; a skeleton
  is auto-built from your variables) and produce a **PDF with data** — the exact
  `parseAndMerge → renderPrint` pipeline your production app runs, so what you test is what
  ships. Start from the **Invoice Template** sample (Samples menu).
- **Forms** (`Design | Fill`): the **Design** panel is a form builder — add, edit, reorder,
  and delete `input:` fields (text, choice, date, number, signature, table, attachment, with
  `required:`, `show-if:`, `compute:`); **Fill** lets a recipient complete it. A complete
  form (all required fields answered) becomes signable.

### Page setup and zoom

A **page-size selector** (A5, A4, A3, A2, A1, Letter, Legal) and an **orientation**
toggle (portrait / landscape) sit in the toolbar — picking one rewrites the document's
own `page:` block, so the change round-trips into the source. **Zoom** has a −/% /+
cluster with **Fit-to-width** and **Fit-to-page** presets plus 50–150% steps; keyboard
shortcuts are `Ctrl`/`Cmd` `+` / `-` to zoom and `Ctrl`/`Cmd` `0` to reset to 100%, and
`Ctrl`/`Cmd` + scroll zooms toward the cursor.

### Theme picker

Select any of the 8 built-in themes; the view updates immediately. Per-document house
styling goes in [`style:` rules](../reference/style-properties#house-styling-for-the-whole-document--style-blocks),
which apply live on the canvas and identically in print.

### Trust UI

The **Trust** panel drives the full lifecycle — track → approve → sign → seal → **certify** →
verify → amend — and the document shows styled trust chips (signatures, approvals, frozen
banner) that print exactly as displayed. A **per-signer trust banner** reports each signer's
status (signed the current version, or an earlier one), and the integrity-gated band stamps a
red **"SEAL BROKEN"** banner on a tampered document rather than a clean seal. Restyling or
reformatting a sealed document never breaks its seal — only content edits do.

An **approval-route panel** reads the document's own `route:`/`require:` policy and shows the
live "who's next / what's pending" state derived from its `approve:` lines (the same
`workflowState` core uses), so a reviewer can approve in order without a separate workflow
system.

### History

**Save version** snapshots the current document, and **History…** lists those versions so
you can review or restore an earlier one.

### Export

- **PDF** — prints the editor's own pages (true WYSIWYG) via the browser, no PDF library
- **HTML** — self-contained document with the selected theme

### Syntax highlighting

IntentText keywords are highlighted by category — the 40 canonical keywords, the Arabic
localized keyword names, and the namespaced extension keywords. Any word you invent that
isn't reserved highlights as your own custom keyword, so a domain block reads distinctly:

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

---

## Embed it in your app — `@dotit/editor`

Everything above ships as an npm package: a **controlled React component over plain `.it` source text**. You pass the source in, you get the edited source back — no editor-specific format ever touches your data, and a document printed through `@dotit/core` always matches what the user saw on screen.

### Install

```bash
npm install @dotit/editor @dotit/core react react-dom
```

Peer dependencies: `react >= 18`, `react-dom >= 18`.

### Quick start

```tsx
import { useState } from "react";
import { IntentTextEditor, exportDocumentPDF } from "@dotit/editor";
import "@dotit/editor/style.css";

export function InvoiceEditor() {
  const [source, setSource] = useState("title: Invoice INV-001\ntext: Hello");
  return (
    <div style={{ height: "100vh" }}>
      <IntentTextEditor value={source} onChange={setSource} theme="corporate" />
      <button onClick={() => exportDocumentPDF(source, "corporate")}>PDF</button>
    </div>
  );
}
```

The editor fills its parent — give the wrapper an explicit height.

### Props

| Prop              | Type                                    | Default       | Description                                                                                                           |
| ----------------- | --------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------- |
| `value`           | `string`                                | — (required)  | Current `.it` source text (controlled).                                                                                |
| `onChange`        | `(source: string) => void`              | — (required)  | Called with the updated `.it` source on every edit.                                                                    |
| `theme`           | `string`                                | `"corporate"` | Document theme id (see `builtinThemes()`). Pair with `onThemeChange`.                                                   |
| `onThemeChange`   | `(theme: string) => void`               | —             | Called when the user picks a theme in the ribbon.                                                                       |
| `readOnly`        | `boolean`                               | `false`       | Force read-only. Sealed documents (`freeze:` block) are read-only automatically.                                        |
| `showRibbon`      | `boolean`                               | `true`        | Show the formatting ribbon.                                                                                             |
| `showTrustBanner` | `boolean`                               | `true`        | Show the trust status banner + document properties strip.                                                               |
| `onTrustAction`   | `(a: "seal"\|"sign"\|"verify") => void` | —             | Handle the ribbon's Trust group — wire it to your own dialogs (e.g. core's `sealDocument`/`signDocument`). Hidden when omitted. (Certification and approval-routing are driven inside the editor's Trust panel, not through this host callback.) |

### Two components: `IntentTextEditor` and `IntentTextWorkbench`

The package exports **both** — pick by how much control you want:

- **`IntentTextEditor`** — the editor surface itself (the Word-like canvas + ribbon). Use it
  when you want a document editor and will manage state/modes yourself. (Also re-exported as
  `TemplateEditor`.)
- **`IntentTextWorkbench`** — a thin wrapper that picks the right experience from a `mode`
  prop: `"edit" | "fill" | "view" | "review" | "auto"`. `"auto"` (`detectMode`) inspects the
  document — a form → fill UI, a sealed doc → read-only viewer, a draft → editor — so one
  embed serves every stage of a document's life. See
  [ERP / App Integration](./erp-integration#embed-the-editor-in-your-app).

```tsx
import { IntentTextWorkbench } from "@dotit/editor";

<IntentTextWorkbench value={src} onChange={setSrc} mode="auto" />;
```

### Other key exports

Besides the two components: `exportDocumentPDF(source, theme)` / `exportDocumentHTML(source, theme)` (WYSIWYG print / print-ready HTML download), `builtinThemes()`, `extractTemplateVariables(source)` / `buildSampleSkeleton(vars)` for `{{variable}}` authoring, `extractTrustState(parsedDoc)` for the trust lifecycle snapshot, and `sourceToDoc` / `docToSource` (the lossless `.it` ↔ editor bridge). Full list in the [package README](https://github.com/intenttext/IntentText/tree/main/packages/editor).

### SSR / Next.js

The editor is **browser-only** (it measures the DOM to paginate). With Next.js or any SSR framework, load it dynamically with SSR disabled:

```tsx
"use client";
import dynamic from "next/dynamic";
import "@dotit/editor/style.css";

const IntentTextEditor = dynamic(
  () => import("@dotit/editor").then((m) => m.IntentTextEditor),
  { ssr: false },
);
```

`exportDocumentPDF` / `exportDocumentHTML` must also only be called in the browser. For server-side PDF bytes use `@dotit/pdf`.

### Notes for ERP embedding

- Store the `.it` source string wherever you store documents — a DB column is fine.
- Styling is scoped and ships in one stylesheet (`@dotit/editor/style.css`); one editor instance per page is the supported setup.
- Insert at caret from your own UI: `window.dispatchEvent(new CustomEvent("it-insert-text", { detail: "{{customer.name}}" }))`.
- For the full template → merge → print pipeline around the editor, see [ERP / App Integration](./erp-integration).
