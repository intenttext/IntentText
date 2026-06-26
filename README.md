<p align="center">
  <img src="icon.png" alt="IntentText icon" width="96" />
</p>

<h1 align="center">IntentText (.it)</h1>

<p align="center">
  <b>A document format where the document itself is the structured data.</b><br>
  Write it like a note. Search it like a spreadsheet. Lock it like a contract. Hand it to an AI.
</p>

<p align="center">
  <a href="https://dotit.uts.qa">Docs</a> ·
  <a href="https://hub.dotit.uts.qa">Hub</a> ·
  <a href="https://editor.uts.qa">Editor</a> ·
  <a href="https://npmjs.com/package/@dotit/core">npm</a> ·
  <a href="https://dotit.uts.qa/llms.txt">llms.txt</a> ·
  <a href="https://dotit.uts.qa/llms.it">llms.it</a> ·
  <a href="https://x.com/IntentText">Twitter</a>
</p>

---

<div align="center">

| Format | People can read it | Computers can use it | Tamper-proof |
|---|:---:|:---:|:---:|
| Word | ✅ | ❌ | ❌ |
| PDF | ✅ | ❌ | ⚠️ |
| JSON / YAML | ❌ | ✅ | ❌ |
| Markdown | ✅ | ⚠️ | ❌ |
| **IntentText (.it)** | ✅ | ✅ | ✅ |

</div>

<p align="center">
  <b>Free &amp; open source (MIT)</b> — an open, documented, frozen format, not a proprietary trap.
  Already running in production as the engine inside a commercial ERP.<br>
  <b>Not a developer?</b> Try it free in your browser, nothing to install → <a href="https://editor.uts.qa"><b>editor.uts.qa</b></a>
</p>

---

## What is IntentText?

A signed contract and the database row that tracks it describe the same agreement — yet they're
two separate things someone has to keep in sync. Same with an invoice PDF and its accounting
record, a report and its dashboard. **IntentText collapses each pair into a single file:** readable
like a document, searchable like a database, with no second copy to drift.

The trick is that **every line declares what it is** — a `task:` is a task, a `deadline:` is a
deadline, an `invoice:` line is an invoice line. You write it as easily as jotting a note; software
can then search it, check it, turn it into a branded PDF, and **stamp it with a tamper-proof
fingerprint anyone can verify — no internet, no special software — forever.**

```intenttext
title: Service Agreement — Acme Gulf Trading
meta: | ref: CON-2026-014 | status: active

section: Scope
Managed hosting, 99.9% uptime, monthly reporting.
deadline: First invoice due | date: 2026-07-01 | consequence: 2% late fee
sign: Sara Haddad | role: Counsel | at: 2026-06-01
```

A colleague reads that at a glance. To software, the `deadline:` line isn't a sentence — it's
structured information it can sort, filter, and total automatically (here's the same line, *as a
computer sees it*):

```json
{ "type": "deadline", "content": "First invoice due",
  "properties": { "date": "2026-07-01", "consequence": "2% late fee" } }
```

So a folder of these answers *"every deadline before October, across every contract"* in **one
step, with no database.** And the file *remembers* — every approval, signature, and edit is added
to a tamper-proof history that lives **inside the document**, a real audit trail instead of a log
in some other system you have to trust.

That's the whole idea: **stop flattening documents into pictures and locking your information away
in systems only software can open.** Keep one honest file a person can read, software can use, and
anyone can verify — with no vendor standing between you and your own work. That's the last document
format you adopt.

## One file, every job

The same `.it` file — no conversion step, no second copy — is at once:

- **A document** people read — plain text that opens in any app, shows exactly what changed between
  versions, and reads naturally in Arabic and other right-to-left languages.
- **A database** you can search — every line is labelled information, so you can filter or total it
  across a whole folder, or simply ask a plain-English question.
- **A template** you fill from data — write it once with `{{placeholders}}`, then merge in a
  spreadsheet or database to generate invoices, contracts, or letters by the thousand.
- **A form** people fill in and sign — fields, drop-downs, logic that shows the right questions, and
  a signature; the answers come back as data, not a flat PDF.
- **A print-ready PDF** — branded themes, headers and footers, page numbers, multi-page tables, plus
  screen-reader-accessible and long-term-archival PDFs.
- **A sealed, self-auditing record** — tamper-proof and checkable by anyone offline, with a built-in,
  un-editable log of every approval, signature, and change.
- **A settings file** — a readable, commentable, even signable alternative to the configuration
  files software normally hides in (YAML/JSON).

It's just as natural for **AI assistants** — they can read, write, search, and verify these files
directly (over the emerging tool standard, MCP) and use them as dependable memory — and for
**governments and archives**: stamped with a version and checkable offline for decades, with your
existing PDF, Word, and Excel files converting *into* `.it`. And it's **Arabic-native**: keywords
work in Arabic, text flows right-to-left automatically, and a sealed Arabic document keeps its
fingerprint.

