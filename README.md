<p align="center">
  <img src="docs/icon.png" alt="IntentText icon" width="96" />
</p>

<h1 align="center">IntentText (.it)</h1>

<p align="center"><strong>The first document format that is natively JSON.</strong></p>

<p align="center">
  Human-writable. Semantically typed. Machine-executable. Open source.
</p>

<p align="center">
  <a href="https://toit-psi.vercel.app/">Try the Editor</a> ·
  <a href="docs/SPEC.md">Specification</a> ·
  <a href="docs/TEMPLATES.md">Templates</a> ·
  <a href="https://www.npmjs.com/package/@intenttext/core">npm</a>
</p>

---

## The Problem With Every Document Format

Every document format ever built falls into one of two categories — and neither is good enough.

**Presentation formats** — Word, Google Docs, RTF, Pages. These store how things _look_. A heading is just bigger text. A task is just a paragraph with a checkbox. A quote is just indented text. There is no machine-readable difference between any of them. When you export a Word document to JSON, you get a layout tree — padding, font sizes, colours — not a document with meaning. You cannot query "give me all tasks assigned to Ahmed" from a Word file. You cannot run a workflow defined in Google Docs. The document is a picture of content, not content itself.

**Data formats** — JSON, YAML, XML, databases. These store what things _mean_. Every field is typed, queryable, and structured. But nobody writes a book in JSON. Nobody drafts a contract in YAML. These formats are for machines, not for the humans who need to write and read the documents in the first place.

**The gap between these two has never been filled.** Until now.

---

## What IntentText Is

IntentText is a plain-text document format where every line has a declared semantic type. A `task:` is a task. A `step:` is an executable workflow step. A `quote:` is an attributed quote. A `byline:` is an author attribution. Every block parses to a guaranteed, typed JSON object — making the document simultaneously readable by humans and queryable by machines, with no conversion, no interpretation, no guessing.

```
title: Q2 Product Launch Plan
summary: Coordinating the June release across three teams.

section: Open Actions
task: Finalize pricing page      | owner: Sarah  | due: Friday   | priority: 1
task: Record demo video          | owner: Ahmed  | due: Monday
done: Legal review complete      | time: Tuesday

section: Key Decision
ask: Do we ship the API publicly in June or wait for v2?
quote: Ship it. We can iterate. | by: Ahmed

section: Deployment
step: Run smoke tests            | tool: ci.test    | output: testResult
gate: Final go/no-go             | approver: CEO    | timeout: 24h
step: Deploy to production       | tool: k8s.deploy | depends: step-1
handoff: Notify customer success | from: eng-team   | to: cs-agent
```

A journalist can write this. A developer can parse it. An AI agent can execute it. The same file. The same format.

---

## Why a New Format

Three things are true simultaneously in 2026 that were never all true before:

**AI agents need structured documents.** Agents that generate plans, workflows, and reports need their output to be machine-processable by the next agent in the chain. Plain text forces the next agent to re-interpret. JSON is unwritable by humans. There is no good format for agent-generated documents that humans can also review and edit.

**Documents need to be queryable.** Businesses store thousands of contracts, invoices, reports, and meeting notes — all in binary Word files or proprietary cloud formats. None of it is queryable. You cannot ask "what tasks are overdue across all project documents this week." IntentText makes every document a database row.

**Templates need to escape binary formats.** Invoice templates live in Word. Contract templates live in Google Docs. ERP document templates live in proprietary software. All of them are fragile, hard to version, impossible to query, and require expensive tooling to generate programmatically. A template stored as IntentText JSON plus a data JSON produces any document on demand — no Word, no Google, no proprietary anything.

No existing format solves all three. IntentText does.

---

## How It Works

Every `.it` file is a sequence of typed blocks. Each block is one line: a keyword, content, and optional pipe metadata.

```
keyword: content | property: value | property: value
```

The parser produces deterministic JSON — the same input always produces the same output, with no ambiguity:

