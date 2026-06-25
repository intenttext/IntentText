<p align="center">
  <img src="icon.png" alt="IntentText icon" width="96" />
</p>

<h1 align="center">IntentText (.it)</h1>

<p align="center">
  <b>One plain-text file that is readable by people, queryable by machines, print-ready, and cryptographically sealable.</b><br>
  Write it like Markdown. Query it like a database. Seal it like a contract. Hand it to an AI.
</p>

<p align="center">
  <a href="https://dotit.uts.qa">Docs</a> ·
  <a href="https://hub.dotit.uts.qa">Hub</a> ·
  <a href="https://editor.uts.qa">Editor</a> ·
  <a href="https://npmjs.com/package/@dotit/core">npm</a> ·
  <a href="https://dotit.uts.qa/llms.txt">llms.txt</a> ·
  <a href="https://x.com/IntentText">Twitter</a>
</p>

---

## What is IntentText?

Every business runs on documents — invoices, contracts, reports, forms — and each one is
**stuck on one side of a wall.** As a Word file or PDF it looks right to a person but is
opaque to software. As a database row or JSON it's perfect for software but unreadable to
people. For decades you've had to pick a side and lose the other.

**A `.it` file lives on both sides at once.** It reads like something you'd type by hand, yet
every line is *typed data* — so the file a colleague reads is also a database a machine can
query, a document you can print, and a record you can cryptographically seal. One file. No
conversions, no second copy drifting out of date.

```intenttext
title: Service Agreement — Acme Gulf Trading
meta: | ref: CON-2026-014 | status: active

section: Scope
Managed hosting, 99.9% uptime, monthly reporting.
deadline: First invoice due | date: 2026-07-01 | consequence: 2% late fee
sign: Sara Haddad | role: Counsel | at: 2026-06-01
```

A colleague reads that at a glance. Software sees clean, typed data — the `deadline:` line *is*:

```json
{ "type": "deadline", "content": "First invoice due",
  "properties": { "date": "2026-07-01", "consequence": "2% late fee" } }
```

So a folder of these answers *"every deadline before October, across all our contracts"* with
**one command and no database**, and the file can be **sealed** so anyone can prove it hasn't
been touched. The document *is* the system of record.

## You're never boxed in — write the words your work already uses

Most formats hand you a rigid schema and force you to bend your content to fit it.
**IntentText is the opposite.** Its 40 built-in keywords are a *floor, not a cage*: **any
other word you write is instantly valid, typed, and queryable.** Contracts get `clause:` and
`obligation:` lines, invoices get `invoice:` lines, a risk log gets `risk:` lines — you just
write them, in any language (`مصروف:` works exactly the same). Nothing is ever reserved
against you, and you never outgrow the format.

That openness is also why **AI writes it perfectly.** Hand any model a single reference file
and it produces correct `.it` with no fine-tuning and no SDK — we tested four frontier LLMs
cold, and they got it right **38 times out of 39**, inventing exactly the right domain words
on their own.

## Retire the Word + PDF + DocuSign pipeline

The everyday enterprise stack — a Word template, mail-merge, a PDF export, a signing service,
and a database to find anything afterwards — collapses into one file:

- **Template once, generate forever.** Write an invoice or contract template with
  `{{placeholders}}`, merge your data, and render a branded, paginated **PDF** — identical every time.
- **Seal & sign like a contract.** A built-in SHA-256 seal makes it tamper-evident and
  **offline-verifiable** — no vendor — and you can export a **court-recognized PAdES-signed PDF**
  when a counterparty needs one. The sealed `.it` is the record of truth; the PDF is just a view.
- **Redline & review.** Track changes and threaded comments like Word — but every edit and comment
  is itself typed, diffable, and part of a tamper-evident history.
- **Query a folder like a database.** Filter contracts by party, invoices by due date, tasks by
  owner — across thousands of files, **with no backend**.
- **Export when you must.** It still converts to Word, Excel, Markdown, or an EN-16931 e-invoice
  on demand — so nothing is ever locked in.

## Forms that come back as data

A `.it` file isn't only something you *generate* — it's something people can *fill in*. Mark a
file as a form, add `input:` fields, and it becomes a **fillable, signable** record:

- **Built in plain text** — fields for text, choice, number, date, **signature**, tables, and
  file attachments; `show-if:` reveals a field only when it's relevant, and `compute:` totals
  things up automatically (a safe evaluator — never `eval`).
- **Two-party trust, built in** — you seal the blank form's *structure*; whoever fills it seals
  their *answers* — so neither the questions nor the responses can be altered undetected.
- **Answers come back as structured data** — queryable, not a flat PDF you re-key by hand. One
  file replaces a Word form, a web form, *and* the e-signature step.

## Easy enough to learn in a minute

If you can write a shopping list, you already know the syntax: **`label: value`, one thing per
line.** Plain sentences need no label at all. There's nothing to install to read it, no brackets
to balance, no build step — it's just text you can open anywhere, today.

```intenttext
title: Sprint Planning
Ship the auth work before the public demo.
task: Ship auth | owner: Ahmed | due: 2026-06-20
done: Deploy staging
risk: SSO not ready for launch | severity: high
```

---

## One file, five jobs

At the same time, with no conversion step, every `.it` file is:

