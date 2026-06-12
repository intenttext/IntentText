<p align="center">
  <img src="icon.png" alt="IntentText icon" width="96" />
</p>

<h1 align="center">IntentText (.it)</h1>

<p align="center">
  A structured document language where every line is a declared intent.<br>
  Human-writable &nbsp;·&nbsp; Machine-queryable &nbsp;·&nbsp; Agent-executable.
</p>

<p align="center">
  <a href="https://itdocs.vercel.app">Docs</a> ·
  <a href="https://intenttext-hub.vercel.app">Hub</a> ·
  <a href="https://iteditor.vercel.app">Editor</a> ·
  <a href="https://npmjs.com/package/@intenttext/core">npm</a> ·
  <a href="https://pypi.org/project/intenttext/">PyPI</a> ·
  <a href="https://x.com/IntentText">Twitter</a>
</p>

---

Every document you write is either prose or data. Prose is for reading. Data is for
machines. `.it` is both. Every line carries a keyword that declares its meaning — a
`task:` is always a task, a `sign:` is always a signature, a `deadline:` is always a
deadline. Any tool can query, validate, and act on your documents without parsing
free-form text.

Word documents are dead. They exist to be printed and forgotten. `.it` files are
alive — they can be queried like a database, signed like a contract, executed by AI
agents, and still read as plain text by any person.

---

## The Format

One line. One keyword. One intent.

**A contract** — readable by people, queryable by systems, signed and frozen:

```
title: Service Agreement
summary: Consulting services Q2 2026
meta: | client: Acme Corp | ref: CONTRACT-2026-042

section: Scope
text: Monthly consulting retainer — April through June 2026
deadline: First payment | date: 2026-04-30 | consequence: Late fee applies

section: Parties
contact: Ahmed Al-Rashid | role: CEO | email: ahmed@acme.com
contact: James Miller    | role: COO | email: j.miller@client.co

def: Force Majeure | meaning: Events beyond the reasonable control of either party

approve: Reviewed by legal | by: Sarah Chen | role: Legal Counsel
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-06T14:32:00Z
freeze: | status: locked
```

**Meeting notes** — tasks are tasks, decisions are decisions, every item is typed:

```
title: Sprint Planning — March 2026
meta: | date: 2026-03-01 | facilitator: Sarah | attendees: Ahmed, Mike, Lisa

section: Last Sprint
done: OAuth flow shipped | time: 2026-02-28
done: Docs site launched | time: 2026-02-25
text: Velocity: 23 of 25 story points (92%)

section: Next Sprint
decision: Prioritise performance over features for Q2 | by: Ahmed
task: Index builder | owner: Ahmed | priority: high | due: 2026-03-08
task: Theme system  | owner: Sarah | priority: high | due: 2026-03-08
task: Trust audit   | owner: Mike  | priority: medium
```

**An AI agent workflow** — tool calls, checkpoints, outputs — all in plain text:

```
title: Customer Onboarding Agent
summary: Automated onboarding pipeline for new enterprise accounts

section: Steps
step: Validate account application | tool: validate-form | input: application.json
step: Enrich with CRM data | tool: crm-lookup | input: email
checkpoint: Human review required | condition: risk_score > 0.7
step: Provision workspace | tool: provision | parallel: false
step: Send welcome email | tool: mailer | template: enterprise-welcome
result: Onboarding complete | status: success | output: account_id
```

**Custom domain data** — any keyword not in the spec passes through as `type: "custom"`:

```
title: Equipment Inventory

section: Workstations
computer: MacBook Pro | owner: Ahmed  | os: Sonoma    | ram: 64GB
computer: Dell XPS    | owner: Sarah  | os: Windows11 | ram: 32GB

section: Servers
server: web-prod-01 | ip: 10.0.1.10 | region: eu-west-1 | status: healthy
server: db-prod-01  | ip: 10.0.1.20 | region: eu-west-1 | status: healthy
```

---

## Parse and Query

```ts
import { parseIntentText, queryBlocks } from "@intenttext/core";

const doc = parseIntentText(`
title: Sprint Planning
task: Ship auth | owner: Ahmed | priority: high
task: Write docs | owner: Sarah | priority: medium
done: Deploy staging | time: 2026-03-01
`);

const openTasks = queryBlocks(doc.blocks, { type: "task" });
// [{ type: "task", content: "Ship auth", properties: { owner: "Ahmed", priority: "high" } }, ...]
```

---

## The Trust System

> You own the format. The user owns the file.
> The CLI is what gives the file trust — not what gives it existence.
>
> A `.it` file without the CLI is still a document.
> A `.it` file with the CLI is a document with a verifiable history
> and a trustworthy audit trail.

`approve:` → `sign:` → `freeze:` locks a document. The CLI verifies the chain. Any
edit after `freeze:` is detectable.

---

## Print, Templates & PDF — the report engine

`.it` doubles as a **print/report engine** for apps (ERP invoices, receipts,
statements) — one template, merged with a data row, printed with no PDF library:

```ts
import { parseAndMerge, renderPrint } from "@intenttext/core";

const html = renderPrint(parseAndMerge(template, invoiceData, { missing: "blank" }));
// → print-ready HTML: @page size/margins, running header/footer with page
//   numbers, multi-page tables. Browser print dialog → PDF. Zero dependencies.
```

House styling is declared once per document with **`style:` rules** (constrained
style keys — never arbitrary CSS, so content stays queryable):

```
style: section | color: #0a7 | weight: 600
style: title   | family: Georgia | size: 26pt
```

For **server-side PDFs** (email attachments, compliance archiving, batch runs)
add the opt-in companion — merge → **seal** (tamper-evident SHA-256) → PDF bytes:

```ts
import { issuePDF } from "@intenttext/pdf";

const { source, hash, pdf } = await issuePDF(template, invoiceData, {
  signer: "Acme Billing",
});
// store `source` (the sealed .it — the verifiable legal artifact), email `pdf`
```

Full integration guide: **ecosystem → ERP / App Integration** in the docs.

---

## Install

```bash
npm install @intenttext/core      # the format: parse, render, merge, query, trust
npm install @intenttext/pdf       # optional: server-side PDFs (issue → seal → PDF)
```

```bash
pip install intenttext
```

---

## Ecosystem

The TypeScript core is the single canonical implementation of the format (see
[ARCHITECTURE.md](ARCHITECTURE.md) and the [spec](packages/core/SPEC.md)).

**Supported**

| Package               | Description                                                           |
| --------------------- | --------------------------------------------------------------------- |
| **@intenttext/core**  | TypeScript parser, renderer, query engine, and CLI — the format       |
| **@intenttext/pdf**   | Server-side PDFs — issue (merge → seal) → real PDF bytes, opt-in      |
| **intenttext-mcp**    | MCP server — AI agents and LLM clients read and write `.it`           |
| **intenttext-vscode** | VS Code extension — syntax highlighting, snippets, diagnostics        |
| **Editor**            | Web editor with live preview, WYSIWYG print, and theme picker         |

**Experimental** — build against the core but carry no stability/support promise:
Hub (registry), Desktop (Tauri), Docs site, Builder, and the Python client
(`intenttext` on PyPI — a thin wrapper over the core CLI).

---

## Docs

Full guide, reference, cookbook, and spec at [itdocs.vercel.app](https://itdocs.vercel.app).

---

## License

MIT
