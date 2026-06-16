# IntentText (.it) — The Integration Guide

This is the single file to read before building **dotit / IntentText** into your
software. It covers the format, every published package, and complete runnable
recipes for the main integration patterns: ERP document generation, internal
documentation, archive & compliance, editor embedding, AI agents, and
database-free search. Every code block in this file was executed against the
published packages before being written down; the few that cannot run outside a
browser are marked.

- Docs site: https://dotit.uts.qa · Format reference for LLMs: https://dotit.uts.qa/llms.txt
- This file, servable: https://dotit.uts.qa/integration.md
- Spec (canonical grammar): [`packages/core/SPEC.md`](packages/core/SPEC.md)
- Source: https://github.com/intenttext/IntentText (MIT)

| Package | Version | What it is | Install |
| --- | --- | --- | --- |
| `@dotit/core` | **1.12.0** | Parser, HTML/print renderers, query engine, template merge, trust (seal/sign/verify), **forms, redline/compare, redaction, attachments, two-party form trust, conditional/computed fields, math markers**, themes, converters, CLI. Zero runtime deps; Node + browser. | `npm i @dotit/core` |
| `@dotit/editor` | **1.8.0** | Embeddable React editor — **all modes in one `<IntentTextWorkbench>`** (edit/fill/review/view), ribbon, trust banner, attachment fill UI, version-compare, WYSIWYG PDF. Browser-only. | `npm i @dotit/editor` |
| `@dotit/pdf` | **1.1.0** | Server-side PDF bytes: merge → seal → PDF; **PDF/A archival** (`toPdfA`); PAdES-signed PDF (`renderSignedPDF`). Puppeteer is an *optional* peer. | `npm i @dotit/pdf puppeteer` |
| `@dotit/pades` | **1.0.0** | **PAdES** (Adobe/court-recognized) PDF signatures — ECDSA P-256 + X.509 + CMS; CSR/CA issuance; RFC-3161 timestamps; CLI. | `npm i @dotit/pades` |
| `@dotit/sign` | **1.4.1** | Ed25519 signatures (provable *who signed*) + UTS certifications + root→intermediate chain. Offline, self-verifying. | `npm i @dotit/sign` |
| `@dotit/math` | **0.1.0** | Render core's math placeholders → MathML (dependency-free lite) or full **KaTeX** (optional peer). | `npm i @dotit/math` |
| `@dotit/mcp` | **1.1.1** | MCP server exposing the IntentText toolset to any AI agent (stdio + HTTP). | `npx @dotit/mcp` |
| VS Code extension | `intenttext.intenttext` | Highlighting, live preview, diagnostics, completion, hover docs. | VS Code Marketplace |
| GitHub Action | `intenttext/intenttext-action@v1` | Validate (and optionally verify seals of) every `.it` file in CI. | workflow yaml |
| `intenttext` (PyPI) | experimental | Thin Python wrapper that shells out to the core CLI — never re-implements the grammar. | `pip install intenttext` |

---

## 1. What is `.it`, in ten lines

1. A `.it` file is plain UTF-8 text where **every line declares its own meaning**:
   `task: Ship auth | owner: Ahmed | due: 2026-06-20`.
2. One file is simultaneously a **readable document**, a **typed queryable
   database**, a **print/PDF-ready artifact**, and a **tamper-evident sealable record**.
3. The text before the first `:` is the keyword (block type); ` | key: value`
   segments attach typed properties.
4. Parsing is deterministic — no NLP, no guessing. `parseIntentText(src)` returns
   typed JSON blocks; `documentToSource(doc)` goes back.
5. Unknown keywords never error: `expense: Chairs | vendor: IKEA` parses as a
   typed `custom` block. Invent domain keywords freely.
6. Templates are `.it` files with `{{placeholders}}`; `parseAndMerge` resolves them
   from a JSON object, including repeating table rows.
7. `sealDocument` freezes the content under a SHA-256 hash anyone can recompute;
   `verifyDocument` detects any later edit.
8. Arabic is native: 33 Arabic keyword aliases, automatic RTL, bidi-isolated values,
   byte-stable round-trips.
9. A folder of `.it` files is a database: `dotit query ./contracts --type deadline`.
10. Everything is MIT, plain text, diffable, greppable, versionable in git.

**Choose `.it` over a DB row** when the artifact must also be a *document* humans
read, print, and sign (invoice, contract, report, meeting record) — you get the
data back out with a query instead of a parser. **Choose it over Word/PDF** when
machines must generate, validate, diff, or verify the content — PDF is a view you
can always render; the `.it` source stays the truth. **Choose it over Markdown**
when structure matters: Markdown gives you prose with headings; `.it` gives every
line a type and properties you can query, validate, merge, and seal. Choose plain
Markdown for free-form prose with no data inside.

---

## 2. The format crash course

Read this section and you can author any valid `.it` document. The canonical
grammar is [`packages/core/SPEC.md`](packages/core/SPEC.md); where anything
disagrees, the spec wins.

### 2.1 Line grammar

```
keyword: content | prop: value | prop: value
```

- Everything before the first `:` is the **keyword**. Content runs to the first
  ` | ` (space-pipe-space). Each ` | key: value` becomes a property.
- Only ` | ` (with spaces) splits — `a|b` inside content or a value stays literal.
  For a literal ` | ` sequence, escape the pipe: `\|`. Literal backslash: `\\`.
  The serializer re-escapes on output, so round-trips are stable.
- Colons need **no** escaping inside content or values: `quote: He said: watch this`
  is fine. Only the first word+colon of a line is a keyword.
- `// comment` lines are comments. Indenting a line by 2+ spaces continues the
  previous block. A ` ``` ` fence opens/closes a verbatim code block.
- **Blank lines matter for prose**: consecutive `text:` lines merge into one
  paragraph (and the merged lines' pipe properties are dropped). Separate
  paragraphs with a blank line. Typed lines (`task:`, `metric:`, …) never merge.
- Prose that *looks* like a keyword line (`total: 50` as body text) parses as a
  `custom` block — write it explicitly as `text: total: 50`.
- Keywords and property keys are Unicode words: Arabic (or any-script) domain
  keywords work exactly like ASCII ones. `x-ns:` prefixes are namespaced extensions.

### 2.2 The 38 canonical keywords, by tier

| Tier | Keywords | Use for |
| --- | --- | --- |
| **core** | `title` `summary` `meta` `section` `sub` `text` `info` `quote` `code` `image` `link` `task` `done` | Everyday documents |
| **data** | `columns` `row` `metric` | Tables, KPIs, invoice totals |
| **contract** | `track` `approve` `sign` `freeze` `amendment` `cite` | Signed, sealed, auditable documents |
| **agent** | `step` `decision` `gate` `trigger` `result` `policy` `audit` `ask` `context` | AI / workflow documents |
| **print** | `page` `header` `footer` `watermark` `style` `break` `toc` | Print & PDF layout |

Plus: `history:` (the audit-log boundary), `divider:` / `---` (horizontal rule),
`revision:` (history entries), and well-known extension keywords with first-class
rendering and query support: **`deadline:`** (dated obligation), **`contact:`**
(person/org card), **`def:`** (glossary term), **`ref:`** (cross-document
reference). Lists are native (`- item`, `1. item`), and pipe rows are tables
(first row = header).

The blocks you will use constantly:

```intenttext
title: Service Agreement — Acme Gulf Trading
summary: Managed hosting, Q3 renewal
meta: | ref: CON-2026-014 | status: active | type: contract

