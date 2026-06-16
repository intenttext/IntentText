# @dotit/editor

Embeddable WYSIWYG visual editor for [IntentText](https://github.com/intenttext/IntentText) (`.it`) documents — Word-like pages, a formatting ribbon, trust banner, and WYSIWYG PDF/HTML export. Built for embedding in React apps: ERPs, portals, back offices.

The editor is a **controlled component over plain `.it` source text**: you pass the source in, you get the edited source back. Everything the user styles maps to core `.it` properties, so a document printed through `@dotit/core` (or this package's export functions) always matches what the user saw on screen.

## Install

```bash
npm install @dotit/editor @dotit/core react react-dom
```

Peer dependencies: `react >= 18`, `react-dom >= 18`.

## Quick start

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

## `<IntentTextEditor />` props

| Prop              | Type                              | Default       | Description |
| ----------------- | --------------------------------- | ------------- | ----------- |
| `value`           | `string`                          | — (required)  | Current `.it` source text (controlled). |
| `onChange`        | `(source: string) => void`        | — (required)  | Called with the updated `.it` source on every edit. |
| `theme`           | `string`                          | `"corporate"` | Document theme id (see `builtinThemes()`). Controlled when provided — pair with `onThemeChange`. |
| `onThemeChange`   | `(theme: string) => void`         | —             | Called when the user picks a theme in the ribbon. |
| `readOnly`        | `boolean`                         | `false`       | Force read-only. Sealed documents (`freeze:` block) are read-only automatically. |
| `showRibbon`      | `boolean`                         | `true`        | Show the formatting ribbon. |
| `showTrustBanner` | `boolean`                         | `true`        | Show the trust status banner + document properties strip. |
| `onTrustAction`   | `(a: "seal"\|"sign"\|"verify") => void` | —       | Handle the ribbon's Trust group. The editor only reports intent — wire it to your own dialogs (e.g. core's `sealDocument` / `verifyDocument`). The group is hidden when omitted. |

## Named exports

| Export | Description |
| ------ | ----------- |
| `IntentTextEditor` | The embeddable editor component. |
| `exportDocumentPDF(source, theme, printMode?)` | Opens the browser print dialog (→ Save as PDF). WYSIWYG when the editor is mounted; falls back to core's `renderPrint`. `printMode`: `"normal" \| "minimal-ink"`. |
| `exportDocumentHTML(source, theme, printMode?)` | Downloads the print-ready HTML document. |
| `builtinThemes()` | Built-in theme ids for a theme picker. |
| `printHtmlViaIframe(html)` | Low-level: print any HTML document via a hidden iframe. |
| `sourceToDoc(source)` / `docToSource(json)` | The lossless `.it` ↔ editor-document bridge (TipTap JSON). |
| `extractTemplateVariables(source)` / `buildSampleSkeleton(vars)` | Template helpers for `{{variable}}` authoring. |
| `extractTrustState(parsedDoc)` | Trust lifecycle snapshot (`TrustState`): tracked / approved / signed / sealed + amendments. |
| `getPageGeometry(source)` / `resolvePageTokens(text, page, pages)` | Page geometry from the document's own `page:`/`header:`/`footer:` blocks. |

Types: `IntentTextEditorProps`, `TrustAction`, `PrintMode`, `TrustState`, `PageGeometry`.

## Embedding in an ERP

- **Controlled `.it` in/out.** Store the source string wherever you store documents (a DB column is fine — it's plain text). Load it into `value`, persist what `onChange` gives you. No editor-specific format ever touches your data.
- **Byte-faithful editing (seals never break).** Edits change only what actually changed — every untouched block keeps its exact original bytes (comments, blank lines, spacing, bare prose). Opening and saving a document with no change is byte-identical, so a **sealed body keeps its content hash through the editor** (and sealed documents are read-only on the body anyway). Powered by `@dotit/core`'s `reconcileEdit`.
- **Templates + merge.** Author templates with `{{variables}}` in the editor (they render as chips); merge real data server-side with `@dotit/core`'s `parseAndMerge` and print with `renderPrint` — or `@dotit/pdf` for real PDF bytes.
- **PDF from the UI.** Call `exportDocumentPDF(source, theme)` from your own button — it uses the user's browser print dialog and matches the on-screen pages exactly.
- **Trust flows.** Sealed documents lock automatically. Hook `onTrustAction` to your approval/signature flows; the editor renders `sign:`/`seal:`/`approve:` blocks as proper signature lines and chips.
- **Insert at caret.** Dispatch `window.dispatchEvent(new CustomEvent("it-insert-text", { detail: "{{customer.name}}" }))` to insert text at the cursor (e.g. from your own variable picker).
- **Styling.** All styles are scoped under `.docs-container`/`.docs-page` and ship in one stylesheet (`@dotit/editor/style.css`); the editor does not depend on host-page CSS resets. One editor instance per page is the supported setup (theme CSS is injected document-wide).

## SSR / Next.js

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

`exportDocumentPDF` / `exportDocumentHTML` must also only be called in the browser. For server-side PDF generation use `@dotit/pdf`.

## License

MIT
