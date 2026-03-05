# IntentText — Usage Guide

This guide covers how to use the `@intenttext/core` package — parsing, rendering, querying, validating, template merging, and converting to/from other formats.

## Installation

```bash
npm install @intenttext/core
```

Or from source:

```bash
git clone https://github.com/intenttext/IntentText.git
cd IntentText
npm install && npm run build
```

## Quick Start

### Parse & Render

```javascript
import { parseIntentText, renderHTML } from "@intenttext/core";

const doc = parseIntentText(`
title: Q2 Product Launch Plan
summary: Coordinating the June release.

section: Tasks
task: Finalize pricing page | owner: Sarah | due: Friday | priority: 1
task: Record demo video     | owner: Ahmed | due: Monday
done: Legal review complete  | time: Tuesday

section: Notes
note: Meeting scheduled for Tuesday 3pm.
warning: Deadline cannot move — client presentation is fixed.
`);

// Query the document
const tasks = doc.blocks
  .flatMap((b) => b.children || [b])
  .filter((b) => b.type === "task");
console.log(tasks.length); // 3 (includes done as task with status: "done")

// Render to HTML
const html = renderHTML(doc);
```

### Template + Data Merge

```javascript
import { parseAndMerge, renderPrint } from "@intenttext/core";

const template = `
title: Invoice {{invoice.number}}
note: Bill To: {{client.name}}, {{client.address}}

| Description           | Qty           | Total              |
| {{items.0.description}} | {{items.0.qty}} | {{items.0.total}} |

note: **Total Due: {{totals.due}} {{totals.currency}}** | align: right
`;

const data = {
  invoice: { number: "INV-2026-042" },
  client: { name: "Acme Corp", address: "123 Main St" },
  items: [{ description: "Consulting", qty: "10", total: "$5,000" }],
  totals: { due: "$5,000", currency: "USD" },
};

const doc = parseAndMerge(template, data);
const printHTML = renderPrint(doc);
```

### Agentic Workflows

```javascript
const { parseIntentText } = require("@intenttext/core");

const content = `title: User Onboarding Flow
agent: onboard-agent | model: claude-sonnet-4
context: | userId: u_123 | plan: pro

section: Verification
step: Verify email | tool: email.verify | input: {{userId}} | output: emailStatus
step: Create workspace | tool: ws.create | depends: step-1
decision: Check plan | if: plan == "pro" | then: step-3 | else: step-4
step: Enable pro features | id: step-3 | tool: features.enable
step: Send welcome email | id: step-4 | tool: email.send

checkpoint: onboarding-complete
audit: Workflow initialized | by: {{agent}} | at: {{timestamp}}`;

const doc = parseIntentText(content);

// Document version is auto-detected
console.log(doc.version); // "2.0"

// Access agentic metadata
console.log(doc.metadata?.agent); // "onboard-agent"
console.log(doc.metadata?.model); // "claude-sonnet-4"
console.log(doc.metadata?.context); // { userId: "u_123", plan: "pro" }

// Get all pending steps
const pending = doc.blocks
  .flatMap((b) => b.children || [b])
  .filter((b) => b.type === "step" && b.properties?.status === "pending");

// Get decision branches
const decisions = doc.blocks
  .flatMap((b) => b.children || [b])
  .filter((b) => b.type === "decision");
```

### 4. Inter-Agent Communication (v2.1+)

```javascript
const { parseIntentText } = require("@intenttext/core");

const content = `title: Multi-Agent Support Pipeline
agent: triage-agent | model: gpt-4o

section: Intake
step: Classify ticket | tool: classifier.run | input: ticketText
result: Classification complete | code: 200 | data: {"category":"billing"}

section: Routing
handoff: Transfer to billing | from: triage-agent | to: billing-agent
wait: Billing agent response | on: billing.complete | timeout: 30s | fallback: escalate
emit: In Progress | phase: billing-review | level: info