section: Scope
text: Managed hosting, 99.9% uptime SLA, monthly reporting.
info: Renewal is automatic unless cancelled | type: warning
deadline: First invoice due | date: 2026-07-01 | consequence: 2% late fee
task: Countersign | owner: Fahad | due: 2026-06-20 | priority: high
done: Legal review | time: 2026-06-01

section: Parties
contact: Acme Gulf Trading WLL | email: ops@acmegulf.qa | role: Client

section: Totals
| Item | Qty | Price |
| Office chairs | 12 | 250 QAR |
metric: Total Due | value: 3,000 QAR
```

Notes: `info:` takes `type: tip|info|warning|danger|success`. A plain `metric:`
renders as a label→value total row (invoice style); add `target:`/`trend:`/`period:`
and it becomes a KPI card. Tables can also be written as
`columns: Item | Qty | Price` + `row: Chairs | 12 | 250 QAR`.

### 2.3 Dates

Date-bearing properties (`date`, `due`, `at`, `expires`, `issued`) are **ISO 8601**:
`2026-06-20` or `2026-06-20T09:00:00Z`. Locale forms (`09/03/2026`) are ambiguous,
break date-range queries, and trigger the semantic validator's `DATE_NOT_ISO`
warning. Template placeholders are exempt.

### 2.4 Inline formatting

Inside any content: `*bold*` `_italic_` `~strike~` `^highlight^` `` `code` ``
`[label](https://url)` `[[side note]]` `@mention` `#tag` `@2026-05-01` (date)
`{Label}` (badge pill).

**Styled span** — style part of a line with the same keys as block style props,
but **semicolon**-separated (`|` is reserved for line properties):

```intenttext
text: Payment is [overdue]{ color: #c00; weight: bold } — act now.
metric: Total | value: [17,325 QAR]{ size: 1.2em; weight: bold }
```

### 2.5 Styling — three layers, never raw CSS

```intenttext
meta: | theme: corporate
style: section | color: #0a7466 | weight: 600
style: text | leading: 1.8
text: One paragraph with extra room below. | space-after: 24px
```

1. **Theme** (document class): `corporate` `minimal` `warm` `technical` `print`
   `legal` `editorial` `dark` — via `meta: | theme: …` or the render option.
2. **`style:` rules** — house styling per block type, declared once, document-wide.
   Targets: `title summary section sub text quote callout info table table-header
   metric contact divider`. Rules apply after the theme; per-line props win over rules.
3. **Per-line props and `[text]{…}` spans** for exceptions.

The only style keys (never invent others): `color, size, family, weight,
align(center|right|justify), bg, indent, opacity, italic: true, border: true,
underline: true, strike: true, valign(sub|super)` plus the spacing trio
`leading` (line-height), `space-before`, `space-after`.

**Two-sided rows**: `end:` on `title:`/`section:`/`sub:`/`text:` puts content at
the line start and the value at the line end (the invoice "label left, date right"
row). RTL-aware automatically:

```intenttext
text: Customer Name | end: 2026-06-12
```

### 2.6 Page layout & print

```intenttext
page: | size: A4 | margin: 20mm
header: ACME Corp — Confidential
footer: INV-042 · Page {{page}} of {{pages}}
watermark: DRAFT | opacity: 0.1
break:
```

`size:` accepts `A4 A5 Letter Legal` or custom `80mm auto` (receipt roll — no
pagination; use 2–3 narrow table columns and `margin: 4mm`). `{{page}}`/`{{pages}}`
compile to real CSS page counters in `renderPrint` output. `{{date}}` and
`{{year}}` resolve automatically at merge time.

### 2.7 Templates and merge

A template is a normal `.it` file with `{{dot.path}}` placeholders (array indices:
`{{items.0.qty}}`). Repeating table rows: put `each: <arrayPath>` on the header
row; the next row is the item template, each element bound to `item`:

```intenttext
page: | size: A4 | margin: 20mm
header: {{company.name}}
footer: {{invoice.number}} · Page {{page}} of {{pages}}

title: Invoice {{invoice.number}}
summary: {{company.name}} → {{customer.name}}

section: Bill To
contact: {{customer.name}} | email: {{customer.email}}

section: Line Items
| Description | Qty | Unit Price | Total | each: items |
| {{item.description}} | {{item.qty}} | {{item.unitPrice}} | {{item.total}} |

section: Totals
metric: Subtotal | value: {{totals.subtotal}}
metric: Tax ({{totals.taxRate}}%) | value: {{totals.tax}}
metric: Total Due | value: {{totals.due}}
```

Merge with `parseAndMerge(templateSource, data, { missing: "blank" })` —
`"blank"` renders unresolved fields empty (finished documents); the default
`"keep"` shows the literal marker (authoring aid). **Never hand-interpolate**
strings into templates; the merge engine handles escaping and row expansion.

### 2.8 Arabic and bidi

Whole documents can be written in Arabic — 33 registered aliases give Arabic
keywords full canonical semantics, and the serializer re-emits the keyword **as
written**, so Arabic files stay Arabic and sealed hashes survive round-trips:

```intenttext
عنوان: عرض سعر — تأثيث المكتب الرئيسي
ملخص: شركة الإتقان للتجارة — صالح حتى 2026-07-15
قسم: البنود
أعمدة: الوصف | الكمية | الإجمالي
صف: كرسي مكتب تنفيذي | 12 | 10,200 QAR
مؤشر: الإجمالي المستحق | value: 10,200 QAR
مهمة: اعتماد العرض | owner: أحمد | due: 2026-06-20
```

Alias table: `عنوان`=title `ملخص`=summary `بيانات`=meta `قسم`=section `فرعي`=sub
`نص`=text `تنبيه`=info `اقتباس`=quote `استشهاد`=cite `شيفرة`=code `صورة`=image
`رابط`=link `مهمة`=task `منجز`=done `أعمدة`=columns `صف`=row `مؤشر`=metric
`تتبع`=track `اعتماد`=approve `توقيع`=sign `تجميد`=freeze `تعديل`=amendment
`صفحة`=page `ترويسة`=header `تذييل`=footer `علامة`=watermark `نمط`=style
`فاصل`=break `مهلة`=deadline `جهة`/`تواصل`=contact `تعريف`=def `مرجع`=ref.

Property **keys** stay English for now (`owner:`, `due:`, `value:`); dates stay ISO.
Any Arabic content flips the document to RTL automatically (all built-in CSS uses
logical properties, so tables, totals, and print footers mirror). Force direction
with `meta: | dir: rtl`. Mixed-language values (amounts, dates, emails) are
direction-isolated with `dir="auto"` — never reorder or pad them yourself. One
query (`type=task`) finds tasks across languages.

### 2.9 Trust lines — what sealing actually is

Lifecycle: `track:` → `approve:` → `sign:` → `freeze:` (seal) → verify → `amendment:`.

```intenttext
track: | id: CON-2026-014 | by: Ahmed
approve: Legal review complete | by: Sara Haddad | role: Counsel | at: 2026-06-01
sign: Fahad Al-Thani | role: Managing Director | at: 2026-06-12T09:00:00Z | hash: sha256:…
freeze: | at: 2026-06-12T09:00:00Z | hash: sha256:… | status: locked
amendment: Late fee reduced | was: 2% | now: 1.5% | ref: Amendment #1 | by: Fahad | at: 2026-06-20
history:
revision: | version: 1.1 | at: 2026-06-13T08:00:00Z | by: Ops | change: archived
```

The document hash is **SHA-256 over the raw source above the `history:` boundary,
excluding lines that start with `sign:`/`freeze:`/`amendment:`** (`approve:` IS
included — an approval is part of what gets approved), joined with LF, trimmed,
UTF-8. `sealDocument()` computes it and inserts the `sign:` + `freeze:` lines;
`verifyDocument()` recomputes and compares.

The base seal is **tamper-evidence (integrity)**:

- It proves the content is byte-identical to what was sealed. Anyone with any
  SHA-256 implementation can recompute it — no vendor, no key registry.
- The bare `sign:` *name* is a claim, not a cryptographic identity. For provable
  identity, add **`@dotit/sign` (Ed25519)** — see below.

### 2.9a Cryptographic signatures — `@dotit/sign` (provable "who")

`@dotit/sign` upgrades a `sign:` line from a typed name to a real **Ed25519
signature**. Each signer has a keypair; the `sign:` line embeds the signature and
the public key, so a signed `.it` is **self-verifying and offline** — it carries
everything needed to check it, nothing leaves the machine.

```ts
import { generateSigningKey, signDocumentCrypto, verifyDocumentSignatures } from "@dotit/sign";

const key = generateSigningKey();                       // { privateKey, publicKey }
const signed = signDocumentCrypto(src, { signer: "Ahmed", role: "CEO", privateKey: key.privateKey });
//  sign: Ahmed | role: CEO | at: … | hash: sha256:… | key: ed25519:<pub> | sig: <sig>
const v = verifyDocumentSignatures(signed.source);      // { allSignaturesValid, validCount, signatures[] }
```

CLI / CI gate:

```bash
dotit-sign keygen --out key.json
dotit-sign sign contract.it --key key.json --signer "Ahmed" --role CEO
dotit-sign verify contract.it        # exit 0 = all valid, 1 = invalid
```

Editing the document invalidates its signatures; swapping the embedded public key
is rejected (no forgery); signing is idempotent per key; signatures survive
sealing. Public verification for anyone (no install): **https://verify.uts.qa** —
runs entirely in the browser, the file never uploads.

What it still does **not** prove on its own: that a public key belongs to a
specific real person (that binding is UTS certification — provable *time* and
*identity attestation* are the next layers). This is exactly the PGP/SSH/code-
signing model: a key proves the holder signed; a CA later vouches for the key.
- Append-only evolution: `amendment:` lines and everything below `history:` are
  excluded from the hash, so a frozen contract can record changes without breaking
  its seal. Never edit above `history:` after sealing.
- Don't invent hashes — only `sealDocument()` computes them.

### 2.10 Minimal valid documents

```intenttext
title: Hello
text: World.
```

```intenttext
title: Onboarding Agent
step: Validate form | tool: validate | id: s1
decision: Valid? | then: s2 | else: s3
gate: Human review | approver: Ops
step: Provision | tool: infra | id: s2
step: Notify rejection | tool: email | id: s3
result: Done | status: success
```

---

## 2.11 The latest capabilities (core 1.12 / editor 1.8)

Everything below is in the published versions in the table above. APIs are from
`@dotit/core` unless noted.

### Forms — design → fill → complete → sign

`meta: type: form` + `input:` fields make a fillable, signable document. A **complete**
form (all required filled) stops being a template and becomes signable.

```ts
import {
  isForm, isFormComplete, missingRequiredFields, applyAnswers, formAnswers,
  formVisibility, computeFormValues, sealDocument,
} from "@dotit/core";

const form = `meta: | type: form
input: Legal name | key: legal_name | type: text | required: yes
input: Country | key: country | type: choice | options: KW, SA | required: yes
input: VAT no | key: vat | type: text | show-if: country = SA      # conditional
input: Qty | key: qty | type: number | value: 4
input: Total | key: total | type: number | compute: qty * 250`;     // computed

missingRequiredFields(form);                  // ["legal_name","country"] (hidden/computed skipped)
const filled = applyAnswers(form, { legal_name: "Dalil", country: "KW" });
isFormComplete(filled);                        // true → signable
formAnswers(filled);                           // { legal_name, country, qty, total: "1000" }
const record = sealDocument(filled, { signer: "Dalil" }).source; // tamper-evident
```

Field types: text, textarea, date, number, choice, checkbox, signature, table,
**attachment**. `show-if:` conditional, `compute:` derived (safe, no `eval`).

### Two-party form trust

```ts
import { sealFormStructure, verifyFormStructure } from "@dotit/core";
const { source: blank } = sealFormStructure(form, { sealer: "Acme HR" }); // author vouches for the STRUCTURE
// recipient fills + seals; both layers verify, independently:
verifyFormStructure(record).intact;            // structure unchanged (author)
verifyDocument(record).intact;                 // answers untampered (filler)
```

### Attachments (`.it` as a container)

```ts
import { addAttachment, getAttachment, attachmentDataUri } from "@dotit/core";
let s = addAttachment(form, { key:"cr", name:"cr.pdf", mime:"application/pdf", size:0, href:"https://store/cr.pdf" }); // PREFER href
s = addAttachment(s, { key:"id", name:"id.png", mime:"image/png", size:1234, data: base64 });        // embed (≤1 MiB, sealed-with-doc)
```

### Redline & version compare (Word track-changes)

```ts
import { compareVersions, acceptChanges, rejectChanges } from "@dotit/core";
const redline = compareVersions(oldIt, newIt);  // a tracked-changes .it
acceptChanges(redline);                          // === newIt   (rejectChanges → old)
```

In the editor, `<IntentTextWorkbench mode="review">` (or a doc with tracked changes in
`mode="auto"`) renders the accept/reject UI; the editor's File ▸ "Compare versions"
runs `compareVersions` for you.

### Redaction (legally remove content)

```ts
import { applyRedactions, verifyRedaction } from "@dotit/core";
// author marks:  text: The agent [John Carter]{redact: PII} met the source.
const { source, receipts } = applyRedactions(marked); // text GONE; black-bar markers; seal as usual
verifyRedaction(receipts[0].commit, "John Carter", receipts[0].salt); // prove coverage later
```

### Math

```
math: E = mc^2                       # block      |   text: [E = mc^2]{math: tex}   # inline
```

Core marks math (a `data-tex` placeholder, dependency-free). `@dotit/math` renders it:

```ts
import { renderMathInHtml } from "@dotit/math";  // server/print
const out = await renderMathInHtml(renderHTML(parseIntentText(src)), { engine: "lite" });
// browser editor: import { hydrateMath } from "@dotit/math"; await hydrateMath(root);
```

### PDF/A + PAdES (archival + legal signatures)

```ts
import { renderPDF, toPdfA, renderSignedPDF } from "@dotit/pdf";  // Node
await renderPDF(src, { pdfA: { iccProfile, conformance: "3B" } });       // archival (needs sRGB ICC)
await renderSignedPDF(src, { signer: { certPem, privateKeyPem, tsaUrl } }); // Adobe-recognized signature
```

PDF/A compliance is validated in CI with veraPDF. Signing certs can be self-issued
(`@dotit/pades`) or issued by the UTS X.509 CA (`POST /certify/x509` with a CSR).

### Submit a completed form back

```ts
import { submitForm } from "@dotit/core";
await submitForm(completedForm, { endpoint: "https://hub/api/responses", formId: "vendor" });
```

### Editor — one component, every mode

```tsx
import { IntentTextWorkbench } from "@dotit/editor"; // + import "@dotit/editor/style.css"
<IntentTextWorkbench value={src} onChange={setSrc} mode="auto" /* edit|fill|review|view|auto */ />
```

Or import a single component per page: `TemplateEditor` / `FormDesigner` (author),
`FormFiller` (fill, with built-in attach/download), `Redline` (review), `DocViewer`.
Full guide: [`packages/editor/EMBEDDING.md`](packages/editor/EMBEDDING.md).

---

## 3. Recipes by use case

All Node examples are CommonJS for paste-ability; ESM imports work identically.

### 3.1 ERP document generation (the invoice pattern)

The pattern an ERP uses for invoices, quotations, statements, contracts:
**one `.it` template per document type + JSON data per record → merge → print or
PDF**. The merged, sealed `.it` source is the record you store; the PDF is a view.

**Client-side (zero dependencies — the user's browser makes the PDF):**

```js
const { parseAndMerge, renderPrint } = require("@dotit/core");

const merged = parseAndMerge(templateSource, invoiceData, { missing: "blank" });
const html = renderPrint(merged, { theme: "corporate" });
// `html` is a complete print-ready HTML document: @page size/margins from the
// template's page: block, running header/footer with live page counters,
// multi-page tables.
```

```js
// Browser-only (not executable in Node — verified via @dotit/editor's print path):
// print through a hidden iframe → native print dialog → "Save as PDF".
function printHtml(html) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "100%";
  document.body.appendChild(iframe);
  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
  iframe.onload = () => iframe.contentWindow.print();
}
// If you embed @dotit/editor anyway, just call its exportDocumentPDF(source, theme).
```

**Server-side (real PDF bytes — email, archive, batch):**

```bash
npm i @dotit/core @dotit/pdf puppeteer     # puppeteer bundles Chromium, zero config
# or: npm i puppeteer-core                 # uses system Chrome — set CHROME_PATH
```

A complete Express handler — issue (merge → seal → PDF), archive the sealed
source, and a verify endpoint:

```js
const express = require("express");
const fs = require("fs");
const path = require("path");
const { issuePDF } = require("@dotit/pdf");
const { verifyDocument } = require("@dotit/core");

const app = express();
app.use(express.json());

const TEMPLATE = fs.readFileSync("templates/invoice.it", "utf8");
const ARCHIVE = path.join(__dirname, "archive");
fs.mkdirSync(ARCHIVE, { recursive: true });

app.post("/invoices/:number/issue", async (req, res) => {
  try {
    const { source, hash, at, pdf } = await issuePDF(TEMPLATE, req.body, {
      signer: "Acme Billing",        // recorded on the sign: line
      role: "Billing",
      theme: "corporate",
    });
    // Store the sealed .it source — THAT is the verifiable record. PDF is a view.
    fs.writeFileSync(path.join(ARCHIVE, `${req.params.number}.it`), source);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${req.params.number}.pdf"`,
      "X-Document-Hash": hash,
      "X-Issued-At": at,
    });
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.get("/invoices/:number/verify", (req, res) => {
  const file = path.join(ARCHIVE, `${req.params.number}.it`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: "not found" });
  const result = verifyDocument(fs.readFileSync(file, "utf8"));
  res.json({ intact: result.intact, frozen: result.frozen, signers: result.signers });
});

