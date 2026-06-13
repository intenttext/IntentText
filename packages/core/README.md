# @dotit/core

Parser, HTML renderer, and document generation engine for **IntentText** (`.it`) — a structured interchange format for AI agents and humans.

## Install

```bash
npm install @dotit/core
```

## Quick Start

```typescript
import { parseIntentText, renderHTML } from "@dotit/core";

const doc = parseIntentText(`
title: Sprint Planning — Week 12
summary: Tasks and decisions for the week.

section: Action Items
task: Write migration script | owner: Sarah | due: Wednesday
task: Update CI pipeline | owner: Dev Team | due: Friday
done: Security audit complete

section: Notes
note: Next demo on Friday 3pm.
info: New staging environment is live.
`);

console.log(doc.version); // "1.4"
console.log(doc.blocks.length); // 8

const html = renderHTML(doc); // Styled HTML output
```

> Pure TypeScript — no native or WASM dependency. Runs unchanged in Node and the
> browser. (The earlier Rust/WASM engine was removed in v4; the TS parser is the
> single canonical implementation. See [SPEC.md](./SPEC.md).)

## API

### Parsing

```typescript
import { parseIntentText } from "@dotit/core";

const doc = parseIntentText(source);
// Returns: IntentDocument { version, metadata, blocks, diagnostics }
```

### Rendering

```typescript
import { renderHTML, renderPrint } from "@dotit/core";

// Inline HTML fragment (for embedding in a page)
const html = renderHTML(doc);

// Full print-optimized HTML document with embedded CSS
// Reads font: and page: blocks for dynamic typography and layout
const printHtml = renderPrint(doc);
```

### Template Merge

Resolve `{{variable}}` placeholders in a parsed document using a JSON data object.

```typescript
import { mergeData, parseAndMerge } from "@dotit/core";

const data = {
  company: { name: "Acme Corp" },
  invoice_number: "INV-2026-001",
  total: "17,325 QAR",
};

// Merge after parsing
const merged = mergeData(doc, data);

// Parse + merge in one step
const result = parseAndMerge(templateString, data);
```

- Dot notation: `{{company.name}}` → `data.company.name`
- Array indices: `{{items.0.description}}` → `data.items[0].description`
- System variables: `{{date}}`, `{{year}}` resolved automatically
- Runtime variables: `{{page}}`, `{{pages}}` become CSS page counters in `renderPrint`
- Missing fields: `parseAndMerge(src, data, { missing: "blank" })` renders an
  unresolved `{{field}}` empty — use for finished documents so an invoice never
  prints a literal `{{customer.phone}}` (default `"keep"` aids template authoring)

### Server-side PDFs

