# @intenttext/core

Parser, HTML renderer, and document generation engine for **IntentText** (`.it`) — a structured interchange format for AI agents and humans.

## Install

```bash
npm install @intenttext/core
```

## Quick Start

```typescript
import { parseIntentText, renderHTML } from "@intenttext/core";

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

## API

### Parsing

```typescript
import { parseIntentText } from "@intenttext/core";

const doc = parseIntentText(source);
// Returns: IntentDocument { version, metadata, blocks, diagnostics }
```

### Rendering

```typescript
import { renderHTML, renderPrint } from "@intenttext/core";

// Inline HTML fragment (for embedding in a page)
const html = renderHTML(doc);

// Full print-optimized HTML document with embedded CSS
// Reads font: and page: blocks for dynamic typography and layout
const printHtml = renderPrint(doc);
```

### Template Merge

Resolve `{{variable}}` placeholders in a parsed document using a JSON data object.

```typescript
import { mergeData, parseAndMerge } from "@intenttext/core";

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
- Runtime variables: `{{page}}`, `{{pages}}` left as-is for the print renderer

### Querying

```typescript
import { queryBlocks } from "@intenttext/core";

const result = queryBlocks(doc, "type:task owner:Ahmed sort:due:asc limit:5");
console.log(result.blocks); // Filtered & sorted blocks
```

### Converters

```typescript
import { convertMarkdownToIntentText } from "@intenttext/core";

const itSource = convertMarkdownToIntentText(markdownString);
```

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

## CLI

```bash
node cli.js document.it                          # Parse to JSON
node cli.js document.it --html                   # Render HTML
node cli.js template.it --data data.json --html  # Merge + render
node cli.js template.it --data data.json --print # Print-optimized HTML
node cli.js template.it --data data.json --pdf out.pdf  # PDF via Puppeteer
```

## Test Suite

308 tests across 10 test files covering parser, renderer, query engine, converters, agentic blocks, and document generation.

```bash
npm test
```

## Links

- [Full Specification](https://github.com/emadjumaah/IntentText/blob/main/docs/SPEC.md)
- [Usage Guide](https://github.com/emadjumaah/IntentText/blob/main/docs/USAGE.md)
- [Changelog](https://github.com/emadjumaah/IntentText/blob/main/CHANGELOG.md)
- [Example Templates](https://github.com/emadjumaah/IntentText/tree/main/examples/templates)

## License

MIT