app.listen(4567);
```

`POST /invoices/INV-042/issue` with the invoice JSON returns `%PDF-` bytes with
the seal hash in a header; `GET /invoices/INV-042/verify` returns
`{"intact":true,"frozen":true,"signers":[…]}` — and `intact:false` the moment any
byte of the archived body changes.

**Batch runs** — Chrome launch costs ~1s, so reuse one instance for month-end
statement runs:

```js
const { createPdfRenderer } = require("@dotit/pdf");

const renderer = await createPdfRenderer({ theme: "corporate" });
for (const customer of customers) {
  const { source, pdf } = await renderer.issuePDF(TEMPLATE, customer, {
    signer: "Acme Billing",
  });
  // …store source, send pdf
}
await renderer.close();
```

**No Chrome in this process?** `issueDocument(template, data, { signer })` runs the
pure pipeline (merge → seal → print-HTML, no browser) and returns
`{ source, hash, at, html }` — feed `html` to your own renderer (e.g. a Gotenberg
sidecar). In containers, pass `launchArgs: ["--no-sandbox"]`.

**CLI equivalent** (great for testing templates):

```bash
dotit invoice.it --data invoice-data.json --print > invoice.html
dotit invoice.it --data invoice-data.json --pdf            # requires puppeteer
```

### 3.2 Company internal documentation

Treat a documentation tree as a typed corpus: every file declares what it is in
`meta:`, and the folder answers questions without a search service.

**Folder conventions** (shallow per-folder indexes mirror access boundaries):

```
company/
├── policies/      remote-work.it  expenses.it      .it-index
├── runbooks/      deploy.it       incident.it      .it-index
├── decisions/     2026-06-adr-12.it                .it-index
└── contracts/     acme-service.it nda-jadwal.it    .it-index
```

**`meta:` discipline** — first two lines of every file:

```intenttext
title: Expense Policy
meta: | type: policy | status: active | owner: Finance | review: 2026-12-01

