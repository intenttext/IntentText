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

Every document is either **prose** (for people) or **data** (for machines). You normally
pick one and lose the other — a beautiful PDF a database can't read, or a JSON blob no one
wants to. A `.it` file is **both at once**. Every line is *typed* — a `task:` is always a
task, a `sign:` is always a signature, an `invoice` line is always an invoice line (and a
line you just write plainly is prose) — so any tool can read, query, validate, render, and
*act on* your documents without guessing at free-form text.

```intenttext
// it-format: 1.0
title: Service Agreement — Acme Gulf Trading
meta: | ref: CON-2026-014 | status: active

section: Scope
text: Managed hosting, 99.9% uptime SLA, monthly reporting.
deadline: First invoice due | date: 2026-07-01 | consequence: 2% late fee

contact: Acme Gulf Trading WLL | email: ops@acmegulf.qa | role: Client
approve: Legal review complete | by: Sara Haddad | role: Counsel | at: 2026-06-01
```

A person reads that at a glance. A machine sees typed blocks — the `deadline:` line is:

```json
{ "type": "deadline", "content": "First invoice due",
  "properties": { "date": "2026-07-01", "consequence": "2% late fee" } }
```

…so a folder of these answers *"every deadline before October, across all contracts"* with
one command — **no database, no export step** — and that same file can be sealed with a
SHA-256 hash anyone can recompute to prove it hasn't changed.

**The format is small and open:** 13 everyday core keywords (41 reserved in total across
opt-in profiles), and **any other word is a valid keyword too** — `expense:`, `risk:`,
`مصروف:` all parse as typed, queryable blocks. With **zero synonym aliases**, any word that
isn't reserved is reliably *yours* — `party:`, `milestone:`, `note:`, `status:` are never
silently reinterpreted. You never outgrow it.

---

## Where `.it` shines — pick your lens

<table>
<tr><td width="50%" valign="top">

### 🏢 Enterprise
**Invoices · contracts · quotations · receipts · finance reports.**
One template → merge data → render print/PDF → **seal** → export **EN 16931 / UBL**
e-invoice. The sealed `.it` is the verifiable record; the PDF is just a view.

```intenttext
headers: Item | Qty | Unit | Total
row: Hosting | 12 | 900 | 10800
metric: Total Due | value: 10800 | unit: QAR
sign: Acme Billing | at: 2026-07-01T09:00:00Z
freeze: | hash: sha256:… | spec: 4 | status: locked
```

</td><td width="50%" valign="top">

### 🤖 AI agents
**Memory · workflows · skills · tool manifests.**
Agents read/write `.it` as structured, queryable, **hash-chained** state — and run
in-file approval workflows. Point any LLM at `llms.txt`, or drive it over **MCP**.

```intenttext
trigger: invoice received
step: extract line items | tool: ocr
decision: total > 100000 | if: amount > 100000
route: sequential
require: finance | when: amount > 100000
```

</td></tr>
<tr><td width="50%" valign="top">

### 👤 Humans & teams
**Notes · plans · READMEs · reports · meeting minutes.**
As easy to write as Markdown — but every line is typed, so your notes become a
**queryable, print-ready** record. RTL & Arabic are native.

```intenttext
title: Sprint Planning
task: Ship auth | owner: Ahmed | priority: high | due: 2026-06-20
done: Deploy staging | at: 2026-06-01
ask: Do we need SSO for launch?
```

</td><td width="50%" valign="top">

### 🏛️ Government & archives
**Official records · long-term archives · archive conversion.**
Plain UTF-8 / NFC / LF, **version-stamped** and **offline-verifiable for decades** —
no vendor, no runtime. Convert PDF/Word/Excel archives *into* `.it`.

```intenttext
// it-format: 1.0
meta: | type: record | retention: 2046-01-01
certify: National Archives | at: 2026-06-01T00:00:00Z
freeze: | hash: sha256:… | spec: 4 | status: locked
```

</td></tr>
</table>

…and it also shines anywhere a document needs to be **both readable and computable**:
fillable forms, redline review, audit trails, dashboards, definitions/glossaries, and
cross-document reference graphs — all in the *same* format, so nothing is ever locked in a
silo. See the persona guides: [for organizations](https://dotit.uts.qa/docs/guide/for-organizations) ·
[for agents](https://dotit.uts.qa/docs/guide/for-agents) ·
[for writers](https://dotit.uts.qa/docs/guide/for-writers).

---

## Why one file can do all that

A single `.it` file is simultaneously **five** things:

- **A human-readable text file.** Plain UTF-8, diffable, greppable, git-versionable. No
  binary format, no lock-in — the file is yours.
- **A queryable database.** Every line is typed data. Filter by type, owner, status, or ISO
  date range across a whole folder tree (`dotit query`), or ask in natural language (`dotit ask`).
- **A print-ready document.** `page:`/`header:`/`footer:`/`watermark:`, themes, and templates
  render to print HTML with running page numbers and multi-page tables — or server-side PDF.
- **A cryptographically sealable record.** `seal` hashes the *content* (presentation is
  excluded, so restyling never breaks a seal) and freezes it; `verify` detects any later edit.
  Tamper-evidence anyone can recompute — no vendor required.
- **An open vocabulary.** Reserved keywords give you semantics out of the box; **any unknown
  word stays a typed, queryable `custom` block** — so domain vocabularies (`مصروف:`, `risk:`,
  `skill:`) are first-class without bloating the format.

And it is **Arabic-native**: 33 Arabic (localized) keyword names (`عنوان`→title, `مهمة`→task,
`توقيع`→sign, …), automatic RTL, and keywords round-trip **as written** — a sealed Arabic
document keeps its hash, and one query (`--type task`) finds tasks across languages.

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

`@dotit/core` is **1.x** and the format is **frozen** at this line: **13 core / 41 reserved
keywords**, `SEAL_SPEC = 4`, with CI gates that fail the build on any keyword-count or
SEAL_SPEC drift, any registry↔grammar mismatch, a round-trip/byte-preservation regression, or a
sealed example whose seal no longer verifies. Documents that parsed under earlier versions parse
identically today, and unknown keywords never error. The core suite is **1,300+ tests** including
a fuzz/property byte-preservation gate. It runs in production as the embedded print/report engine
of an ERP.

## License

MIT
