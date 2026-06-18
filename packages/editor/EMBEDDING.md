# Embedding `@dotit/editor` (e.g. inside an ERP like Jadwal)

`@dotit/editor` is **one** browser-only React package. You embed it directly in
your dashboard — no iframe, no second app. Every "mode" (author a template, design
a form, fill a form, review redlines, view) is the **same package**; you either
mount the unified `<IntentTextWorkbench mode="…">` or import a single sub-component
for a leaner page.

The document is always just a `.it` **string** — store it in your DB like any text,
diff it, query its answers. The editor is a *controlled* component: you own the
string (`value` / `onChange`).

## Install

```bash
npm install @dotit/editor @dotit/core
```

```ts
import "@dotit/editor/style.css"; // once, app-wide
```

`@dotit/core` carries all the parsing / trust / query logic (no UI). Add
`@dotit/sign` if you want to seal/sign/verify; `@dotit/pdf` for server-side PDF.

## The one-component way — `IntentTextWorkbench`

```tsx
import { IntentTextWorkbench } from "@dotit/editor";

function DocPage({ source, onSource, mode }) {
  return (
    <IntentTextWorkbench
      value={source}
      onChange={onSource}
      mode={mode}              // "edit" | "fill" | "view" | "review" | "auto"
      theme="corporate"
      onSubmit={(s) => /* a complete form was submitted → offer Sign */ {}}
      onTrustAction={(a) => /* ribbon Seal/Sign/Verify intent → your dialog */ {}}
    />
  );
}
```

| `mode` | What it is | Your dashboard use |
|---|---|---|
| `"edit"` | full WYSIWYG + ribbon | **template creation** (type `{{var}}`) and **form creation** (Insert ▸ Fields) — same surface |
| `"fill"` | live form controls | recipient **fills** a form you sent; `onSubmit` fires when complete |
| `"review"` | accept/reject redline | review tracked changes / **compare versions** |
| `"view"` | read-only page sheets | read-like-PDF preview |
| `"auto"` | picks from the doc | a form ⇒ fill, pending redlines ⇒ review, else edit |

## The lean way — import one component per page

Tree-shakes to a smaller bundle when a page only needs one surface:

```tsx
import { FormFill }          from "@dotit/editor"; // a fill-only page
import { IntentTextEditor }  from "@dotit/editor"; // an author/design page
import { DocumentView }      from "@dotit/editor"; // a read-only viewer
import { Redline }           from "@dotit/editor"; // a review page
```

So your three asks map cleanly:
- **form-fill** → `<FormFill>` (or `mode="fill"`)
- **form-create** → `<IntentTextEditor>` with Insert ▸ Fields (or `mode="edit"`)
- **template-create** → `<IntentTextEditor>` typing `{{variables}}` (or `mode="edit"`)

Template-create and form-create are the *same* component — the only difference is
what you author (`{{vars}}` vs `input:` fields).

## A full ERP flow (build → send → fill → sign → store)

```tsx
import { useState } from "react";
import { IntentTextWorkbench } from "@dotit/editor";
import {
  isFormComplete, formAnswers, sealDocument, verifyDocument, parseAndMerge,
  documentToSource,
} from "@dotit/core";
import "@dotit/editor/style.css";

export function JadwalDocWorkbench({ initial = "", initialMode = "auto" }) {
  const [src, setSrc] = useState(initial);

  return (
    <div style={{ height: "100%" }}>
      <IntentTextWorkbench
        value={src}
        onChange={setSrc}
        mode={initialMode}
        theme="corporate"
        // A complete form came back from a recipient → seal it as a final record.
        onSubmit={(completed) => {
          if (!isFormComplete(completed)) return;
          const sealed = sealDocument(completed, { signer: "Jadwal" }).source;
          saveToJadwalDb(sealed);                 // store the .it string
          indexAnswers(formAnswers(sealed));       // queryable answers by field key
        }}
        // Ribbon Seal/Sign/Verify intent → wire to your own dialogs / the UTS service.
        onTrustAction={(action) => {
          if (action.kind === "verify") alert(JSON.stringify(verifyDocument(src)));
        }}
      />
    </div>
  );
}

// Generating a document FROM a template + Jadwal data (server or client):
function renderInvoice(templateIt: string, invoice: object) {
  return documentToSource(parseAndMerge(templateIt, invoice)); // → a final .it
}

declare function saveToJadwalDb(it: string): void;
declare function indexAnswers(a: Record<string, string>): void;
```

## Notes

- **Styling** is scoped (`.it-*` classes); the one `style.css` import is all you need.
  Document themes (`builtinThemes()`) are separate from your app chrome.
- **React** ≥18 peer; the package is ESM + CJS.
- **Trust** never happens implicitly — the editor only reports intent
  (`onTrustAction`, `onSubmit`); you call `@dotit/core`'s `sealDocument` /
  `signDocument` / `verifyDocument` (or POST to the UTS service) so your app stays in
  control of keys and policy. The built-in trust banner is multi-sign aware (per-signer
  `Signed · N/M`; an older-ruleset seal shows `Sealed · older ruleset`; a tampered seal
  shows `SEAL BROKEN`), and the `"view"` surface plus print/PDF draw `@dotit/core`'s
  unified, integrity-gated certification band (`renderTrustBand`) — identical on screen
  and on paper, and never drawn over a tampered document.
- **Source ↔ editor** round-trips losslessly (`sourceToDoc` / `docToSource`), so a
  sealed document keeps its hash through an open/close.