section: Limits
text: Meals are reimbursed up to 150 QAR per day.
deadline: Annual review | date: 2026-12-01
```

`meta:` properties become document-level metadata (`doc.metadata.meta`) and are
captured per-file by the folder index, so `type`/`status`/`owner` are queryable
*about* documents, while typed blocks are queryable *inside* them. Note: `meta:`
lives in `doc.metadata`, not in `doc.blocks` — see Gotchas §6.

**Retrieval:**

```bash
dotit index ./company --recursive                      # build .it-index per folder
dotit query ./company --type deadline --format table   # every deadline, all docs
dotit query ./company --type contact --format csv > contacts.csv
dotit ask ./company "which policies are due for review this year?"   # needs ANTHROPIC_API_KEY
```

Indexes are caches — shallow, per-folder, self-healing on query; the `.it` files
remain the source of truth. Delete `.it-index` any time; it rebuilds.

**CI validation gate** — fail the build if any `.it` file in the repo is broken:

```js
#!/usr/bin/env node
// ci-validate.js — validate every .it file; exit 1 on errors.
const { parseIntentTextSafe, validateDocumentSemantic } = require("@dotit/core");
const fs = require("fs");
const path = require("path");

let failed = false;
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      if (name !== "node_modules" && name[0] !== ".") walk(p);
      continue;
    }
    if (!name.endsWith(".it")) continue;
    const { document, errors } = parseIntentTextSafe(fs.readFileSync(p, "utf8"));
    const semantic = validateDocumentSemantic(document);
    const issues = [
      ...errors.map((e) => ({ level: "error", msg: e.message ?? String(e) })),
      ...semantic.issues.map((i) => ({ level: i.type, msg: `${i.code}: ${i.message}` })),
    ];
    for (const i of issues) {
      console.log(`${i.level === "error" ? "ERR " : "warn"} ${p} — ${i.msg}`);
      if (i.level === "error") failed = true;
    }
  }
}
walk(process.argv[2] ?? ".");
process.exit(failed ? 1 : 0);
```

The semantic validator catches broken workflow references
(`STEP_REF_MISSING`, error), non-ISO dates (`DATE_NOT_ISO`, warning), missing
titles, and more. Or skip the script and use the published action:

```yaml
# .github/workflows/docs.yml
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: intenttext/intenttext-action@v1
        with:
          path: "company/**/*.it"
          strict: false          # true = warnings fail too
          verify: true           # also verify sealed files' hashes
