# ERP integration — template + data → HTML/PDF (the "Jadwal" pattern)

Use IntentText as the print/report engine inside an existing ERP, with **no viewer to
build** and **one dependency**. Author a template once in the `.it` editor (like a docx),
store it in your database, then a single button merges it with a record's data and prints.

```
.it editor  ──save .it text──▶  Mongo: print-template { key:"invtemplate", source }
                                          │
ERP record (invoice/report JSON) ─────────┤
                                          ▼
                          parseAndMerge(source, data) → renderHTML / renderPrint
                                          ▼
                                   HTML  or  PDF  (print button)
```

## TL;DR

```bash
npm i @dotit/core      # the one and only dependency
```

```js
import { renderDocumentHTML, printDocument } from "./intenttext-print.mjs";

// template.source = the .it text from your DB; invoice = your record's JSON
const html = renderDocumentHTML(template.source, invoice, { theme: "corporate" });
// …show `html` in a tab/modal, or in the browser just:
printDocument(template.source, invoice, { theme: "corporate" });   // → print dialog
```

That's the whole integration. `intenttext-print.mjs` (one small file) is what you copy in.

## Run this demo

```bash
pnpm demo:erp          # from the repo root
# → out.invoice.html (web view) + out.invoice.print.html (Cmd/Ctrl+P → Save as PDF)
```

## 1. The template is just `.it` text — store it as a string

Don't store an AST/JSON tree. The portable, diffable, future-proof representation **is the
`.it` source string** — `parseAndMerge` takes it directly. Your `print-template`
collection document is simply:

```js
// db.collection("print-template")
{
  key: "invtemplate",          // your template id
  company: "<companyId>",       // per customer/company, as you wanted
  theme: "corporate",           // corporate | legal | editorial | technical | minimal | …
  source: "font: | family: Inter…\npage: | size: A4 …\ntitle: Invoice {{invoice.number}}\n…"
}
```

`source` is the exact text the `.it` editor produces (see [`invoice-template.it`](invoice-template.it)).
Placeholders are `{{path.to.value}}`; tables repeat with `each:` (see below).

### Saving from the editor

The editor works on `.it` text. To save a template into Jadwal, take that text and
`PUT` it:

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

The template's `{{…}}` paths resolve against whatever object you pass. Shape your record
to match the template (or author the template to match your record). For the invoice
template here, the data looks like [`invoice-data.json`](invoice-data.json):

```json
{
  "company":  { "name": "Jadwal Technology", "email": "…", "vat": "…" },
  "customer": { "name": "Acme Corporation", "email": "…" },
  "invoice":  { "number": "INV-2026-0042", "date": "…", "dueDate": "…", "status": "Unpaid" },
  "items":    [ { "description": "…", "qty": 1, "unitPrice": "…", "total": "…" } ],
  "totals":   { "subtotal": "…", "taxRate": 5, "tax": "…", "due": "…" }
}
```

Table loop: the template line

```
| {{item.description}} | {{item.qty}} | {{item.unitPrice}} | {{item.total}} | each: items |
```

repeats once per element of `items`, binding each to `item`.

## 3. The Print button

### Option A — browser, zero extra deps (recommended for an interactive button)

`renderDocumentPrintHTML` returns print-ready HTML; `printHTML` prints exactly what you
see via the native dialog (→ **Save as PDF**). No PDF library, no server round-trip.

```js
import { printDocument } from "./intenttext-print.mjs";

async function onPrintInvoice(invoiceId) {
  const [template, invoice] = await Promise.all([
    fetch(`/api/print-templates/invtemplate`).then((r) => r.json()),
    fetch(`/api/invoices/${invoiceId}`).then((r) => r.json()),
  ]);
  printDocument(template.source, invoice, { theme: template.theme });
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
import { renderDocumentPDF } from "./intenttext-pdf.server.mjs";

app.get("/api/invoices/:id/pdf", async (req, res) => {
  const template = await db.collection("print-template").findOne({ key: "invtemplate", company });
  const invoice  = await db.collection("invoices").findOne({ _id: req.params.id });
  const pdf = await renderDocumentPDF(template.source, invoice, { theme: template.theme });
  res.type("application/pdf").send(pdf);
});
```

## Files in this kit

| File | What it is |
| --- | --- |
| [`intenttext-print.mjs`](intenttext-print.mjs) | **Copy this into your app.** Merge + render + browser print. Browser- and Node-safe. |
| [`intenttext-pdf.server.mjs`](intenttext-pdf.server.mjs) | Optional server PDF via puppeteer. |
| [`invoice-template.it`](invoice-template.it) | The template (author yours in the `.it` editor). |
| [`invoice-data.json`](invoice-data.json) | Example record data shape. |
| [`run.mjs`](run.mjs) | Runnable end-to-end demo (`pnpm demo:erp`). |

## Why this is portable

- **One package** (`@dotit/core`), one small file you own.
- **No viewer** — `renderHTML` gives you a complete, self-contained HTML document
  (inline CSS); the print path reuses the browser you already have.
- **Templates are text** — versionable, diffable, editable in the `.it` editor, with no
  lock-in to a binary format.
- **Same engine everywhere** — the editor, this kit, and the CLI all call the same core,
  so what you design is what prints.