section: Resolution
parallel: Run checks | steps: verify-account,check-balance,pull-history | join: all
retry: Send confirmation email | max: 3 | delay: 1000 | backoff: exponential`;

const doc = parseIntentText(content);

// Get handoff blocks for multi-agent routing
const handoffs = doc.blocks
  .flatMap((b) => b.children || [b])
  .filter((b) => b.type === "handoff");
console.log(handoffs[0].properties?.to); // "billing-agent"

// Get wait blocks with timeouts
const waits = doc.blocks
  .flatMap((b) => b.children || [b])
  .filter((b) => b.type === "wait");
console.log(waits[0].properties?.timeout); // "30s"

// Get parallel execution groups
const parallels = doc.blocks
  .flatMap((b) => b.children || [b])
  .filter((b) => b.type === "parallel");
console.log(parallels[0].properties?.steps); // "verify-account,check-balance,pull-history"

// Get retry policies (numeric properties are auto-coerced)
const retries = doc.blocks
  .flatMap((b) => b.children || [b])
  .filter((b) => b.type === "retry");
console.log(retries[0].properties?.max); // 3 (number)
console.log(retries[0].properties?.delay); // 1000 (number)
```

## 🛠️ Command Line Tools

### CLI Usage

```bash
# Parse to JSON
node cli.js document.it

# Generate HTML output
node cli.js document.it --html

# Save HTML to file
node cli.js document.it --output

# Help
node cli.js
```

### npm Scripts

```bash
# Run demo with examples
npm run demo

# Interactive preview
npm run preview

# Parse sample files
npm run parse:html
npm run parse:output
```

## 🌐 Browser Usage

### Direct Inclusion

```html
<!DOCTYPE html>
<html>
  <head>
    <title>IntentText Demo</title>
  </head>
  <body>
    <div id="output"></div>

    <script src="path/to/@intenttext/core/dist/index.js"></script>
    <script>
      const { parseIntentText, renderHTML } = IntentText;

      const content = `title: *My Document*
section: Demo
task: Parse this | owner: Browser`;

      const document = parseIntentText(content);
      const html = renderHTML(document);

      document.getElementById("output").innerHTML = html;
    </script>
  </body>
</html>
```

### Module Bundlers

```javascript
// ES6 modules
import { parseIntentText, renderHTML } from "@intenttext/core";

// CommonJS
const { parseIntentText, renderHTML } = require("@intenttext/core");
```

## 📚 API Reference

### parseIntentText(content: string): IntentDocument

Parses IntentText content into structured JSON.

**Parameters:**

- `content` - Raw IntentText string

**Returns:** `IntentDocument` object

**Example:**

```javascript
const document = parseIntentText("title: My Doc");
console.log(document.blocks[0].type); // 'title'
console.log(document.metadata?.title); // 'My Doc'
```

### renderHTML(document: IntentDocument): string

Renders parsed IntentDocument to HTML string.

**Parameters:**

- `document` - Parsed IntentDocument object

**Returns:** HTML string

**Example:**

```javascript
const html = renderHTML(document);
document.body.innerHTML = html;
```

### parseIntentTextSafe(source, options?): SafeParseResult

Production-grade parser that **never throws** under any input. Wraps `parseIntentText` with configurable limits.

**Options:**

- `unknownKeyword` — `'note'` (default) | `'skip'` | `'throw'` — how to handle unrecognised keywords
- `maxBlocks` — `number` (default: 10000) — stop after N blocks
- `maxLineLength` — `number` (default: 50000) — truncate long lines
- `strict` — `boolean` (default: false) — unknown keywords become errors

**Returns:** `{ document: IntentDocument, warnings: ParseWarning[], errors: ParseError[] }`

**Example:**

```javascript
import { parseIntentTextSafe } from "@intenttext/core";

const result = parseIntentTextSafe(userInput, {
  unknownKeyword: "note",
  maxBlocks: 5000,
});

if (result.warnings.length > 0) {
  console.warn("Parse warnings:", result.warnings);
}

const doc = result.document; // always valid, never throws
```

### documentToSource(doc: IntentDocument): string

Converts a parsed document back to `.it` source text. Round-trip guarantee: parsing the output produces identical block types, content, and properties.

**Example:**

```javascript
import { parseIntentText, documentToSource } from "@intenttext/core";

const doc = parseIntentText(source);
const itSource = documentToSource(doc);
// parseIntentText(itSource) ≡ doc (same types, content, properties)
```

### validateDocumentSemantic(doc: IntentDocument): SemanticValidationResult

Semantic validation — checks cross-block references, missing properties, duplicate IDs, unresolved variables, and structural rules.

**Returns:** `{ valid: boolean, issues: SemanticIssue[] }`

**Example:**