For real PDF bytes on a server (email attachments, archiving, batch runs) use the
opt-in companion **[`@dotit/pdf`](https://www.npmjs.com/package/@dotit/pdf)** —
`issuePDF(template, data, { signer })` runs merge → **seal** (tamper-evident SHA-256) →
PDF in one call. Core itself stays zero-dependency.

### Querying

```typescript
import { queryBlocks } from "@dotit/core";

const result = queryBlocks(doc, "type:task owner:Ahmed sort:due:asc limit:5");
console.log(result.blocks); // Filtered & sorted blocks
```

### Trust — sign, seal, verify

`.it` documents are tamper-evident. `sealDocument` records a signer and freezes the
content with a SHA-256 hash; `verifyDocument` recomputes it and reports integrity.

```typescript
import { sealDocument, verifyDocument } from "@dotit/core";

const sealed = sealDocument(source, { signer: "Sarah Chen", role: "Legal" });
const result = verifyDocument(sealed.source);
console.log(result.intact); // true — false if a single character changed
```

The hashing rules are open and documented in [SPEC.md](./SPEC.md), so anyone with the
library can verify independently.

### Converters

Convert between IntentText and common document formats. Markdown/HTML are
text-in/text-out; XLSX/DOCX are OOXML (a ZIP of XML) and use bytes — pure-JS,
no native modules (powered by `fflate`).

```typescript
import {
  convertMarkdownToIntentText, // Markdown → .it
  convertHtmlToIntentText, // HTML → .it
  convertXlsxToIntentText, // .xlsx bytes → .it (each sheet → section + table)
  convertIntentTextToXlsx, // .it → .xlsx bytes (each table → worksheet)
  convertDocxToIntentText, // .docx bytes → .it (headings/lists/tables)
  convertIntentTextToDocx, // .it → .docx bytes
} from "@dotit/core";

const itFromMd = convertMarkdownToIntentText(markdownString);

// Spreadsheet round-trip
const xlsxBytes = convertIntentTextToXlsx(itSource); // Uint8Array
const itFromXlsx = convertXlsxToIntentText(xlsxBytes); // numbers preserved faithfully

// Word document round-trip
const docxBytes = convertIntentTextToDocx(itSource); // Uint8Array
const itFromDocx = convertDocxToIntentText(docxBytes);
```

CLI:

```bash
dotit convert report.xlsx report.it   # spreadsheet → IntentText
dotit convert report.it report.xlsx   # tables → worksheets
dotit convert report.docx report.it   # Word document → IntentText
dotit convert report.it report.docx   # IntentText → Word document
```

> Scope (v1): XLSX/DOCX converters preserve text, tables, headings, lists, and
> all cell values (formula cells export their last cached value). Cell styling,
> images, charts, and live formulas are intentionally out of scope for v1.

## Syntax Overview

### Structure & Content

```
title: My Document
section: Chapter One
sub: Details
note: A standalone fact.
task: Do something | owner: Ahmed | due: Friday
done: Already finished | time: Monday
quote: Be concise. | by: Strunk
info: Informational callout.
---
```

### Agentic Workflows (v2.0+)

```
agent: deploy-agent | model: claude-sonnet-4
step: Run tests | tool: ci.test | timeout: 300000
decision: Pass? | if: tests == "pass" | then: step-2 | else: step-3
gate: Approve deploy | approver: ops-lead | timeout: 24h
handoff: Transfer | from: deploy-agent | to: monitor-agent
emit: Complete | phase: deploy | level: success
```

### Document Generation (v2.5)

```
font: | family: Palatino Linotype | size: 12pt | leading: 1.8
page: | size: A5 | margins: 25mm | footer: Page {{page}} of {{pages}}

title: *Chapter One*
dedication: To the builders who write before they code.
byline: Ahmed Al-Rashid | role: Author
epigraph: The tools we build shape the thoughts we can think. | source: Kenneth Iverson
toc: | depth: 2 | title: Contents

section: Introduction
caption: Figure 1 — The parsing pipeline
footnote: 1 | See chapter 3 for details.
break:
```

### Inline Formatting

| Style         | Syntax       |
| ------------- | ------------ |
| Bold          | `*text*`     |
| Italic        | `_text_`     |
| Strikethrough | `~text~`     |
| Code          | `` `code` `` |
| Highlight     | `^text^`     |
| Inline note   | `[[text]]`   |
| Footnote ref  | `{1}`        |
| Styled span   | `[text]{ color: #c00; weight: bold }` — style part of a line |

### Styling (three layers)

1. **Theme** — `renderHTML(doc, { theme: "corporate" })` (8 built-in document classes)
2. **`style:` rules (v4.3)** — house styling per block type, declared once:
   `style: section | color: #0a7 | weight: 600`
   (targets: title, summary, section, sub, text, quote, callout/info, table,
   table-header, metric, contact, divider; same constrained style keys — never
   arbitrary CSS, content stays queryable)
3. **Per-line props / inline spans** — exceptions: `text: hi | color: red`,
   `[word]{ size: 1.2em }` (most-specific wins)

## CLI

```bash
node cli.js document.it                          # Parse to JSON
node cli.js document.it --html                   # Render HTML
node cli.js template.it --data data.json --html  # Merge + render
node cli.js template.it --data data.json --print # Print-optimized HTML
node cli.js template.it --data data.json --pdf out.pdf  # PDF via Puppeteer
```

## Test Suite

869 tests covering parser, renderer, query engine, converters, agentic blocks,
document generation, trust/seal, and round-trip serialization.

```bash
pnpm test
```

## Links

- [Full Specification](https://dotit.uts.qa/docs/reference)
- [Usage Guide](https://dotit.uts.qa/docs/guide)
- [Changelog](https://github.com/intenttext/IntentText/blob/main/CHANGELOG.md)
- [Example Templates](https://github.com/intenttext/IntentText/tree/main/examples/templates)

## License

MIT