```json
{
  "version": "2.0",
  "metadata": { "title": "Q2 Product Launch Plan" },
  "blocks": [
    {
      "id": "block-1",
      "type": "task",
      "content": "Finalize pricing page",
      "properties": { "owner": "Sarah", "due": "Friday", "priority": "1" }
    },
    {
      "id": "block-2",
      "type": "gate",
      "content": "Final go/no-go",
      "properties": { "approver": "CEO", "timeout": "24h" }
    }
  ]
}
```

Every block. Every time. No interpretation required.

---

## Three Audiences, One Format

### For Writers

A clean, distraction-free writing surface with semantic structure underneath. Write a book, a news article, a legal contract, or a report in IntentText. The `byline:`, `epigraph:`, `footnote:`, `caption:`, and `toc:` blocks give writers first-class tools. Export to beautifully typeset PDF, HTML, or Markdown. Your documents are plain text files you own forever — no subscription, no lock-in.

```
font: | family: Georgia | size: 12pt | leading: 1.8
page: | size: A5 | margins: 22mm | footer: {{page}}

epigraph: We build in stone what we fear to say in words. | by: Anonymous
byline: Emad Jumaah | date: March 2026 | publication: Dalil Review

note: The city had no memory of rain. Not in the way cities forget things... | align: justify
```

### For Businesses

Store document templates as JSON. Store data as JSON. Render any document — invoice, purchase order, contract, report — on demand. No Word. No Google Docs. No binary files. Everything in your database, everything queryable, everything versionable.

```
// Template stored in DB as JSON + data stored in DB as JSON → rendered on demand

title: Invoice {{invoice.number}}
note: Bill To: {{client.name}}, {{client.address}}

| Description           | Qty           | Total              |
| {{items.0.description}} | {{items.0.qty}} | {{items.0.total}} |

note: **Total Due: {{totals.due}} {{totals.currency}}** | align: right
result: Invoice generated | code: 200
```

### For Developers and AI Agents

An agentic workflow written in IntentText is human-reviewable and machine-executable. Agents generate `.it` files as their execution plans. Humans review and edit them. Runtimes execute them. The format is the contract between the human and the machine.

```
title: User Onboarding Pipeline
agent: onboard-agent | model: claude-sonnet-4
context: | userId: {{userId}} | plan: pro

step: Verify email     | tool: email.verify  | input: {{userId}}  | output: emailStatus
step: Create workspace | tool: ws.create     | depends: step-1    | output: workspace
gate: Confirm account  | approver: {{emailStatus.email}} | timeout: 24h
call: ./notify-team.it | input: {{workspace}}
result: Onboarded      | code: 200 | data: {{workspace}}
```

---

## What IntentText Is Not

**It is not a programming language.** There are no loops over data structures, no function definitions, no type system. It is a document format with executable semantics — the runtime handles the mechanics.

**It is not trying to replace Markdown for simple notes.** If you need a quick README, use Markdown. IntentText earns its place when your document needs to be queried, executed, templated, or processed by a machine.

**It is not another YAML workflow format.** YAML configs are for machines. IntentText documents are for humans first, machines second. A non-technical writer can read and author an IntentText document. Nobody writes YAML for fun.

---

## The Ecosystem