```javascript
import { parseIntentText, validateDocumentSemantic } from "@intenttext/core";

const doc = parseIntentText(source);
const result = validateDocumentSemantic(doc);

if (!result.valid) {
  const errors = result.issues.filter((i) => i.type === "error");
  console.error("Validation errors:", errors);
}

// Issue codes: STEP_REF_MISSING, DEPENDS_REF_MISSING, DUPLICATE_STEP_ID,
// GATE_NO_APPROVER, STEP_NO_TOOL, UNRESOLVED_VARIABLE, EMPTY_SECTION, etc.
```

### queryDocument(doc: IntentDocument, options: SimpleQueryOptions): IntentBlock[]

Simple, intuitive block query API. All conditions are ANDed; type arrays are ORed.

**Options:**

- `type` — `string | string[]` — filter by block type(s)
- `content` — `string | RegExp` — substring or regex content match
- `properties` — `Record<string, string | RegExp>` — all key/value pairs must match
- `section` — `string | RegExp` — only blocks within matching sections
- `limit` — `number` — max results

**Example:**

```javascript
import { parseIntentText, queryDocument } from "@intenttext/core";

const doc = parseIntentText(source);

// All tasks owned by Ahmed
queryDocument(doc, { type: "task", properties: { owner: "Ahmed" } });

// All steps using email tools
queryDocument(doc, { type: "step", properties: { tool: /email/ } });

// Everything in the Deployment section
queryDocument(doc, { section: "Deployment" });

// Combined: priority-1 tasks in Action Items section, limit 5
queryDocument(doc, {
  type: "task",
  section: "Action Items",
  properties: { priority: "1" },
  limit: 5,
});
```

### diffDocuments(before: IntentDocument, after: IntentDocument): DocumentDiff

Semantic diff between two document versions. Blocks matched by content similarity (Levenshtein), not ephemeral IDs.

**Returns:** `{ added[], removed[], modified[], unchanged[], summary }`

**Example:**

```javascript
import { parseIntentText, diffDocuments } from "@intenttext/core";

const before = parseIntentText(oldSource);
const after = parseIntentText(newSource);
const diff = diffDocuments(before, after);

console.log(diff.summary); // "2 added, 1 removed, 3 modified"
console.log(diff.added); // IntentBlock[]
console.log(diff.modified); // [{ contentChanged, propertiesChanged, typeChanged, ... }]
```

## 🎯 Working with Blocks

### Accessing Specific Block Types

```javascript
const document = parseIntentText(content);

// Get all tasks
const tasks = document.blocks.filter((b) => b.type === "task");

// Get all sections
const sections = document.blocks.filter((b) => b.type === "section");

// Get nested blocks (children of sections)
const sectionChildren = sections.flatMap((s) => s.children || []);

// Find specific block
const specificTask = document.blocks.find(
  (b) => b.type === "task" && b.content.includes("urgent"),
);

// v2: Get all workflow steps
const steps = sectionChildren.filter((b) => b.type === "step");

// v2: Get steps by status
const running = sectionChildren.filter(
  (b) => b.type === "step" && b.properties?.status === "running",
);

// v2: Get decisions
const decisions = sectionChildren.filter((b) => b.type === "decision");

// v2: Get audit trail
const auditLog = sectionChildren.filter((b) => b.type === "audit");

// v2.1: Get handoff blocks (inter-agent transfers)
const handoffs = sectionChildren.filter((b) => b.type === "handoff");

// v2.1: Get wait blocks (async pause points)
const waits = sectionChildren.filter((b) => b.type === "wait");

// v2.1: Get parallel groups
const parallels = sectionChildren.filter((b) => b.type === "parallel");

// v2.1: Get retry policies
const retryPolicies = sectionChildren.filter((b) => b.type === "retry");

// v2.1: Get status updates (now emit blocks)
const emitUpdates = sectionChildren.filter((b) => b.type === "emit");

// v2.1: Get results
const results = sectionChildren.filter((b) => b.type === "result");
```

### Working with v2.3 Blocks

```javascript
const { parseIntentText } = require("@intenttext/core");

const content = `title: Approval Workflow
agent: deploy-agent | model: claude-sonnet-4
context: | env: production | version: 3.0.0

section: Build
step: Run tests | tool: ci.test | input: {{version}} | output: testResult
parallel: Lint & type-check | steps: lint,typecheck | join: all