```

### 3.3 Archive & compliance

The flow: **finalize → seal → store sealed source → verify on every read →
amend, never edit**.

```js
const { sealDocument, verifyDocument } = require("@dotit/core");

// 1. Seal on finalize.
const sealed = sealDocument(finalSource, {
  signer: "Fahad Al-Thani",
  role: "Managing Director",
});
// sealed = { success: true, hash: "sha256:…", at: "2026-06-12T…", source: "…" }
// Store sealed.source EXACTLY as returned — byte-for-byte. No trimming, no CRLF
// conversion, no re-serialization. The hash covers exact bytes.
db.contracts.update(id, { it_source: sealed.source, it_hash: sealed.hash });

// 2. Verify on read (and on a schedule).
const v = verifyDocument(db.contracts.get(id).it_source);
// v = { intact, frozen, hash, expectedHash, signers: [{ signer, role, at, valid,
//       signedCurrentVersion }] }
if (!v.intact) alertCompliance(id, v.expectedHash, v.hash);
```

**What the hash covers** (recap of §2.9): everything above `history:`, minus
`sign:`/`freeze:`/`amendment:` lines, LF-joined, trimmed, UTF-8, SHA-256. So:

- Appending `amendment:` lines or `history:`/`revision:` entries does **not**
  break the seal (verified: `intact` stays `true`).
- Changing one character of the body flips `intact` to `false`.
- Re-saving the file with CRLF line endings **breaks verification** — normalize
  to LF, or better, store the string returned by `sealDocument` untouched.

**Amendment workflow** — a sealed document evolves append-only:

```js
// Never edit above history: — append an amendment instead (after the freeze: line):
const amended = sealed.source.replace(
  /(freeze:[^\n]*)/,
  `$1\namendment: Late fee reduced | section: Scope | was: 2% late fee | now: 1.5% late fee | ref: Amendment #1 | by: Fahad Al-Thani | at: 2026-06-20`
);
console.log(verifyDocument(amended).intact);   // true — amendments are unhashed
```

Or interactively: `dotit amend contract.it --section "Scope" --was "2% late fee"
--now "1.5% late fee" --ref "Amendment #1" --by "Fahad Al-Thani"` (shows a preview
and asks for confirmation; requires the document to be sealed first).

**Audit trail** — `updateHistory(previousSource, currentSource, { by })` computes a
semantic diff between two saves and appends `revision:` entries below the
boundary; `dotit history file.it [--json|--by NAME|--section NAME]` reads the log.
The history section is never hashed, so the log can grow forever under a frozen
document. Track block-level changes across versions with
`diffDocuments(parsedBefore, parsedAfter)` → `{ added, removed, modified,
unchanged, summary }`.

**Retention bonus:** the archive stays queryable —
`dotit query ./archive --type sign` lists every signature across every sealed
document, with no database.

### 3.4 Embedding the editor in your app

`@dotit/editor` is a controlled React component over plain `.it` source — source
string in, edited source string out. Nothing editor-specific ever touches your data.

```bash
npm i @dotit/editor @dotit/core react react-dom    # peers: react >= 18
```

```tsx
import { useState } from "react";
import { IntentTextEditor, exportDocumentPDF } from "@dotit/editor";
import "@dotit/editor/style.css";