- **A document** people read — plain UTF-8, diffable, git-friendly, **RTL & Arabic native**.
- **A database** you query — every line is typed data, filterable across a whole folder
  (`dotit query`), or asked in plain language (`dotit ask`).
- **A print-ready page** — themes, headers/footers, running page numbers, multi-page tables →
  print HTML or server-side **PDF**.
- **A sealed record** — a content hash makes it tamper-evident and offline-verifiable; restyling
  never breaks the seal, no vendor required.
- **An open vocabulary** — your domain's own words are first-class, never bolted on.

It's just as natural for **AI agents** — queryable, hash-chained memory and in-file approval
workflows, drivable over **MCP** — and for **government archives**: version-stamped and
offline-verifiable for decades, with PDF/Word/Excel archives converting *into* `.it`. And it's
**Arabic-native**: 32 localized keyword names, automatic RTL, and a sealed Arabic document keeps
its hash.

Prefer a visual editor? Drop the **`<IntentTextWorkbench>`** React component into any app for a
Word-like **edit / fill / review / sign** experience — same engine, same files, WYSIWYG PDF.

See the guides: [for organizations](https://dotit.uts.qa/docs/guide/for-organizations) ·
[for agents](https://dotit.uts.qa/docs/guide/for-agents) ·
[for writers](https://dotit.uts.qa/docs/guide/for-writers).

> **Building dotit into your software?** → **[INTEGRATION.md](INTEGRATION.md)** — the complete
> developer / AI-agent guide: format crash course, ERP & archive recipes, every package, full
> CLI and API reference (also at [dotit.uts.qa/integration.md](https://dotit.uts.qa/integration.md)).

---

## Quick start

### CLI

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
`value:` holds the bare number; `unit:` the currency (ISO-4217) or unit — the arithmetic-friendly
form the e-invoice export consumes. Read it typed (no string-parsing):

```js
const { metricTypedValue } = require("@dotit/core");
metricTypedValue(block); // { number: 10800, currency: "QAR", kind: "money" }
```

### Styling without CSS
Three layers of **constrained** style keys (never arbitrary CSS, so content stays queryable):
**themes** (`meta: | theme: corporate`, 8 built-in), document-wide **`style:` rules**, and
per-line props / `[text]{ key: value; … }` spans.

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
| [`@dotit/core`](https://npmjs.com/package/@dotit/core) | **2.0** | The format: parser, renderers (HTML + print/PDF), query, template merge, trust (SEAL_SPEC 4), conformance, typed values, **forms, redline/compare, redaction, attachments, math markers, EN 16931/UBL e-invoice export**, converters, themes, CLI. **Zero dependencies.** |
| [`@dotit/editor`](https://npmjs.com/package/@dotit/editor) | **2.0** | Embeddable React editor — all modes in one `<IntentTextWorkbench>`, ribbon, trust banner, form builder, version history, attachments, version-compare. |
| [`@dotit/pdf`](https://npmjs.com/package/@dotit/pdf) | **2.0** | Server-side PDFs — merge → seal → PDF; PDF/A-oriented archival; PAdES-signed PDF. Opt-in. |
| [`@dotit/pades`](https://npmjs.com/package/@dotit/pades) | **1.0** | **PAdES** (Adobe/court-recognized) PDF signatures — X.509/ECDSA + CMS; CSR/CA issuance; timestamps. |
| [`@dotit/sign`](https://npmjs.com/package/@dotit/sign) | **2.0** | Ed25519 signatures + UTS certification chain. Offline, self-verifying. |
| [`@dotit/math`](https://npmjs.com/package/@dotit/math) | **0.1** | Math rendering — dependency-free MathML + optional KaTeX. |
| [`@dotit/mcp`](https://npmjs.com/package/@dotit/mcp) | **2.0** | MCP server — agents read, write, query, and seal `.it`. |
| `packages/vscode` | **2.0** | VS Code extension: highlighting, snippets, diagnostics, hovers, completion. |
| `apps/` | — | Web editor, Electron desktop app, docs site, verify portal, hub. |

The TypeScript core is the single canonical implementation of the grammar (see
[ARCHITECTURE.md](ARCHITECTURE.md)).

## Learn more

- **Docs** — guide, reference, cookbook: [dotit.uts.qa](https://dotit.uts.qa)
- **Spec** — the canonical grammar: [SPEC.md](SPEC.md)
- **Recommended keywords** — best-practice conventions for the open vocabulary (non-binding):
  [RECOMMENDED-KEYWORDS.md](RECOMMENDED-KEYWORDS.md)
- **For LLMs** — [dotit.uts.qa/llms.txt](https://dotit.uts.qa/llms.txt)
- **Changelog** — [CHANGELOG.md](CHANGELOG.md)

## Status

`@dotit/core` is **1.x** and the format is **frozen** at this line: **13 core / 40 reserved
keywords**, `SEAL_SPEC = 4`, with CI gates that fail the build on any keyword-count or
SEAL_SPEC drift, any registry↔grammar mismatch, a round-trip/byte-preservation regression, or a
sealed example whose seal no longer verifies. Documents that parsed under earlier versions parse
identically today, and unknown keywords never error. The core suite is **1,300+ tests** including
a fuzz/property byte-preservation gate. It runs in production as the embedded print/report engine
of an ERP.

## License

MIT