| Project                | What it is                                                                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`@intenttext/core`** | The parser, renderer, and template engine. Install and use in any Node.js or browser project.                                                                          |
| **IntentText Editor**  | A WYSIWYG editor where the `.it` format is the data layer, invisible during normal writing. _(coming)_                                                                 |
| **VS Code Extension**  | Syntax highlighting, live preview, and snippets for `.it` files. [Install from Marketplace](https://marketplace.visualstudio.com/items?itemName=intenttext.intenttext) |
| **Python Package**     | [![PyPI](https://img.shields.io/pypi/v/intenttext)](https://pypi.org/project/intenttext/) Install with `pip install intenttext`                                       |
| **GitHub Action**      | Validate `.it` files in CI with one line: `uses: intenttext/intenttext-action@v1`                                                                                      |
| **Web Converter**      | Paste any web content or Markdown and convert to IntentText. [toit-psi.vercel.app](https://toit-psi.vercel.app/)                                                       |

---

## Quick Start

### Install

```bash
npm install @intenttext/core
```

### Parse a document

```javascript
import { parseIntentText, renderHTML } from "@intenttext/core";

const doc = parseIntentText(`
title: My Document

section: Tasks
task: Write the introduction | owner: Ahmed | due: Friday
task: Review and edit        | owner: Sarah | due: Monday

section: Notes
note: Meeting scheduled for Tuesday 3pm.
warning: Deadline cannot move — client presentation is fixed.
`);

// Query the document
const tasks = doc.blocks.filter((b) => b.type === "task");
const overdue = tasks.filter((b) => b.properties?.status === "overdue");

// Render to HTML
const html = renderHTML(doc);
```

### Template + Data → Document

```javascript
import { parseAndMerge, renderPrint } from "@intenttext/core";
import invoiceTemplate from "./templates/invoice.it";
import invoiceData from "./data/invoice-2026-042.json";

// Merge template with data
const doc = parseAndMerge(invoiceTemplate, invoiceData);

// Render print-ready HTML
const printHTML = renderPrint(doc);
```

### Production-Safe Parsing

```javascript
import { parseIntentTextSafe } from "@intenttext/core";

// Never throws — returns warnings/errors as data
const result = parseIntentTextSafe(userInput, {
  unknownKeyword: "note", // treat unknown keywords as notes
  maxBlocks: 10000, // cap block count
  maxLineLength: 50000, // truncate long lines
});

console.log(result.document); // IntentDocument (always valid)
console.log(result.warnings); // [{ code: 'UNKNOWN_KEYWORD', line: 5, ... }]
console.log(result.errors); // [] (empty unless strict mode)
```

### Query a Document

```javascript
import { parseIntentText, queryDocument } from "@intenttext/core";

const doc = parseIntentText(source);

queryDocument(doc, { type: "task" }); // All tasks
queryDocument(doc, { type: "task", properties: { owner: "Ahmed" } }); // Ahmed's tasks
queryDocument(doc, { type: "step", properties: { tool: /email/ } }); // Steps using email tools
queryDocument(doc, { section: "Deployment" }); // Everything in Deployment
queryDocument(doc, { type: ["step", "gate"], limit: 5 }); // First 5 steps or gates
```

### Validate, Diff, and Round-Trip

```javascript
import {
  parseIntentText,
  validateDocumentSemantic,
  diffDocuments,
  documentToSource,
} from "@intenttext/core";

// Semantic validation — checks cross-references, missing properties, duplicates
const result = validateDocumentSemantic(doc);
console.log(result.valid); // true/false
console.log(result.issues); // [{ code: 'STEP_REF_MISSING', type: 'error', ... }]

// Diff two versions of a document
const diff = diffDocuments(oldDoc, newDoc);
console.log(diff.summary); // "2 added, 1 removed, 3 modified, 8 unchanged"

// Convert back to .it source (round-trip)
const source = documentToSource(doc);
```

### CLI

```bash
node cli.js document.it                                    # Parse to JSON
node cli.js document.it --html                             # Render to HTML
node cli.js template.it --data data.json --print           # Template + data → print HTML
node cli.js template.it --data data.json --pdf             # Template + data → PDF
```

---

## Syntax Reference

### Document Header

| Keyword    | Example                                                  |
| ---------- | -------------------------------------------------------- |
| `title:`   | `title: *My Document*`                                   |
| `summary:` | `summary: A brief description`                           |
| `agent:`   | `agent: my-agent \| model: claude-sonnet-4`              |
| `context:` | `context: \| userId: u_123 \| plan: pro`                 |
| `font:`    | `font: \| family: Georgia \| size: 12pt \| leading: 1.6` |
| `page:`    | `page: \| size: A4 \| margins: 20mm \| footer: {{page}}` |

### Document Structure

| Keyword    | Example                               |
| ---------- | ------------------------------------- |
| `section:` | `section: Action Items`               |
| `sub:`     | `sub: Sub-section title`              |
| `toc:`     | `toc: \| depth: 2 \| title: Contents` |
| `---`      | Horizontal divider                    |
| `//`       | Comment — ignored by parser           |
| `break:`   | Explicit page break                   |

### Writer Blocks

| Keyword                                    | Example                                                           |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `note:`                                    | `note: Body paragraph text \| align: justify`                     |
| `byline:`                                  | `byline: Author Name \| date: March 2026 \| publication: Journal` |
| `epigraph:`                                | `epigraph: Opening quote text. \| by: Author`                     |
| `quote:`                                   | `quote: Be concise. \| by: Strunk`                                |
| `caption:`                                 | `caption: Figure 1 — System architecture overview`                |
| `footnote:`                                | `footnote: 1 \| text: Source: QCB Annual Report 2025, p. 47`      |
| `dedication:`                              | `dedication: For my father, who taught me to read slowly.`        |
| `ask:`                                     | `ask: Should we ship in June or wait for v2?`                     |
| `info:` / `warning:` / `tip:` / `success:` | Callout blocks                                                    |

### Task Blocks

| Keyword | Example                                                         |
| ------- | --------------------------------------------------------------- |
| `task:` | `task: Write docs \| owner: John \| due: Friday \| priority: 1` |
| `done:` | `done: Setup repository \| time: Monday`                        |

### Data & Media

| Keyword            | Example                                              |
| ------------------ | ---------------------------------------------------- |
| `\| Col \| Col \|` | Pipe table                                           |
| `image:`           | `image: Logo \| at: logo.png \| caption: Brand mark` |
| `link:`            | `link: Documentation \| to: https://docs.com`        |
| `code:`            | Fenced code blocks                                   |

### Agentic Workflow Blocks

| Keyword       | Purpose                    | Example                                                                  |
| ------------- | -------------------------- | ------------------------------------------------------------------------ |
| `step:`       | Execute a tool or action   | `step: Send email \| tool: email.send \| output: sent`                   |
| `decision:`   | Conditional branch         | `decision: Check \| if: {{score}} > 0.9 \| then: step-3 \| else: step-4` |
| `parallel:`   | Concurrent execution       | `parallel: Run checks \| steps: lint,test,build \| join: all`            |
| `loop:`       | Iterate over collection    | `loop: Process items \| over: {{items}} \| do: step-3`                   |
| `call:`       | Invoke sub-workflow        | `call: ./verify.it \| input: {{userId}} \| output: verified`             |
| `gate:`       | Pause for human approval   | `gate: Approve deploy \| approver: ops-lead \| timeout: 24h`             |
| `wait:`       | Async pause                | `wait: Tests complete \| on: tests.done \| timeout: 60s`                 |
| `retry:`      | Retry on failure           | `retry: API call \| max: 3 \| delay: 1s \| backoff: exponential`         |
| `error:`      | Error handler              | `error: On failure \| fallback: step-1 \| notify: ops-team`              |
| `trigger:`    | Workflow entry point       | `trigger: webhook \| event: user.signup`                                 |
| `checkpoint:` | Safe resume point          | `checkpoint: post-deploy`                                                |
| `handoff:`    | Transfer to another agent  | `handoff: Pass to billing \| from: triage \| to: billing-agent`          |
| `audit:`      | Immutable execution record | `audit: Complete \| by: {{agent}} \| at: {{timestamp}}`                  |
| `emit:`       | Broadcast state externally | `emit: deploy.complete \| phase: production`                             |
| `result:`     | Terminal workflow output   | `result: Success \| code: 200 \| data: {{workspace}}`                    |

### Inline Formatting

| Style          | Syntax                               |
| -------------- | ------------------------------------ |
| Bold           | `*text*`                             |
| Italic         | `_text_`                             |
| Strikethrough  | `~text~`                             |
| Highlight      | `^text^`                             |
| Inline code    | `` `code` ``                         |
| Link           | `[label](url)`                       |
| Footnote ref   | `[^1]`                               |
| Mention        | `@person`                            |
| Tag            | `#topic`                             |
| Date shorthand | `@today`, `@tomorrow`, `@2026-03-10` |

---

## Comparison

|                       | Word / Google Docs | Markdown | YAML / JSON | Notion           | **IntentText** |
| --------------------- | ------------------ | -------- | ----------- | ---------------- | -------------- |
| Human writable        | ✅                 | ✅       | ❌          | ✅               | ✅             |
| Semantically typed    | ❌                 | ❌       | ✅          | ✅ (proprietary) | ✅             |
| Natively JSON         | ❌                 | ❌       | ✅          | API only         | ✅             |
| Open / portable       | ❌                 | ✅       | ✅          | ❌               | ✅             |
| Template + data merge | ❌                 | ❌       | ❌          | ❌               | ✅             |
| Agent executable      | ❌                 | ❌       | ❌          | ❌               | ✅             |
| Print / PDF output    | ✅                 | partial  | ❌          | partial          | ✅             |
| Queryable             | ❌                 | ❌       | ✅          | ✅ (proprietary) | ✅             |

---

## Project Structure

```
IntentText/
├── packages/core/           # @intenttext/core (npm)
│   ├── src/
│   │   ├── types.ts        # Block types and interfaces
│   │   ├── parser.ts       # Core parser + parseIntentTextSafe
│   │   ├── renderer.ts     # HTML and print renderer
│   │   ├── merge.ts        # Template + data merge engine
│   │   ├── query.ts        # Query engine + queryDocument
│   │   ├── schema.ts       # Schema-based validation
│   │   ├── validate.ts     # Semantic validation
│   │   ├── source.ts       # documentToSource (JSON → .it)
│   │   ├── diff.ts         # diffDocuments (semantic diff)
│   │   ├── markdown.ts     # Markdown → IntentText converter
│   │   ├── html-to-it.ts   # HTML → IntentText converter
│   │   ├── utils.ts        # Shared utilities
│   │   ├── browser.ts      # Browser entry point
│   │   └── index.ts        # Public API
│   └── tests/              # 426 tests
├── docs/
│   ├── SPEC.md             # Full language specification
│   └── USAGE.md            # Usage guide
├── examples/
│   └── templates/          # Invoice, contract, book, report, and more
├── cli.js                  # CLI tool
├── preview.html            # Live editor
└── intenttext.browser.js   # Browser bundle
```

## Development

```bash
npm install && npm run build
npm test                     # 426 tests passing
npm run demo                 # Demo output
npm run preview              # Live editor in browser
```

---

## Design Principles

**Keep the format dumb. Make the runtime smart.** IntentText expresses intent — what a document contains and means. How that intent is executed, stored, or rendered is the runtime's job. The format stays simple so a developer can understand the entire specification in an hour.

**Every keyword earns its place.** A keyword is only added if it expresses something that genuinely cannot be expressed as a property on an existing block, and cannot be handled by the runtime without appearing in the document itself. The current set is final at 36 keywords.

**The human is always the primary author.** Even in agentic workflows, the document must be readable and editable by a human without special tools. A `.it` file opened in any text editor must be immediately understandable.

---

## Specification

See [docs/SPEC.md](docs/SPEC.md) for the complete language specification.
See [docs/TEMPLATES.md](docs/TEMPLATES.md) for the template system and document generation guide.

## License

MIT — use it, build on it, ship it.