export function ContractEditor({ initial }: { initial: string }) {
  const [source, setSource] = useState(initial);
  return (
    <div style={{ height: "100vh" }}>  {/* editor fills its parent — give it height */}
      <IntentTextEditor
        value={source}
        onChange={setSource}
        theme="corporate"
        onTrustAction={(action) => {
          // "seal" | "sign" | "verify" — the editor only reports intent;
          // wire to core's sealDocument / verifyDocument + your own dialogs.
        }}
      />
      <button onClick={() => exportDocumentPDF(source, "corporate")}>PDF</button>
    </div>
  );
}
```

Key props: `value`/`onChange` (required, controlled), `theme` + `onThemeChange`,
`readOnly` (sealed documents lock automatically), `showRibbon`,
`showTrustBanner`, `onTrustAction`. Useful named exports:
`exportDocumentPDF(source, theme, printMode?)` (browser print dialog, WYSIWYG),
`exportDocumentHTML`, `builtinThemes()`, `printHtmlViaIframe(html)`,
`sourceToDoc`/`docToSource` (lossless TipTap bridge),
`extractTemplateVariables(source)`/`buildSampleSkeleton(vars)` (template
authoring), `extractTrustState(parsedDoc)`, `getPageGeometry(source)`.

- **SSR (Next.js etc.):** the editor is browser-only (it measures the DOM to
  paginate). Load with `dynamic(() => import("@dotit/editor").then(m => m.IntentTextEditor), { ssr: false })`
  and call `exportDocumentPDF` only in the browser.
- **Insert at caret** from your own variable picker:
  `window.dispatchEvent(new CustomEvent("it-insert-text", { detail: "{{customer.name}}" }))`.
- **Template mode:** `{{variables}}` render as chips; author templates in the
  editor, merge server-side with `parseAndMerge`.
- **Non-React apps:** mount a small React island around the component
  (`createRoot(el).render(<IntentTextEditor …/>)`) — the contract is just
  string-in/string-out, so Vue/Angular/server-rendered hosts wrap it in ~10 lines.
  One editor instance per page is the supported setup.

### 3.5 AI-agent integration

**Option A — MCP server** (agents get 12 native tools, no format knowledge needed):

```json
// claude_desktop_config.json (~/Library/Application Support/Claude/ on macOS)
{
  "mcpServers": {
    "intenttext": { "command": "npx", "args": ["@dotit/mcp"] }
  }
}
```

```bash
claude mcp add intenttext -- npx @dotit/mcp        # Claude Code
npx @dotit/mcp                                     # any stdio MCP client
intenttext-mcp-http                                # HTTP transport: POST /mcp, GET /health
```

A hosted instance runs at `https://intenttext-mcp.onrender.com` (Streamable HTTP).

The 12 tools:

| Tool | Does |
| --- | --- |
| `parse_intent_text` | `.it` source → typed JSON document (`safe: true` never throws) |
| `document_to_source` | JSON document → canonical `.it` source |
| `validate_document` | Semantic validation: broken refs, non-ISO dates, workflow logic |
| `query_document` | Filter blocks by type/content/section/limit |
| `render_html` | Source → styled HTML |
| `render_print` | Source → print-optimized HTML (for PDF) |
| `merge_template` | Template + data object → merged source (optionally rendered) |
| `diff_documents` | Semantic diff between two versions (added/removed/modified blocks) |
| `seal_document` | Seal: compute hash, append `sign:` + `freeze:` |
| `verify_document` | Recompute hash, report tamper status |
| `get_document_history` | Read the `history:` audit log |
| `extract_workflow` | Execution graph from `step:`/`decision:`/`gate:` documents |

**Option B — no tooling: teach the model the format directly.** Put these two
URLs in the agent's context (or system prompt):

- `https://dotit.uts.qa/llms.txt` — the complete format reference (an LLM that has
  read it authors valid documents, templates, and workflows immediately)
- `https://dotit.uts.qa/integration.md` — this file, for the APIs around the format

**The bookkeeping-agent pattern** (folder-as-database, agent as the parser):
receipts/invoices arrive as images or PDFs → a vision model extracts the data →
the agent emits one `.it` file per document into a watched folder → the folder is
now the ledger:

```intenttext
// expenses/2026-06-receipt-0142.it — authored by the agent
title: Receipt — IKEA Doha
meta: | type: expense | category: furniture | source-file: receipt-0142.jpg
expense: Office chairs x2 | vendor: IKEA | amount: 1,098 QAR | date: 2026-06-09
task: Match to PO | owner: Finance | due: 2026-06-30
```

`expense:` is not a built-in keyword — it parses as a typed `custom` block, fully
queryable. Month-end is then just:
`dotit query ./expenses --type expense --format csv` (verified: custom keyword
blocks parse with the keyword preserved at `block.properties.keyword`). Agents
should run the merged output through `validate_document` (or
`validateDocumentSemantic`) before committing files.

### 3.6 Search & reporting without a database

**Inside one document:**

```js
const { parseIntentText, queryBlocks, queryDocument } = require("@dotit/core");

const doc = parseIntentText(fs.readFileSync("sprint.it", "utf8"));

// String query — clauses use = != < > <= >= :contains :startsWith, plus
// sort:field:asc|desc, limit:N, offset:N. NOTE: property filters use "=",
// not ":" (type:task silently matches nothing — see Gotchas §6).
const r = queryBlocks(doc, "type=task owner=Ahmed sort:due:asc limit:5");
// r = { blocks: [...], total, matched }
const overdue = queryBlocks(doc, "type=task due<2026-07-01 sort:due:asc");

// Or the simple object form:
const urgent = queryDocument(doc, { type: "task", properties: { priority: "high" } });
```

**Across a folder tree (CLI):**

```bash
dotit query ./contracts --type deadline                 # table (default)
dotit query ./contracts --type sign --format json
dotit query "docs/**/*.it" --type task --format csv
dotit index ./company --recursive                       # prebuild indexes (optional —
                                                        # queries self-heal stale indexes)
```

**Across folders (programmatic)** — the same engine the CLI uses:

