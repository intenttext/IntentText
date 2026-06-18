<p align="center">
  <img src="icon.png" alt="IntentText icon" width="96" />
</p>

<h1 align="center">IntentText (.it)</h1>

<p align="center">
  A structured document language where every line is a declared intent.<br>
  Human-writable &nbsp;·&nbsp; Machine-queryable &nbsp;·&nbsp; Print-ready &nbsp;·&nbsp; Cryptographically sealable.
</p>

<p align="center">
  <a href="https://dotit.uts.qa">Docs</a> ·
  <a href="https://hub.dotit.uts.qa">Hub</a> ·
  <a href="https://editor.uts.qa">Editor</a> ·
  <a href="https://npmjs.com/package/@dotit/core">npm</a> ·
  <a href="https://pypi.org/project/intenttext/">PyPI</a> ·
  <a href="https://x.com/IntentText">Twitter</a>
</p>

---

## What is IntentText?

Every document you write is either prose or data. Prose is for reading; data is for
machines. A `.it` file is both. Every line carries a keyword that declares its
meaning — a `task:` is always a task, a `deadline:` is always a deadline, a `sign:`
is always a signature — so any tool can query, validate, render, and act on your
documents without guessing at free-form text.

```intenttext
title: Service Agreement — Acme Gulf Trading
meta: | ref: CON-2026-014 | status: active

section: Scope
text: Managed hosting, 99.9% uptime SLA, monthly reporting.
deadline: First invoice due | date: 2026-07-01 | consequence: 2% late fee

section: Parties
contact: Acme Gulf Trading WLL | email: ops@acmegulf.qa | role: Client

approve: Legal review complete | by: Sara Haddad | role: Counsel | at: 2026-06-01
```

That file is readable as-is by any person. To a machine, every line is a typed
block — the `deadline:` line parses to:

```json
{
  "type": "deadline",
  "content": "First invoice due",
  "properties": { "date": "2026-07-01", "consequence": "2% late fee" }
}
```

…which means a folder of these files answers questions like *"every deadline before
October, across all contracts"* with one command — no database, no export step.

## Why

One `.it` file is simultaneously four things:

- **A human-readable text file.** Plain UTF-8, diffable, greppable, versionable in
  git. No binary format, no lock-in — the file is yours.
- **A queryable database.** Every line is typed data. Filter by type, owner,
  status, or ISO date range across a whole folder tree (`dotit query`), or ask in
  natural language (`dotit ask`).
- **A print-ready document.** `page:`, `header:`, `footer:`, `watermark:`, themes,
  and templates render to print HTML with running page numbers and multi-page
  tables — browser print dialog or server-side PDF (`@dotit/pdf`).
- **A cryptographically sealable record.** `seal` computes a SHA-256 hash over the
  document's *content* (presentation is excluded — restyling never breaks a seal)
  and freezes it; `verify` detects any later edit. Tamper-evidence anyone can
  recompute — no vendor required.

And it is **Arabic-native**: the registry ships 33 Arabic keyword aliases
(`عنوان`→title, `مهمة`→task, `توقيع`→sign, …), any Arabic content flips the
document to RTL automatically (tables, totals, and print footers mirror via CSS
logical properties), and aliases round-trip **as written** — an Arabic document
stays Arabic through every parse/serialize cycle, so sealed Arabic documents keep
their hash. One query (`--type task`) finds tasks across languages.

