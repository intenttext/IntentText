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
npm i @dotit/core      # the one and only dependency
```

Everything below uses three functions from a single helper file you copy into your app
(`intenttext-print.mjs` in the demo). It works in the **browser and Node** (same code).

```js
import { parseIntentText, renderHTML, renderPrint } from "@dotit/core";

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

**Per-tenant branding** goes in [`style:` rules](../reference/style-properties#house-styling-for-the-whole-document--style-blocks)
(v4.3) at the top of the template — house styling declared once, no per-line
repetition, content stays queryable:

```
style: section | color: #0a7 | weight: 600
style: title | family: Georgia | size: 26pt
```

Each company's stored template carries its own look; the editor shows the rules as 🎨
chips and applies them live, and core prints them identically.

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

Use **`@dotit/pdf`** — the official opt-in companion for the moments no human is at
a browser (email attachments, compliance archiving, batch statement runs):

```bash
npm i @dotit/pdf
npm i puppeteer          # or: puppeteer-core + your system Chrome (CHROME_PATH)
```

The enterprise **issue flow** in one call — merge → **seal** (tamper-evident SHA-256) →
PDF bytes:

```js
import { issuePDF } from "@dotit/pdf";
import { verifyDocument } from "@dotit/core";

app.post("/api/invoices/:id/send", async (req, res) => {
  const template = await db.collection("print-template").findOne({ key: "invtemplate", company });
  const invoice  = await db.collection("invoices").findOne({ _id: req.params.id });

  const { source, hash, at, pdf } = await issuePDF(template.source, invoice, {
    signer: "Jadwal Billing", role: "Finance", theme: template.theme,
  });

  // 1) The sealed .it text is the LEGAL ARTIFACT — store it on the record (a few KB).
  //    Years later: verifyDocument(source).intact proves it unaltered.
  await db.collection("invoices").updateOne(
    { _id: invoice._id },
    { $set: { itSource: source, itHash: hash, issuedAt: at } },
  );
  // 2) Archive the exact bytes that were sent (object storage), then email.
  await s3.putObject({ Key: `invoices/${invoice.number}.pdf`, Body: pdf });
  await mailer.send({ attachments: [{ filename: `${invoice.number}.pdf`, content: pdf }] });
  res.json({ ok: true, hash });
});
```

No Chrome in your API process? `issueDocument()` does the same merge→seal and returns
print-ready `html` — POST it to a rendering sidecar (e.g. Gotenberg) instead. For batch
runs use `createPdfRenderer()` (reuses one Chrome). Full API: the `@dotit/pdf`
README.

## Receipts (80mm thermal) and other page sizes

The same pipeline produces POS receipts — just change the template's `page:` size and
margin. Narrow pages need a small margin (an A4-style 20mm would eat half an 80mm roll);
core defaults narrow pages (≤120mm) to a tight 4mm, but set it explicitly to be sure:

```
font: | family: ui-monospace, monospace | size: 10pt
page: | size: 80mm auto | margin: 4mm

title: {{company.name}}
summary: Receipt {{invoice.number}}

section: Items
| Item | Qty | Total | each: items |
| {{item.description}} | {{item.qty}} | {{item.total}} |

section: Totals
metric: Total | value: {{totals.total}}
metric: Paid | value: {{totals.paid}}
Thank you · {{company.name}}
```

Keep receipt tables to **2–3 narrow columns** so they fit the roll width. `size:` also
accepts `A4`, `A5`, `Letter`, `Legal`, or any CSS size (`size: 210mm 297mm`).

## Missing data, totals, and Arabic

- **Missing fields print blank, not `{{token}}`.** The kit merges with `missing: "blank"`,
  so an absent optional field (e.g. `{{customer.phone}}`) renders empty rather than
  leaking the placeholder onto the document. Pass `{ missing: "keep" }` only while
  authoring a template, to see which fields are unfilled.
- **Totals render as label→value rows.** `metric: Subtotal | value: …` is a document
  total line (label left, amount right; a `Total`/`Balance Due` row is emphasized) — the
  same as the editor. A metric with `target:`/`trend:` renders as a dashboard KPI card
  instead.
- **Arabic / RTL** works out of the box: add `meta: | dir: rtl` and the document (table
  column order, totals, running footer) lays out right-to-left. Mix Arabic and Latin
  freely; numbers and `{{invoice.number}}` stay correct via the browser's bidi handling.
- **Untrusted data is safe.** Merged values are HTML-escaped, and style-property values
  (e.g. a per-tenant `color:`) can't break out of the `style` attribute — so invoice data
  from your database can't inject markup.

## The enterprise layer — trust, approvals & compliance

For an ERP (Jadwal) or accounting platform (tadween), the document is not just a
printout — it's a **record of truth that carries its own approvals, signatures,
and audit trail**, verifiable offline with no database lookup. Everything below is
in `@dotit/core`.

### Store `.it` so a seal can never break

The seal is a SHA-256 hash over the document's **content** under `spec: 4` — it excludes
styling + comments and normalizes line endings (CRLF/CR → LF) + trailing whitespace, so a
reformat, a `git autocrlf` transform, or a whitespace re-save **won't** break it; only a real
content change does. Storing the `.it` as **UTF-8 text, exactly as authored** is still the
safest default (it keeps every byte stable for diffs and signatures). The storage contract
makes byte-integrity a hard, separate guarantee:

```ts
import { toStorageRecord, fromStorageRecord } from "@dotit/core";

// write: store the source + an integrity tag
const rec = toStorageRecord(itSource);          // { source, bytesSha256 }
await db.documents.insert({ _id, ...rec });

// read: throws loudly if the storage layer mutated even one byte
const itSource = fromStorageRecord(await db.documents.findById(_id));
```

A sealed document round-trips byte-for-byte through this, so `verifyDocument` keeps
returning `intact: true`. (A `.it` opened in the **visual editor is read-only when
sealed**, so the editor never rewrites a sealed body.)

### Forms — fillable, computed, signable

`meta: type: form` turns `input:` lines into fields a recipient completes — with
conditional (`show-if:`), computed (`compute: qty * price`), attachment, and
signature fields. Fill programmatically and check completeness before signing:

```ts
import { applyAnswers, isFormComplete, sealFormStructure } from "@dotit/core";
const filled = applyAnswers(blankForm, { legal_name: "Acme", qty: "10", unit_price: "250" });
if (isFormComplete(filled)) { /* now signable */ }
```

### In-file approval routing — derived, never stored

The document declares **who must approve, in what order**, and its live state is
**derived from the file** — so the ERP never keeps a separate, drift-prone workflow
table:

```text
route: sequential
require: manager
require: finance | when: amount > 100000
require: legal
```
```ts
import { workflowState, appendApproval, verifyAuditChain } from "@dotit/core";

let doc = appendApproval(itSource, { by: "Sarah", role: "manager" });  // hash-chained
const s = workflowState(doc);   // { pending:["finance","legal"], next:"finance", complete:false }

// the approval SEQUENCE itself is tamper-evident:
verifyAuditChain(doc).valid;    // false if any approval was inserted/deleted/reordered/edited
```

Render a "who's next / what's pending" widget straight from `workflowState(doc)`;
gate the ERP's "Sign" button on `complete`.

### Sign, seal, verify — offline, no backend

```ts
import { signDocument, sealDocument, verifyDocument } from "@dotit/core";
const signed = signDocument(doc, { signer: "Ahmed", role: "CEO" }).source;
const sealed = sealDocument(signed, { signer: "Ahmed" }).source;
const v = verifyDocument(sealed);  // { intact, frozen, signers:[{valid, signedCurrentVersion}], … }
```

Everything needed to verify — the content hash, each signature, the public key — is
**inside the file**. Hand it to a counterparty, a court, or an auditor; they verify
without trusting your system.

### Review, archival & legal PDF

- **Redline** — `compareVersions(a, b)` and `acceptChanges`/`rejectChanges` for
  contract negotiation; a document with no pending changes is final/sealable.
- **PDF/A** archival and **PAdES** (`@dotit/pdf` `renderSignedPDF`, `toPdfA`) for
  court-recognized, long-term-archivable PDF output.

### Embed the editor in your app

```tsx
import { IntentTextWorkbench } from "@dotit/editor";
// one component, switch behaviour by intent:
<IntentTextWorkbench value={itSource} onChange={setItSource}
  mode="edit | fill | view | review | auto" />
```

`auto` detects the document (a form → fill UI, a sealed doc → read-only viewer, a
draft → editor), so a single embed serves every stage of the document's life.

## Why this is portable

- **One package** (`@dotit/core`) plus one small file you own.
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