```js
const {
  parseIntentText, buildShallowIndex, composeIndexes, queryComposed, formatCSV,
} = require("@dotit/core");
const fs = require("fs");
const path = require("path");

function indexFolder(folder) {
  const files = {};
  for (const name of fs.readdirSync(folder).filter((f) => f.endsWith(".it"))) {
    const p = path.join(folder, name);
    const source = fs.readFileSync(p, "utf8");
    files[name] = {
      source,
      doc: parseIntentText(source),
      modifiedAt: fs.statSync(p).mtime.toISOString(),
    };
  }
  return buildShallowIndex(folder, files, "1.3.0");
}

const composed = composeIndexes(
  [indexFolder("contracts"), indexFolder("finance")],
  "company",
);
const deadlines = queryComposed(composed, { type: "deadline" });
// [{ file: "contracts/service.it",
//    block: { type, content, section?, properties } }, …]
console.log(formatCSV(deadlines));     // also: formatTable, formatJSON
```

`queryComposed` filters: `{ type, content, by, status, section }`. Each file's
`meta:` fields land in `index.files[name].metadata` for document-level filtering
(`type: invoice`, `status: Unpaid`, …). Natural-language layer:
`dotit ask ./folder "question"` / `askDocuments(results, question)` — these call
an LLM and require `ANTHROPIC_API_KEY`; everything else in this section is local
and deterministic.

---

## 4. CLI reference

`npm i -g @dotit/core` installs `dotit` (v1.3.0). One line each — all verified:

```bash
dotit file.it                          # parse → JSON to stdout
dotit file.it --html [--theme NAME]    # render styled HTML
dotit file.it --print                  # print-ready HTML (browser → PDF)
dotit file.it --output                 # save HTML next to source
dotit notes.md --to-it                 # Markdown → .it  (also: file.html --to-it)
dotit tpl.it --data d.json             # merge → JSON
dotit tpl.it --data d.json --html      # merge → HTML
dotit tpl.it --data d.json --print     # merge → print HTML
dotit tpl.it --data d.json --pdf       # merge → PDF (requires puppeteer installed)
dotit file.it --query "type=task due<2026-07-01 sort:due:asc limit:10"
dotit file.it --validate project       # schemas: project meeting article checklist agentic
dotit query DIR --type task            # folder query (--format table|json|csv)
dotit query "docs/*.it" --type sign    # glob query
dotit index DIR [--recursive]          # build .it-index (per-folder, shallow)
dotit ask DIR "question" [--format json]   # LLM answer over the corpus (needs ANTHROPIC_API_KEY)
dotit theme list                       # corporate minimal warm technical print legal editorial dark
dotit theme info NAME                  # theme metadata
dotit seal FILE --signer "Name" [--role "Role"]
dotit verify FILE                      # exit 0 intact · exit 1 modified (CI-friendly)
dotit history FILE [--json] [--by NAME] [--section NAME]
dotit amend FILE --section S --was X --now Y --ref "Amendment #1" [--by NAME]   # interactive confirm
```

The trust walkthrough in 10 lines:

```bash
dotit seal contract.it --signer "Fahad Al-Thani" --role "Managing Director"
# ✅ Document sealed   Hash: sha256:c80e46eb…   (sign: + freeze: appended in place)
dotit verify contract.it                  # ✅ Document intact (exit 0)
sed -i '' 's/99.9%/95%/' contract.it      # someone edits the sealed body…
dotit verify contract.it                  # ❌ modified — Expected vs Current hash (exit 1)
git checkout contract.it                  # restore
dotit amend contract.it --section "Scope" --was "2% late fee" \
  --now "1.5% late fee" --ref "Amendment #1" --by "Fahad Al-Thani"
dotit verify contract.it                  # ✅ still intact — amendments are unhashed
dotit query ./archive --type sign         # every signature across the archive
```

---

## 5. API quick reference

### @dotit/core (the ones you'll actually use)

| Function | Signature | One-liner |
| --- | --- | --- |
| `parseIntentText` | `(source, options?) → IntentDocument` | Source → `{ version, metadata, blocks }`; throws only on hard limits |
| `parseIntentTextSafe` | `(source, options?) → { document, warnings, errors }` | Never throws — use for untrusted input |
| `documentToSource` | `(doc) → string` | Canonical serializer; aliases re-emitted as written |
| `blockToSource` | `(block) → string` | One block → one line |
| `renderHTML` | `(doc, { theme? }) → string` | **HTML fragment** (`<div class="intent-document">…`) for embedding |
| `renderPrint` | `(doc, { theme? }) → string` | **Complete HTML document** with @page, running header/footer, page counters |
| `parseAndMerge` | `(source, data, { missing? }) → IntentDocument` | Template merge; `missing: "blank"` for finished docs |
| `mergeData` | `(doc, data, options?) → IntentDocument` | Merge an already-parsed template |
| `queryBlocks` | `(doc, string \| QueryOptions) → { blocks, total, matched }` | `"type=task due<2026-07-01 sort:due:asc limit:5"` |
| `queryDocument` | `(doc, { type?, content?, properties? }) → IntentBlock[]` | Simple object-filter form |
| `sealDocument` | `(source, { signer, role? }) → { success, hash, at, source }` | Compute hash, append `sign:` + `freeze:` |
| `verifyDocument` | `(source) → { intact, frozen, hash, expectedHash, signers }` | Recompute + compare |
| `computeDocumentHash` | `(source) → "sha256:…"` | The raw canonical hash (see §2.9) |
| `validateDocumentSemantic` | `(doc) → { valid, issues }` | `STEP_REF_MISSING` (error), `DATE_NOT_ISO` (warning), … |
| `validateDocument` | `(doc, schemaName \| schema) → ValidationResult` | Named schemas: project, meeting, article, checklist, agentic |
| `diffDocuments` | `(before, after) → { added, removed, modified, unchanged, summary }` | Semantic diff |
| `updateHistory` | `(prevSource, currSource, { by }) → string` | Append `revision:` audit entries |
| `buildShallowIndex` | `(folder, { [file]: { source, doc, modifiedAt } }, coreVersion) → ItIndex` | One folder → one index |
| `composeIndexes` / `queryComposed` | `(indexes, root) → results` / `(results, filters) → results` | Cross-folder query |
| `formatTable` / `formatJSON` / `formatCSV` | `(results) → string` | Output formatting |
| `convertMarkdownToIntentText` / `convertHtmlToIntentText` | `(string) → string` | Importers |
| `extractWorkflow` / `executeWorkflow` | `(doc) → graph` / `(doc, runtime) → result` | Agent-workflow tier |
| `listBuiltinThemes` / `getBuiltinTheme` / `generateThemeCSS` | — | Theme registry |
| Constants | `CANONICAL_KEYWORDS` (38), `KEYWORD_TIERS`, `ALIAS_MAP`, `LANGUAGE_REGISTRY`, `PREDEFINED_SCHEMAS` | The keyword contract, programmatically |