Prefer a visual editor? There's a **Word-like editor** your team can use to write, fill, review, and
sign — same files underneath, with live PDF preview. Try it free at
[editor.uts.qa](https://editor.uts.qa) — nothing to install.

See the guides: [for organizations](https://dotit.uts.qa/docs/guide/for-organizations) ·
[for agents](https://dotit.uts.qa/docs/guide/for-agents) ·
[for writers](https://dotit.uts.qa/docs/guide/for-writers).

## You're never boxed in — write the words your work already uses

Most formats hand you a rigid template and force you to bend your content to fit it.
**IntentText is the opposite.** Its 40 built-in keywords are a *floor, not a cage*: **any other word
you write is instantly valid, understood, and searchable.** Contracts get `clause:` and
`obligation:` lines, invoices get `invoice:` lines, a risk log gets `risk:` lines — you just write
them, in any language (`مصروف:` works exactly the same). **No reserved words against you. Nothing to
outgrow.**

That openness is also why **AI writes it perfectly.** Hand any model a single example file and it
produces correct `.it` with no setup — we tested four leading AI models cold, and they got it right
**38 times out of 39**, inventing exactly the right words for the job on their own.

## Retire the Word + PDF + DocuSign workflow

The everyday office stack — a Word template, a mail-merge, a PDF export, a signing service, and a
database to find anything afterwards — collapses into one file:

- **Template once, generate forever.** Write an invoice or contract template with `{{placeholders}}`,
  merge your data, and produce a branded, paginated **PDF** — identical every time.
- **Seal & sign like a contract.** A built-in tamper-proof fingerprint makes any change obvious, and
  **anyone can check it offline** — no vendor. When a counterparty needs one, export a **PDF with a
  legally-recognised digital signature** (the PAdES standard Adobe Reader and courts accept). The
  sealed `.it` is the record of truth; the PDF is just a view of it.
- **Redline & review.** Track changes and comments like Word — but every edit and comment is itself
  labelled data, easy to compare, and part of an un-editable history.
- **Find anything instantly.** Search a whole folder by party, due date, owner, or status — across
  thousands of files, **with no database**.
- **Export when you must.** It still converts to Word, Excel, Markdown, or a standards-compliant
  **e-invoice** (EN 16931, used across the EU) on demand — so nothing is ever locked in.

## Forms that come back as data

A `.it` file isn't only something you *generate* — it's something people can *fill in*. Mark a file
as a form, add fields, and it becomes a **fillable, signable** record:

- **Built in plain text** — fields for text, choice, dates, numbers, **signatures**, tables, and file
  attachments; questions can appear only when they're relevant, and totals add themselves up.
- **Trust on both sides.** The sender locks the questions; whoever fills it in locks their answers —
  so neither the questions nor the responses can be changed unnoticed.
- **Answers come back as data** — searchable, not a flat PDF you re-type by hand. One file replaces a
  Word form, a web form, *and* the e-signature step.

## Easy enough to learn in a minute

If you can write a shopping list, you already know the syntax: **`label: value`, one thing per
line.** Plain sentences need no label at all. There's nothing to install to read it, no brackets to
balance, no build step — it's just text you can open anywhere, today. **You don't need to be a
developer to *use* `.it` — only to build it into software.**

```intenttext
title: Sprint Planning
Ship the auth work before the public demo.
task: Ship auth | owner: Ahmed | due: 2026-06-20
done: Deploy staging
risk: SSO not ready for launch | severity: high
```

---

> **Building dotit into your software?** → **[INTEGRATION.md](INTEGRATION.md)** — the complete
> developer / AI-agent guide: format crash course, ERP & archive recipes, every package, full
> CLI and API reference (also at [dotit.uts.qa/integration.md](https://dotit.uts.qa/integration.md)).

---

## For developers

Everything below is for building `.it` *into software*. If you only want to write documents, you're
already done — [open the editor](https://editor.uts.qa) and start typing.

### Quick start — CLI

```bash
npm install -g @dotit/core     # installs the `dotit` command
```

```bash
dotit contract.it                          # parse → JSON
dotit contract.it --html --theme corporate # render HTML
dotit contract.it --print                  # print-ready HTML (PDF via browser)
dotit notes.md --to-it                     # import Markdown/HTML → .it
dotit convert report.it report.md          # export .it → Markdown (also → .docx/.xlsx)
dotit query ./contracts --type deadline    # query a folder like a database
dotit seal contract.it --signer "Fahad Al-Thani" --role "Managing Director"
dotit verify contract.it                   # tamper check (exit 1 if modified)
```

### Library — `npm install @dotit/core` (zero dependencies)

```js
const { parseIntentText, queryDocument, renderHTML, checkConformance } = require("@dotit/core");

const doc = parseIntentText(`title: Sprint Planning
task: Ship auth | owner: Ahmed | priority: high | due: 2026-06-20
task: Write docs | owner: Sara | priority: medium | due: 2026-06-25
done: Deploy staging | at: 2026-06-01`);

queryDocument(doc, { type: "task", properties: { priority: "high" } });
// [{ type: "task", content: "Ship auth", properties: { owner: "Ahmed", … } }]

renderHTML(doc, { theme: "corporate" });
checkConformance(doc, { level: "strict" }); // { conformant, errors, warnings, issues }
```

### Server-side PDFs — `npm install @dotit/pdf`

```js
const { issuePDF } = require("@dotit/pdf");
const { source, hash, pdf } = await issuePDF(template, invoiceData, { signer: "Acme Billing" });
// store `source` (the sealed .it — the verifiable record), email/archive `pdf`
```

### For AI agents — `npm install -g @dotit/mcp`

```json
{ "mcpServers": { "intenttext": { "command": "intenttext-mcp" } } }
```

Or skip tooling entirely: point any LLM at
[`dotit.uts.qa/llms.txt`](https://dotit.uts.qa/llms.txt) — a complete machine reference that
teaches the whole format in one read. An agent that has read it can author valid documents,
templates, and workflows immediately.

---

## Feature tour

### Templates + merge
A template is a normal `.it` file with `{{placeholders}}`; repeating table rows use `each:`.

```intenttext
title: Invoice {{invoice.number}}
headers: Description | Qty | Unit Price | Total | each: items
row: {{item.description}} | {{item.qty}} | {{item.unitPrice}} | {{item.total}}
metric: Total Due | value: {{totals.due}} | unit: QAR
```

```js
const { parseAndMerge, renderPrint } = require("@dotit/core");
renderPrint(parseAndMerge(template, data, { missing: "blank" }));
// → @page size/margins, running header/footer, page counters, multi-page tables
```

### Money & typed values
`value:` holds the bare number; `unit:` the currency (ISO-4217 code) or unit — the arithmetic-friendly
form the e-invoice export consumes. Read it typed (no string-parsing):

```js
const { metricTypedValue } = require("@dotit/core");
metricTypedValue(block); // { number: 10800, currency: "QAR", kind: "money" }
```

### Styling without CSS
Three layers of **constrained** style keys (never arbitrary CSS, so content stays queryable):
**themes** (`meta: | theme: corporate`, 8 built-in), document-wide **`style:` rules**, and
per-line props / `[text]{ key: value; … }` spans.

### Authoring extras
`def:` glossary terms · `figure:` numbered, captioned figures · `ref:` cross-document references ·
`toc:` an auto-built table of contents · plus inline **mentions**, **tags**, and **footnotes**.

### Print
```intenttext
page: | size: A4 | margin: 20mm
header: ACME Corp — Confidential
footer: Page {{page}} of {{pages}}
watermark: DRAFT | opacity: 0.1
```
`{{page}}`/`{{pages}}` compile to real CSS page counters. `page: | size: 80mm auto` prints a POS receipt roll.

### Trust: seal, verify, amend, certify
```bash
dotit seal contract.it --signer "Fahad Al-Thani" --role "Managing Director"
dotit verify contract.it     # ✅ intact, or ❌ + exit 1 if any content byte changed
```
`seal` hashes the document's **content** and appends `sign:`+`freeze:` carrying it. The hash is
**versioned** (`spec: 4`, verified against the recorded version forever) and **excludes
presentation** — restyling never breaks a seal ("sign content, not presentation"). A separate
`appearance:` hash flags a post-seal restyle that *hides* content, and the hash is CRLF/whitespace-stable.
`amendment:` records changes to a frozen doc without breaking its seal; `certify:` is an authority
claim verified above the hash with the issuer's key. This is honest **tamper-evidence, not PKI** —
the full model is in [SPEC §4](SPEC.md).

### Forms, review & compliance (closes the PDF/Word gap)
- **Forms** — `meta: type: form` + `input:` fields (conditional `show-if:`, computed `compute:`,
  **attachments** that travel inside the doc and are covered by the seal). **Two-party trust**: the
  author seals the blank form; the filler signs the answers.
- **Approval workflows** — a document carries its own routing: `route:` + `require:` declare who must
  approve; `workflowState()` derives `{ pending, next, complete }` live from the file (no database),
  and the renderer draws an approval-route panel. Executable agent flows use `step:`/`decision:`/`gate:`.
- **Redline & compare** — `compareVersions(a, b)` diffs two versions into an accept/reject redline; track-changes + comments.
- **Co-authoring** — `mergeThreeWay` merges two people's independent edits and surfaces conflicts (async collaboration, no live server needed).
- **Redaction** — legally *remove* content, leaving a tamper-evident, provable marker.
- **Legal signatures & archival** — export a sealed `.it` as a **PAdES** PDF (`@dotit/pades`) or a
  **PDF/A-oriented** archival PDF (`@dotit/pdf`). **Math** — `math: E = mc^2` → MathML/KaTeX (`@dotit/math`).

### Query: a folder is a database
```bash
dotit query ./contracts --type deadline --format table
dotit contract.it --query "type=deadline date<2026-09-30 sort:date:asc"
dotit ask ./contracts "Which contracts renew before December?"
```
A shallow `.it-index` cache per folder self-heals on query — the `.it` files stay the source of truth.

### Conformance
```js
checkConformance(source, { level: "strict" }); // strict = no errors AND no warnings (e.g. ISO dates)
```
A read-only yes/no a producer can gate on. Unknown keywords are **not** errors — open vocabulary is conformant by design.

### Arabic, natively
```intenttext
عنوان: عرض سعر — تأثيث المكتب الرئيسي
أعمدة: الصنف | الكمية | السعر
صف: كراسي مكتب | 12 | 250 QAR
مهمة: اعتماد العرض | owner: أحمد | due: 2026-06-20
```
`عنوان` *is* `title`, `مهمة` *is* `task` — full canonical semantics, automatic RTL, byte-stable round-trips.

---

## Monorepo map

| Package | Version | What it is |
| --- | --- | --- |
| [`@dotit/core`](https://npmjs.com/package/@dotit/core) | **3.0** | The format: parser, renderers (HTML + print/PDF), query, template merge, trust (SEAL_SPEC 4), conformance, typed values, **forms, redline/compare, redaction, attachments, math markers, EN 16931/UBL e-invoice export**, converters, themes, CLI. **Zero dependencies.** |
| [`@dotit/editor`](https://npmjs.com/package/@dotit/editor) | **3.0** | Embeddable React editor — all modes in one `<IntentTextWorkbench>`, ribbon, trust banner, form builder, version history, attachments, version-compare. |
| [`@dotit/pdf`](https://npmjs.com/package/@dotit/pdf) | **3.0** | Server-side PDFs — merge → seal → PDF; PDF/A-oriented archival; PAdES-signed PDF. Opt-in. |
| [`@dotit/pades`](https://npmjs.com/package/@dotit/pades) | **1.0** | **PAdES** (Adobe/court-recognized) PDF signatures — X.509/ECDSA + CMS; CSR/CA issuance; timestamps. |
| [`@dotit/sign`](https://npmjs.com/package/@dotit/sign) | **3.0** | Ed25519 signatures + UTS certification chain. Offline, self-verifying. |
| [`@dotit/math`](https://npmjs.com/package/@dotit/math) | **0.1** | Math rendering — dependency-free MathML + optional KaTeX. |
| [`@dotit/mcp`](https://npmjs.com/package/@dotit/mcp) | **3.0** | MCP server — agents read, write, query, and seal `.it`. |
| `packages/vscode` | **3.0** | VS Code extension: highlighting, snippets, diagnostics, hovers, completion. |
| `apps/` | — | Web editor, Electron desktop app, docs site, verify portal, hub. |

The TypeScript core is the single canonical implementation of the grammar (see
[ARCHITECTURE.md](ARCHITECTURE.md)).

## Learn more

- **Docs** — guide, reference, cookbook: [dotit.uts.qa](https://dotit.uts.qa)
- **Spec** — the canonical grammar: [SPEC.md](SPEC.md)
- **Recommended keywords** — best-practice conventions for the open vocabulary (non-binding):
  [RECOMMENDED-KEYWORDS.md](RECOMMENDED-KEYWORDS.md)
- **For LLMs** — [dotit.uts.qa/llms.txt](https://dotit.uts.qa/llms.txt) · [llms.it](https://dotit.uts.qa/llms.it) (the same reference, written in `.it`)
- **Changelog** — [CHANGELOG.md](CHANGELOG.md)

## Status — production-ready

> Running in production as the embedded print/report engine of an ERP. **1,600+ tests** including
> fuzz/property byte-preservation gates. Format **frozen** at `SEAL_SPEC 4` · 13 core / 40 reserved keywords.

`@dotit/core` is **3.x** and the format is **frozen going forward**: **13 core / 40 reserved
keywords**, `SEAL_SPEC = 4`, with CI gates that fail the build on any keyword-count or
SEAL_SPEC drift, any registry↔grammar mismatch, a round-trip/byte-preservation regression, or a
sealed example whose seal no longer verifies. Unknown keywords never error — open vocabulary is
conformant by design. The core suite is **1,600+ tests** including a fuzz/property
byte-preservation gate.

## License

MIT — free and open source. Use it commercially, fork it, build on it; the format is yours.