> **Integrating dotit into your software?** → [INTEGRATION.md](INTEGRATION.md) — the complete developer / AI-agent guide: format crash course, ERP & archive recipes, all packages, CLI and API reference (also served at [dotit.uts.qa/integration.md](https://dotit.uts.qa/integration.md)).

## Quick start

### CLI

```bash
npm install -g @dotit/core     # installs the `dotit` command
```

```bash
dotit contract.it                          # parse → JSON
dotit contract.it --html --theme corporate # render HTML
dotit contract.it --print                  # print-ready HTML (PDF via browser)
dotit notes.md --to-it                     # convert Markdown to .it
dotit query ./contracts --type deadline    # query a folder like a database
dotit seal contract.it --signer "Fahad Al-Thani" --role "Managing Director"
dotit verify contract.it                   # tamper check (exit 1 if modified)
```

Full walkthrough: [CLI guide](https://dotit.uts.qa/docs/ecosystem/cli).

### Library

```bash
npm install @dotit/core        # zero dependencies
```

```js
const { parseIntentText, queryDocument, renderHTML } = require("@dotit/core");

const doc = parseIntentText(`title: Sprint Planning
task: Ship auth | owner: Ahmed | priority: high | due: 2026-06-20
task: Write docs | owner: Sara | priority: medium | due: 2026-06-25
done: Deploy staging | time: 2026-06-01`);

const urgent = queryDocument(doc, { type: "task", properties: { priority: "high" } });
// [{ type: "task", content: "Ship auth", properties: { owner: "Ahmed", … } }]

const html = renderHTML(doc, { theme: "corporate" });
```

### Server-side PDFs

```bash
npm install @dotit/pdf         # opt-in companion (core stays zero-dep)
```

```js
const { issuePDF } = require("@dotit/pdf");

const { source, hash, pdf } = await issuePDF(template, invoiceData, {
  signer: "Acme Billing",
});
// store `source` (the sealed .it — the verifiable record), email/archive `pdf`
```

### For AI agents

```bash
npm install -g @dotit/mcp      # MCP server: parse, query, render, seal, verify
```

```json
{ "mcpServers": { "intenttext": { "command": "intenttext-mcp" } } }
```

Or skip tooling entirely: point any LLM at
[`dotit.uts.qa/llms.txt`](https://dotit.uts.qa/llms.txt) — a complete
machine reference that teaches the format in one read. An agent that has read it
can author valid documents, templates, and workflows immediately.

## Feature tour

### Templates + merge

A template is a normal `.it` file with `{{placeholders}}`. Repeating table rows
use `each:` on the header row. Merge with a JSON object and render:

```intenttext
title: Invoice {{invoice.number}}
summary: {{company.name}} → {{customer.name}}

section: Line Items
| Description | Qty | Unit Price | Total | each: items |
| {{item.description}} | {{item.qty}} | {{item.unitPrice}} | {{item.total}} |

section: Totals
metric: Subtotal | value: {{totals.subtotal}}
metric: Total Due | value: {{totals.due}}
```

```js
const { parseAndMerge, renderPrint } = require("@dotit/core");
const html = renderPrint(parseAndMerge(template, data, { missing: "blank" }));
// → @page size/margins, running header/footer, page counters, multi-page tables
```

Or from the CLI: `dotit invoice-template.it --data invoice-data.json --print`.

### Tables and two-sided rows

```intenttext
| Item | Qty | Price |
| Office chairs | 12 | 250 QAR |

text: Customer Name | end: 2026-06-12
```

Pipe rows form tables (first row is the header). The `end:` property renders a
two-sided row — content at the line start, value at the line end — the classic
invoice "label left, date right" pattern. Built on flex start/end, so it flips
automatically in RTL documents.

### Styling without CSS

Three layers, all constrained style keys — never arbitrary CSS, so content stays
queryable:

```intenttext
style: section | color: #0a7466 | weight: 600
style: text | leading: 1.8

title: Quarterly Report
text: Revenue grew [18%]{ color: #0a7466; weight: bold } over Q1.
text: Wide spacing paragraph. | space-after: 24px
```

1. **Themes** — `meta: | theme: corporate` (8 built-in).
2. **`style:` rules** — house styling per block type, declared once, document-wide.
3. **Per-line props and `[text]{ key: value; key: value }` spans** for exceptions
   (`;`-separated inside spans; `|` is the line-level delimiter). `leading:`,
   `space-before:`, and `space-after:` give Word-parity paragraph spacing.

### Print

```intenttext
page: | size: A4 | margin: 20mm
header: ACME Corp — Confidential
footer: Page {{page}} of {{pages}}
watermark: DRAFT | opacity: 0.1
```

`{{page}}`/`{{pages}}` compile to real CSS page counters in print. Narrow pages
work too — `page: | size: 80mm auto | margin: 4mm` prints a POS receipt roll.

### Trust: seal, verify, amend

```bash
dotit seal contract.it --signer "Fahad Al-Thani" --role "Managing Director"
# ✅  Document sealed
#     Hash:     sha256:53cdd027b9a246d6…

dotit verify contract.it
# ✅  Document intact — or ❌ + exit code 1 if any byte of the body changed

dotit amend contract.it --section "Scope" --was "2% late fee" \
  --now "1.5% late fee" --ref "Amendment #1" --by "Fahad Al-Thani"
```

`seal` computes a SHA-256 hash over the document's **content** and appends `sign:` +
`freeze:` lines carrying it. The hash is **versioned** (every seal stamps `spec: 3`,
verified against that recorded version forever) and excludes presentation — `page:`,
`font:`, `style:`, and per-line style props — so restyling never breaks a seal
("sign content, not presentation"). Any content edit, signature swap, or seal-metadata
change flips the hash and `verify` reports it; a tampered document renders a red
**SEAL BROKEN** stamp instead of a clean seal. Amendments are append-only and excluded
from the hash, so a frozen contract can evolve without breaking its seal. This is honest
**tamper-evidence, not PKI** — proving *who* signed is a layer above the hash (see
[INTEGRATION.md](INTEGRATION.md)). The exact model is documented in the
[CLI guide](https://dotit.uts.qa/docs/ecosystem/cli) and
[SPEC §4](packages/core/SPEC.md).

### Query: a folder is a database

```bash
dotit query ./contracts --type deadline --format table
dotit query ./contracts --type contact --format csv > contacts.csv
dotit contract.it --query "type=deadline date<2026-09-30 sort:date:asc"
dotit ask ./contracts "Which contracts renew before December?"
```

Each folder gets a shallow `.it-index` cache that self-heals on query — the `.it`
files stay the source of truth. Dates are ISO 8601, so range queries work out of
the box. Full story:
[A Folder Is a Database](https://dotit.uts.qa/docs/guide/folder-as-database).

### Arabic, natively

```intenttext
عنوان: عرض سعر — تأثيث المكتب الرئيسي
قسم: البنود
أعمدة: الصنف | الكمية | السعر
صف: كراسي مكتب | 12 | 250 QAR
صف: طاولات اجتماعات | 3 | 1,800 QAR
مهمة: اعتماد العرض | owner: أحمد | due: 2026-06-20
مهلة: انتهاء صلاحية العرض | date: 2026-07-15
```

`عنوان` *is* `title`, `مهمة` *is* `task`, `مهلة` *is* `deadline` — full canonical
semantics, automatic RTL rendering, and byte-stable round-trips (the serializer
re-emits the keyword the author wrote). Custom Arabic keywords and property keys
work too: `مصروف: كراسي | فئة: أثاث` is a typed, queryable block.

### Forms, review & compliance (closes the PDF/Word gap)

`.it` now does what businesses still keep Word/PDF for — all on the same queryable,
sealable format:

- **Forms** — `meta: type: form` + `input:` fields: design, send, fill, and a
  **complete** form becomes a signable record. Conditional (`show-if:`), computed
  (`compute:`), tables, and **attachments** (a file travels inside the doc, covered by
  the seal). **Two-party trust**: the author seals the blank form's structure; the
  filler signs the answers.
- **Redline & compare** — Word track-changes + comments; `compareVersions(a, b)` diffs
  two versions into an accept/reject redline.
- **Redaction** — legally *remove* content with a tamper-evident, provable marker.
- **Legal signatures & archival** — export a sealed `.it` as a **PAdES** PDF Adobe and
  courts recognize (`@dotit/pades`), or **PDF/A** for archives (`@dotit/pdf`, veraPDF-gated).
- **Math** — `math: E = mc^2` → MathML/KaTeX via `@dotit/math`.

Embed it all in your app with one component — see **[INTEGRATION.md](INTEGRATION.md)**.

## Monorepo map

| Path | Package | What it is |
| --- | --- | --- |
| `packages/core` | [`@dotit/core`](https://npmjs.com/package/@dotit/core) `1.21` | The format: parser, renderers, query, trust (versioned SEAL_SPEC 3), **forms, redline/compare, redaction, attachments, math markers**, themes, CLI. Zero dependencies. |
| `packages/editor` | [`@dotit/editor`](https://npmjs.com/package/@dotit/editor) `1.15` | Embeddable React editor — **all modes in one `<IntentTextWorkbench>`**, ribbon, trust banner, form builder, document/form/template flow, version history, attachment fill, version-compare. |
| `packages/pdf` | [`@dotit/pdf`](https://npmjs.com/package/@dotit/pdf) `1.2` | Server-side PDFs — merge → seal → PDF; **PDF/A archival**; PAdES-signed PDF. Opt-in. |
| `packages/pades` | [`@dotit/pades`](https://npmjs.com/package/@dotit/pades) `1.0` | **PAdES** (Adobe/court-recognized) PDF signatures — X.509/ECDSA + CMS; CSR/CA issuance; timestamps. |
| `packages/sign` | [`@dotit/sign`](https://npmjs.com/package/@dotit/sign) `1.4` | Ed25519 signatures + UTS certification chain. Offline, self-verifying. |
| `packages/math` | [`@dotit/math`](https://npmjs.com/package/@dotit/math) `0.1` | Math rendering — dependency-free lite MathML + optional KaTeX. |
| `packages/mcp` | [`@dotit/mcp`](https://npmjs.com/package/@dotit/mcp) `1.1` | MCP server — AI agents read, write, query, and seal `.it` documents. |
| `packages/vscode` | — | VS Code extension: highlighting, snippets, diagnostics. |
| `apps/editor` | — | Web editor: WYSIWYG pages, live preview, themes, trust chips. |
| `apps/desktop` | — | Electron desktop app (Word-grade reader/editor; PAdES export). |
| `apps/docs` | — | The docs site ([dotit.uts.qa](https://dotit.uts.qa)). |

Experimental (no stability promise): Hub, Desktop, Builder, and the Python client
(`intenttext` on PyPI — a thin wrapper over the core CLI). The TypeScript core is
the single canonical implementation of the grammar (see
[ARCHITECTURE.md](ARCHITECTURE.md)).

## Learn more

- **Docs** — guide, reference, cookbook: [dotit.uts.qa](https://dotit.uts.qa)
- **Spec** — the canonical grammar: [packages/core/SPEC.md](packages/core/SPEC.md)
- **Changelog** — [CHANGELOG.md](CHANGELOG.md)
- **For LLMs** — [dotit.uts.qa/llms.txt](https://dotit.uts.qa/llms.txt)

## Status

`@dotit/core` is **1.x** (rebranded from `@intenttext/core` 4.3.x — same code, same
format, same team). The grammar is stable: documents that parsed under 3.x parse
identically today, and unknown keywords never error. The test suite is 897 tests
including a fuzz/property suite (random structured documents, byte soup, and
pathological inputs — the full parse → render → seal → verify pipeline must never
throw), and an enterprise-hardening track is ongoing (recent releases fixed a
parser DoS, stored-XSS in style values, and escape round-trip corruption). It runs
in production as the embedded print/report engine of an ERP.

## License

MIT