section: Approval
gate: Production deploy approval | approver: ops-lead | timeout: 24h | fallback: exit
call: ./smoke-tests.it | input: {{version}} | output: smokeResult

section: Deploy
step: Deploy to production | tool: k8s.deploy | input: {{version}}
emit: deploy.complete | phase: production | level: success
result: Deployed v3.0.0 | code: 200`;

const doc = parseIntentText(content);

// v2.3: Get gate blocks (approval checkpoints)
const gates = doc.blocks
  .flatMap((b) => b.children || [b])
  .filter((b) => b.type === "gate");
console.log(gates[0].properties?.approver); // "ops-lead"
console.log(gates[0].properties?.status); // "blocked" (default)

// v2.3: Get call blocks (sub-workflow composition)
const calls = doc.blocks
  .flatMap((b) => b.children || [b])
  .filter((b) => b.type === "call");
console.log(calls[0].content); // "./smoke-tests.it"
console.log(calls[0].properties?.status); // "pending" (default)

// v2.3: Get emit blocks (status events/signals)
const emits = doc.blocks
  .flatMap((b) => b.children || [b])
  .filter((b) => b.type === "emit");
console.log(emits[0].content); // "deploy.complete"
console.log(emits[0].properties?.level); // "success"

// v2.3: {{variable}} references are preserved as strings
const steps = doc.blocks
  .flatMap((b) => b.children || [b])
  .filter((b) => b.type === "step");
console.log(steps[0].properties?.input); // "{{version}}"
```

### Working with Properties

```javascript
const tasks = document.blocks.filter((b) => b.type === "task");

tasks.forEach((task) => {
  console.log("Task:", task.content);
  console.log("Owner:", task.properties?.owner);
  console.log("Due:", task.properties?.due);
  console.log("Priority:", task.properties?.priority);
});

// v2: Working with step properties
const steps = document.blocks
  .flatMap((b) => b.children || [b])
  .filter((b) => b.type === "step");

steps.forEach((step) => {
  console.log("Step:", step.id, step.content);
  console.log("Tool:", step.properties?.tool);
  console.log("Status:", step.properties?.status);
  console.log("Depends:", step.properties?.depends);
  console.log("Input:", step.properties?.input);
  console.log("Output:", step.properties?.output);
});
```

### Handling Inline Formatting

```javascript
const titleBlock = document.blocks.find((b) => b.type === "title");

if (titleBlock.inline) {
  titleBlock.inline.forEach((node) => {
    console.log(node.type, node.value);
    // bold, italic, strike, code, highlight, inline-note, mention, tag, link
  });
}
```

### Writer-First Inline Syntax

```it
note: *bold* _italic_ ~strike~ `mono`
note: ^important^ [[draft]] by @sara in #newsroom
```

Supported inline tokens:

- `*text*` -> bold
- `_text_` -> italic
- `~text~` -> strikethrough
- `` `text` `` -> inline code
- `^text^` -> highlight
- `==text==` -> inline quote emphasis
- `[[text]]` -> inline side-note
- `[[label|url]]` -> inline link shorthand
- `@today`, `@tomorrow`, `@YYYY-MM-DD` -> date shorthand tokens
- `@person` -> mention token
- `#topic` -> tag token

### Prose Paragraph Behavior (No Keyword)

Plain lines without a keyword are treated as prose paragraphs:

```it
First line of narrative prose
continues naturally on the next line

This starts a new paragraph.
```

- Consecutive plain lines merge into one `body-text` block.
- Blank lines split paragraphs.
- Rendered prose uses a dedicated `.intent-prose` style for long-form readability.

### Optional Alignment

Alignment is opt-in and block-level via `align:` property:

```it
note: Centered quote | align: center
note: Sidebar annotation | align: right
note: Column copy | align: justify
```

Supported values: `center`, `right`, `justify`.

### Planned Writer UX (Not Yet in Core)

- Smart typing replacements (`--`, `...`, typographic quotes)
- App-level writing modes (`Book`, `News`, `Journal`, `Plain`), focus mode, and typewriter scroll

## 🔧 Advanced Usage

### Custom Rendering