### @dotit/pdf

| Function | Signature | One-liner |
| --- | --- | --- |
| `issuePDF` | `(template, data, { signer, role?, theme?, missing?, executablePath?, launchArgs?, pdf? }) → Promise<{ source, hash, at, html, pdf }>` | merge → seal → PDF bytes; store `source`, send `pdf` |
| `issueDocument` | `(template, data, IssueOptions) → { source, hash, at, html }` | Same minus Chrome — feed `html` to your own renderer |
| `renderPDF` | `(source, options?) → Promise<Buffer>` | Finished `.it` → PDF (no merge/seal) |
| `htmlToPDF` | `(html, options?) → Promise<Buffer>` | Any HTML → PDF |
| `createPdfRenderer` | `(options?) → Promise<{ renderPDF, htmlToPDF, issuePDF, close }>` | One Chrome for batch runs |

Chrome resolution: `puppeteer` if installed (bundled Chromium, zero config) →
`puppeteer-core` + `options.executablePath` → `$PUPPETEER_EXECUTABLE_PATH` →
`$CHROME_PATH` → common install locations.

### @dotit/editor

| Export | One-liner |
| --- | --- |
| `IntentTextEditor` | Controlled component: `value`, `onChange`, `theme`, `onThemeChange`, `readOnly`, `showRibbon`, `showTrustBanner`, `onTrustAction` |
| `exportDocumentPDF(source, theme, printMode?)` | Browser print dialog (WYSIWYG); `printMode: "normal" \| "minimal-ink"` |
| `exportDocumentHTML(source, theme, printMode?)` | Download print-ready HTML |
| `builtinThemes()` | Theme ids for a picker |
| `printHtmlViaIframe(html)` | Low-level iframe print |
| `sourceToDoc` / `docToSource` | Lossless `.it` ↔ TipTap-JSON bridge |
| `extractTemplateVariables` / `buildSampleSkeleton` | `{{var}}` template helpers |
| `extractTrustState(parsedDoc)` | Tracked/approved/signed/sealed snapshot |
| `getPageGeometry(source)` / `resolvePageTokens(text, page, pages)` | Page setup from `page:`/`header:`/`footer:` |

Import `"@dotit/editor/style.css"` once. Browser-only — see §3.4 for SSR.

### @dotit/mcp

Binaries: `intenttext-mcp` (stdio), `intenttext-mcp-http` (Streamable HTTP on
`PORT`/`HOST`, endpoints `POST /mcp`, `GET /health`). The 12 tools are tabled in
§3.5. Hosted: `https://intenttext-mcp.onrender.com`.

---

## 6. Gotchas — read before shipping

1. **Query strings filter with `=`, not `:`.** `queryBlocks(doc, "type=task")`
   works; `"type:task"` is silently ignored (returns every block). Operators:
   `=` `!=` `<` `>` `<=` `>=` `:contains=` `:startsWith=` plus `sort:field:dir`,
   `limit:N`, `offset:N`.
2. **Escaping:** only ` | ` (space-pipe-space) splits properties; `a|b` is
   literal. Write a literal ` | ` as `\|`, a literal backslash as `\\`. The
   serializer re-escapes, so round-trips are a fixpoint.
3. **CRLF breaks seals.** The hash covers exact bytes, LF-joined. A sealed file
   re-saved with CRLF (Windows editors, `git config core.autocrlf true`) fails
   verification. Store the string `sealDocument` returns, untouched; add
   `*.it text eol=lf` to `.gitattributes`.
4. **`meta:` does not survive `documentToSource`.** `meta:` lines are extracted
   into `doc.metadata` and are not blocks, so parse → serialize drops them. This
   also means `issueDocument`/`issuePDF` (which serialize the merged template
   before sealing) drop the template's `meta:` line from the sealed artifact. If
   you need document-level metadata in sealed output, carry it on a visible block
   or re-prepend the `meta:` line before sealing with raw-source `sealDocument`.
5. **Consecutive `text:` lines merge** into one paragraph, and the merged lines'
   pipe properties are dropped. Separate paragraphs with blank lines. Typed
   blocks (`task:`, `metric:`, …) never merge.
6. **`renderHTML` returns a fragment** (`<div class="intent-document">…`) for
   embedding in your page; `renderPrint` returns the complete standalone HTML
   document. Don't iframe-print `renderHTML` output.
7. **Puppeteer is optional and lazy.** `@dotit/pdf` imports cleanly with no
   Chrome anywhere; you only need `puppeteer` (or `puppeteer-core` + a Chrome
   binary) when you call `issuePDF`/`renderPDF`/`htmlToPDF`. `issueDocument` never
   needs it. In Docker: `launchArgs: ["--no-sandbox"]`.
8. **The editor is browser-only** (it measures the DOM to paginate). SSR
   frameworks must load it with `ssr: false`; `exportDocumentPDF` only in the
   browser. One editor instance per page.
9. **Bidi: never reorder mixed-language values.** Rendered values (table cells,
   dates, amounts, owners) get `dir="auto"` isolation automatically. Write
   `10,200 QAR` and `2026-06-20` normally inside Arabic lines; force document
   direction with `meta: | dir: rtl` only when auto-detection isn't what you want.
10. **Prose that starts with `word:` becomes a custom block.** `total: 50` as
    body text needs `text: total: 50`. Conversely, that's the extensibility
    mechanism — custom keywords are typed and queryable (keyword preserved at
    `block.properties.keyword`).
11. **`dotit ask` / `askDocuments` call an LLM** and require `ANTHROPIC_API_KEY`.
    Everything else (parse, query, index, seal, verify, render) is local and
    deterministic.
12. **`dotit amend` is interactive** (preview + confirm prompt) and requires the
    document to already be sealed. For unattended pipelines, append the
    `amendment:` line programmatically after the `freeze:` line (§3.3).
13. **Dates are ISO or the query engine can't compare them.** `due<2026-07-01`
    works because values sort lexicographically; `09/03/2026` doesn't. The
    validator warns (`DATE_NOT_ISO`).
14. **Sealing is tamper-evidence, not identity.** The seal proves *what* the
    content was, not *who* sealed it. Pair with your own authn/authz and, if
    legally required, detached PKI signatures over the sealed bytes (§2.9).

---

*Generated from the IntentText monorepo at `@dotit/core` 1.3.0 — every runnable
claim executed against the built packages. Corrections: open an issue at
https://github.com/intenttext/IntentText/issues.*
