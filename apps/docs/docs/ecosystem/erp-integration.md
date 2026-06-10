---
sidebar_position: 9
title: ERP / App Integration
---

# ERP / App Integration

Use IntentText as the **print & report engine** inside an existing app (ERP, CRM, billing
system) — with **one dependency** and **no document viewer to build**. Author a template
once in the [editor](./editor), store it in your database, then one button merges it with
a record's data and produces HTML or a PDF.

```
.it editor  ──save .it text──▶  DB: print-template { key, source }
                                          │
record (invoice / report JSON) ───────────┤
                                          ▼
                  parseAndMerge(source, data) → renderHTML / renderPrint
                                          ▼
                                  HTML  or  PDF  (the "Print" button)
```

A runnable reference kit lives in the repo at `demo/erp-integration/` — run
`pnpm demo:erp`. This guide is the same pattern, explained.

## Install

```bash
npm i @intenttext/core      # the one and only dependency
```

Everything below uses three functions from a single helper file you copy into your app
(`intenttext-print.mjs` in the demo). It works in the **browser and Node** (same code).

```js
import { parseIntentText, renderHTML, renderPrint } from "@intenttext/core";

export function renderDocumentHTML(templateSource, data, opts = {}) {
  return renderHTML(parseAndMergeSafe(templateSource, data), { theme: opts.theme || "corporate" });
}
export function renderDocumentPrintHTML(templateSource, data, opts = {}) {
  return renderPrint(parseAndMergeSafe(templateSource, data), { theme: opts.theme || "corporate" });
}
```

(The demo's helper uses `parseAndMerge` directly and also ships `printHTML` /
`printDocument` for the browser print dialog — see [The Print button](#3-the-print-button).)

## 1. Store the template as `.it` text — not an AST

The portable, diffable, future-proof representation **is the `.it` source string**.
`parseAndMerge` consumes it directly, so storing a parsed tree would only add a
serialize step. Your template collection document is simply:

```js
// db.collection("print-template")
{
  key: "invtemplate",          // your template id
  company: "<companyId>",      // per customer/company
  theme: "corporate",          // corporate | legal | editorial | technical | minimal | …
  source: "font: | family: Inter…\ntitle: Invoice {{invoice.number}}\n…"
}
```

`source` is exactly what the [editor](./editor) produces. Placeholders are
`{{path.to.value}}`; tables repeat with `each:` (below). Style part of a line with an
[inline styled span](../reference/style-properties#styling-part-of-a-line--inline-styled-spans),
e.g. `value: [17,325 QAR]{ size: 1.2em; weight: bold }` — it prints identically here as
in the editor.

### Saving a template from the editor

The editor works on `.it` text — take that text and `PUT` it:

```js
await fetch("/api/print-templates/invtemplate", {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ company, theme, source: editorText }),
});
// server: db.collection("print-template").updateOne(
//   { key: "invtemplate", company }, { $set: { theme, source } }, { upsert: true });
```

## 2. The data is your record's JSON

The template's `{{…}}` paths resolve against whatever object you pass — shape your record
to match the template (or author the template to match your record):

```json
{
  "company":  { "name": "Jadwal Technology", "email": "…", "vat": "…" },
  "customer": { "name": "Acme Corporation", "email": "…" },
  "invoice":  { "number": "INV-2026-0042", "date": "…", "dueDate": "…", "status": "Unpaid" },
  "items":    [ { "description": "…", "qty": 1, "unitPrice": "…", "total": "…" } ],
  "totals":   { "subtotal": "…", "taxRate": 5, "tax": "…", "due": "…" }
}
```

The table loop — this template line repeats once per element of `items`, binding each to
`item`:

```
| {{item.description}} | {{item.qty}} | {{item.unitPrice}} | {{item.total}} | each: items |
```

See [Templates](../reference/templates) for the full merge semantics.

## 3. The Print button

### Option A — browser, zero extra deps (recommended)

`renderDocumentPrintHTML` returns print-ready HTML (`@page` size/margins, running
header/footer, page numbers); print it via a hidden iframe and the browser's native
dialog → **Save as PDF**. No PDF library, no server round-trip — it prints exactly what
you see.

```js
async function onPrintInvoice(invoiceId) {
  const [template, invoice] = await Promise.all([
    fetch(`/api/print-templates/invtemplate`).then((r) => r.json()),
    fetch(`/api/invoices/${invoiceId}`).then((r) => r.json()),
  ]);
  printDocument(template.source, invoice, { theme: template.theme }); // merge + print
}
```

To **show** the result instead of printing, drop the HTML into an iframe/modal:

```js
const html = renderDocumentHTML(template.source, invoice, { theme: template.theme });
document.querySelector("#preview").srcdoc = html;   // <iframe id="preview">
```

### Option B — server, real PDF file (for emailing / archiving)

Only if you need a PDF on disk. One extra dependency:

```bash
npm i puppeteer
```

```js
import { renderDocumentPrintHTML } from "./intenttext-print.mjs";

export async function renderDocumentPDF(templateSource, data, opts = {}) {
  const html = renderDocumentPrintHTML(templateSource, data, opts);
  const puppeteer = (await import("puppeteer")).default;
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    return await page.pdf({ printBackground: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
  }
}

// Express: stream the PDF
app.get("/api/invoices/:id/pdf", async (req, res) => {
  const template = await db.collection("print-template").findOne({ key: "invtemplate", company });
  const invoice  = await db.collection("invoices").findOne({ _id: req.params.id });
  const pdf = await renderDocumentPDF(template.source, invoice, { theme: template.theme });
  res.type("application/pdf").send(pdf);
});
```

## Why this is portable

- **One package** (`@intenttext/core`) plus one small file you own.
- **No viewer** — `renderHTML` returns a complete, self-contained HTML document (inline
  CSS); the print path reuses the browser you already have.
- **Templates are text** — versionable, diffable, editable in the editor, no lock-in.
- **Same engine everywhere** — the editor, this kit, and the CLI all call the same core,
  so what you design is what prints (including [inline styled spans](../reference/style-properties#styling-part-of-a-line--inline-styled-spans)).

## Related

- [Web Editor](./editor) — author templates visually
- [Core API](./core-api) — `parseAndMerge`, `renderHTML`, `renderPrint`
- [Templates](../reference/templates) · [Style Properties](../reference/style-properties)
- [Themes](./themes) — the built-in document themes