```javascript
const { parseIntentText } = require("@intenttext/core");

function customRenderer(document) {
  return document.blocks
    .map((block) => {
      switch (block.type) {
        case "task":
          return `<task-item owner="${block.properties?.owner}">
          ${block.content}
        </task-item>`;
        case "step":
          return `<step-item id="${block.id}" tool="${block.properties?.tool}" status="${block.properties?.status}">
          ${block.content}
        </step-item>`;
        case "decision":
          return `<decision if="${block.properties?.if}" then="${block.properties?.then}" else="${block.properties?.else}">
          ${block.content}
        </decision>`;
        case "section":
          return `<section>${block.content}</section>`;
        default:
          return `<div>${block.content}</div>`;
      }
    })
    .join("\n");
}

const document = parseIntentText(content);
const customHTML = customRenderer(document);
```

### File Processing

```javascript
const fs = require("fs");
const { parseIntentText, renderHTML } = require("@intenttext/core");

// Process single file
function processFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const document = parseIntentText(content);
  const html = renderHTML(document);

  const outputPath = filePath.replace(".it", ".html");
  fs.writeFileSync(outputPath, html);

  console.log(`✅ Processed: ${filePath} → ${outputPath}`);
}

// Process directory
function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    if (file.endsWith(".it")) {
      processFile(`${dirPath}/${file}`);
    }
  });
}
```

### Integration with Web Servers

```javascript
// Express.js example
const express = require("express");
const { parseIntentText, renderHTML } = require("@intenttext/core");

const app = express();

app.post("/parse", (req, res) => {
  const { content } = req.body;

  try {
    const document = parseIntentText(content);
    const html = renderHTML(document);

    res.json({
      success: true,
      document,
      html,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

app.listen(3000, () => {
  console.log("IntentText server running on port 3000");
});
```

## 🧪 Testing Your Integration

### Unit Tests

```javascript
const { parseIntentText } = require("@intenttext/core");

describe("My IntentText Integration", () => {
  test("should parse tasks correctly", () => {
    const content = "task: Test task | owner: John";
    const document = parseIntentText(content);

    const task = document.blocks.find((b) => b.type === "task");
    expect(task.content).toBe("Test task");
    expect(task.properties.owner).toBe("John");
  });

  test("should handle inline formatting", () => {
    const content = "title: *Bold Title*";
    const document = parseIntentText(content);

    const title = document.blocks.find((b) => b.type === "title");
    expect(title.marks).toHaveLength(1);
    expect(title.marks[0].type).toBe("bold");
  });
});
```

### Integration Tests

```javascript
const fs = require("fs");
const { parseIntentText, renderHTML } = require("@intenttext/core");

test("should process real .it file", () => {
  const content = fs.readFileSync("./test-document.it", "utf-8");
  const document = parseIntentText(content);
  const html = renderHTML(document);

  expect(document.blocks.length).toBeGreaterThan(0);
  expect(html).toContain('<div class="intent-document"');
  expect(html).not.toContain("undefined");
});
```

## 🚨 Error Handling

### Common Errors

```javascript
const { parseIntentText } = require("@intenttext/core");

function safeParse(content) {
  try {
    return parseIntentText(content);
  } catch (error) {
    console.error("Parse error:", error.message);
    return {
      blocks: [],
      metadata: {},
      error: error.message,
    };
  }
}

// Validate document
function validateDocument(document) {
  if (!document.blocks || document.blocks.length === 0) {
    throw new Error("No blocks found in document");
  }

  const hasTitle = document.blocks.some((b) => b.type === "title");
  if (!hasTitle) {
    console.warn("Warning: No title block found");
  }

  return document;
}
```

## 📊 Performance Tips

### Large Files

```javascript
// Process in chunks for very large files
function processLargeFile(filePath, chunkSize = 1000) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  const chunks = [];
  for (let i = 0; i < lines.length; i += chunkSize) {
    const chunk = lines.slice(i, i + chunkSize).join("\n");
    chunks.push(parseIntentText(chunk));
  }

  return mergeDocuments(chunks);
}
```

### Caching

```javascript
const cache = new Map();

function cachedParse(content) {
  const hash = require("crypto")
    .createHash("md5")
    .update(content)
    .digest("hex");

  if (cache.has(hash)) {
    return cache.get(hash);
  }

  const document = parseIntentText(content);
  cache.set(hash, document);
  return document;
}
```

## 🔗 Links

- [Specification](./SPEC.md)
- [API Reference](../packages/core/src/types.ts)
- [Examples](../examples/)
- [Tests](../packages/core/tests/)

---

Need more help? Check the [main README](../README.md) or open an issue on GitHub.
