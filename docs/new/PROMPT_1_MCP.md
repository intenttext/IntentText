# IntentText MCP Server — Implementation Prompt
# Repo: github.com/intenttext/intenttext-mcp (new repo)
# Package: @intenttext/mcp-server on npm
# Depends on: @intenttext/core >= 2.2.0

---

## MISSION

Build a Model Context Protocol (MCP) server that exposes IntentText operations
as tools any AI agent can call. With this server running, Claude, GPT, or any
MCP-compatible agent can parse, validate, query, render, and generate IntentText
documents as native tool calls — without needing to understand the format itself.

This is the highest-leverage tool in the IntentText ecosystem. An agent that
generates a workflow plan writes it as `.it`, calls `validate_document`, fixes
any issues, and returns a guaranteed-valid structured document. The format
becomes the contract between agents.

---

## REPO STRUCTURE

Create at `github.com/intenttext/intenttext-mcp`:

```
intenttext-mcp/
├── src/
│   ├── index.ts          Entry point — starts the MCP server
│   ├── server.ts         Server setup and tool registration
│   ├── tools/
│   │   ├── parse.ts      parse_intent_text tool
│   │   ├── render.ts     render_html, render_print tools
│   │   ├── merge.ts      merge_template tool
│   │   ├── validate.ts   validate_document tool
│   │   ├── query.ts      query_document tool
│   │   ├── diff.ts       diff_documents tool
│   │   ├── source.ts     document_to_source tool
│   │   └── workflow.ts   extract_workflow tool
│   └── types.ts          Shared types
├── tests/
│   └── tools.test.ts
├── package.json
├── tsconfig.json
├── README.md
└── .github/
    └── workflows/
        └── publish.yml   Auto-publish to npm on release tag
```

---

## PART 1 — DEPENDENCIES

```json
{
  "name": "@intenttext/mcp-server",
  "version": "1.0.0",
  "description": "MCP server for IntentText — parse, validate, query, and render .it documents from any AI agent",
  "main": "dist/index.js",
  "bin": {
    "intenttext-mcp": "dist/index.js"
  },
  "dependencies": {
    "@intenttext/core": ">=2.2.0",
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "vitest": "^1.0.0"
  }
}
```

---

## PART 2 — SERVER SETUP

File: `src/server.ts`

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerParseTools } from "./tools/parse.js";
import { registerRenderTools } from "./tools/render.js";
import { registerMergeTools } from "./tools/merge.js";
import { registerValidateTools } from "./tools/validate.js";
import { registerQueryTools } from "./tools/query.js";
import { registerDiffTools } from "./tools/diff.js";
import { registerSourceTools } from "./tools/source.js";
import { registerWorkflowTools } from "./tools/workflow.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "intenttext",
    version: "1.0.0",
  });

  registerParseTools(server);
  registerRenderTools(server);
  registerMergeTools(server);
  registerValidateTools(server);
  registerQueryTools(server);
  registerDiffTools(server);
  registerSourceTools(server);
  registerWorkflowTools(server);

  return server;
}
```

File: `src/index.ts`

```typescript
#!/usr/bin/env node
import { createServer } from "./server.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = createServer();
const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## PART 3 — TOOLS

Implement each tool file. Each file exports a `register*Tools(server)` function.

### Tool: parse_intent_text

File: `src/tools/parse.ts`

```typescript
server.tool(
  "parse_intent_text",
  "Parse an IntentText (.it) source string into a structured JSON document. " +
  "Returns the complete document with metadata and typed blocks array. " +
  "Use this when you have raw .it text and need to inspect or process its structure.",
  {
    source: {
      type: "string",
      description: "The IntentText source string to parse"
    },
    safe: {
      type: "boolean",
      description: "If true, never throw — returns warnings instead of errors. Default: true",
      default: true
    }
  },
  async ({ source, safe = true }) => {
    if (safe) {
      const result = parseIntentTextSafe(source);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            document: result.document,
            warnings: result.warnings,
            errors: result.errors,
          }, null, 2)
        }]
      };
    } else {
      const document = parseIntentText(source);
      return {
        content: [{ type: "text", text: JSON.stringify(document, null, 2) }]
      };
    }
  }
);
```

### Tool: render_html

```typescript
server.tool(
  "render_html",
  "Render an IntentText source string or parsed document to styled HTML. " +
  "Returns a complete HTML string ready to display in a browser.",
  {
    source: {
      type: "string",
      description: "IntentText source string (.it format)"
    },
    include_css: {
      type: "boolean",
      description: "Include inline CSS styles. Default: true",
      default: true
    }
  },
  async ({ source, include_css = true }) => {
    const doc = parseIntentText(source);
    const html = renderHTML(doc, { includeCSS: include_css });
    return { content: [{ type: "text", text: html }] };
  }
);
```

### Tool: render_print

```typescript
server.tool(
  "render_print",
  "Render an IntentText document to print-optimised HTML with @media print CSS. " +
  "Applies font: and page: block settings. Suitable for PDF generation.",
  {
    source: { type: "string", description: "IntentText source string" }
  },
  async ({ source }) => {
    const doc = parseIntentText(source);
    const html = renderPrint(doc);
    return { content: [{ type: "text", text: html }] };
  }
);
```

### Tool: merge_template

```typescript
server.tool(
  "merge_template",
  "Merge an IntentText template (containing {{variable}} placeholders) with a " +
  "data object. Returns the merged .it source with all variables resolved. " +
  "Use this to generate documents from templates stored in a database.",
  {
    template: {
      type: "string",
      description: "IntentText template source with {{variable}} placeholders"
    },
    data: {
      type: "object",
      description: "JSON object with values to substitute into the template"
    },
    render: {
      type: "string",
      enum: ["none", "html", "print"],
      description: "Optionally render the merged result. Default: none (returns .it source)",
      default: "none"
    }
  },
  async ({ template, data, render = "none" }) => {
    const doc = parseAndMerge(template, data as Record<string, unknown>);
    if (render === "html") {
      return { content: [{ type: "text", text: renderHTML(doc) }] };
    }
    if (render === "print") {
      return { content: [{ type: "text", text: renderPrint(doc) }] };
    }
    return { content: [{ type: "text", text: documentToSource(doc) }] };
  }
);
```

### Tool: validate_document

```typescript
server.tool(
  "validate_document",
  "Validate an IntentText document for semantic correctness beyond syntax. " +
  "Checks for broken step references, missing required properties, unresolved " +
  "variables, and workflow logic errors. Returns a list of errors and warnings. " +
  "Always call this after generating a workflow document to catch issues before execution.",
  {
    source: {
      type: "string",
      description: "IntentText source string to validate"
    }
  },
  async ({ source }) => {
    const doc = parseIntentText(source);
    const result = validateDocument(doc);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          valid: result.valid,
          error_count: result.issues.filter(i => i.type === 'error').length,
          warning_count: result.issues.filter(i => i.type === 'warning').length,
          issues: result.issues,
        }, null, 2)
      }]
    };
  }
);
```

### Tool: query_document

```typescript
server.tool(
  "query_document",
  "Query an IntentText document for specific blocks by type, content, or properties. " +
  "Returns matching blocks as JSON. Use this to extract tasks, steps, decisions, " +
  "or any other block type from a document.",
  {
    source: {
      type: "string",
      description: "IntentText source string"
    },
    type: {
      type: "string",
      description: "Block type to filter by (e.g. 'task', 'step', 'gate'). " +
                   "Comma-separated for multiple types: 'step,gate,decision'"
    },
    content: {
      type: "string",
      description: "Substring to search for in block content (case-insensitive)"
    },
    section: {
      type: "string",
      description: "Only return blocks within this section (substring match on section title)"
    },
    limit: {
      type: "number",
      description: "Maximum number of results to return"
    }
  },
  async ({ source, type, content, section, limit }) => {
    const doc = parseIntentText(source);
    const query: QueryOptions = {};
    if (type) query.type = type.includes(',') ? type.split(',').map(t => t.trim()) : type;
    if (content) query.content = content;
    if (section) query.section = section;
    if (limit) query.limit = limit;
    const results = queryDocument(doc, query);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ count: results.length, blocks: results }, null, 2)
      }]
    };
  }
);
```

### Tool: diff_documents

```typescript
server.tool(
  "diff_documents",
  "Compare two versions of an IntentText document and return a semantic diff. " +
  "Shows which blocks were added, removed, or modified between versions. " +
  "More meaningful than a line diff — tells you what changed in the document's structure.",
  {
    before: {
      type: "string",
      description: "The original IntentText source"
    },
    after: {
      type: "string",
      description: "The updated IntentText source"
    }
  },
  async ({ before, after }) => {
    const docBefore = parseIntentText(before);
    const docAfter = parseIntentText(after);
    const diff = diffDocuments(docBefore, docAfter);
    return {
      content: [{ type: "text", text: JSON.stringify(diff, null, 2) }]
    };
  }
);
```

### Tool: document_to_source

```typescript
server.tool(
  "document_to_source",
  "Convert an IntentText JSON document back to .it source format. " +
  "Use this when you have a document stored as JSON (e.g. from a database) " +
  "and need to display or edit it as .it text.",
  {
    document: {
      type: "object",
      description: "An IntentText document JSON object (as produced by parse_intent_text)"
    }
  },
  async ({ document }) => {
    const source = documentToSource(document as IntentDocument);
    return { content: [{ type: "text", text: source }] };
  }
);
```

### Tool: extract_workflow

```typescript
server.tool(
  "extract_workflow",
  "Extract the execution graph from an IntentText workflow document. " +
  "Returns steps in topological order, dependency relationships, parallel batches, " +
  "and gate positions. Use this to understand how to execute a workflow before running it.",
  {
    source: {
      type: "string",
      description: "IntentText source containing workflow blocks (step:, decision:, gate:, etc.)"
    }
  },
  async ({ source }) => {
    const doc = parseIntentText(source);
    const workflow = extractWorkflow(doc);
    return {
      content: [{ type: "text", text: JSON.stringify(workflow, null, 2) }]
    };
  }
);
```

---

## PART 4 — extractWorkflow() (implement in @intenttext/core)

This function is part of `@intenttext/core` v2.2.0, not the MCP server.
Add it to `packages/core/src/workflow.ts` in the IntentText repo.

```typescript
export interface WorkflowStep {
  block: IntentBlock;
  dependsOn: string[];       // explicit step IDs from depends: property
  dependedOnBy: string[];    // step IDs that depend on this step
  isGate: boolean;           // true for gate: blocks
  isTerminal: boolean;       // true for result: blocks
  isParallel: boolean;       // true if this step is inside a parallel: group
}

export interface WorkflowGraph {
  // Steps that have no dependencies — can run first
  entryPoints: string[];

  // All steps by their id
  steps: Record<string, WorkflowStep>;

  // Execution order as batches — steps within a batch can run in parallel
  // Steps in batch N must all complete before batch N+1 begins
  executionOrder: string[][];

  // Gate positions — indices into executionOrder where execution must pause
  gatePositions: number[];

  // Whether the workflow has a result: block
  hasTerminal: boolean;

  // Any warnings about the graph structure
  warnings: string[];
}

export function extractWorkflow(doc: IntentDocument): WorkflowGraph
```

Algorithm:
1. Collect all `step:`, `gate:`, `decision:`, `parallel:`, `wait:`, `result:`,
   `checkpoint:`, `retry:` blocks as workflow nodes
2. Build dependency graph from `depends:` properties
3. Topological sort (Kahn's algorithm) — if cycle detected, add to warnings
4. Group into execution batches — steps in the same batch have no dependencies
   on each other
5. Mark gate positions as indices where execution must pause for human approval
6. Return graph

Export from `packages/core/src/index.ts` alongside the other new functions.

---

## PART 5 — README

Create `README.md` with:

### Installation

```bash
npm install -g @intenttext/mcp-server
# or use npx
npx @intenttext/mcp-server
```

### Configure with Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "intenttext": {
      "command": "npx",
      "args": ["@intenttext/mcp-server"]
    }
  }
}
```

### Configure with any MCP client

```json
{
  "command": "npx",
  "args": ["@intenttext/mcp-server"],
  "env": {}
}
```

### Available Tools

List all 8 tools with their descriptions and parameter tables.

### Example agent usage

Show a Claude prompt that uses the tools to generate and validate a workflow.

---

## PART 6 — TESTS

File: `tests/tools.test.ts`

Test each tool with real IntentText source. Use the MCP SDK's test utilities
or test the underlying functions directly (the tools are thin wrappers).

Minimum coverage:
- `parse_intent_text` returns valid JSON with blocks array
- `parse_intent_text` with safe=true never throws on garbage input
- `render_html` returns string containing `<html` or block elements
- `merge_template` resolves `{{variables}}` correctly
- `validate_document` catches a broken step reference
- `query_document` with type filter returns only matching blocks
- `diff_documents` detects an added block
- `document_to_source` returns string containing keywords
- `extract_workflow` returns executionOrder array

---

## PART 7 — CI/CD

File: `.github/workflows/publish.yml`

```yaml
name: Publish to npm

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## CONSTRAINTS

- No dependencies beyond `@intenttext/core` and `@modelcontextprotocol/sdk`
- All tool handlers must be async
- Tool descriptions must be clear enough for an AI agent to use without docs
- Never expose file system access — the server is document-in / document-out only
- TypeScript strict mode

*IntentText MCP Server — Implementation Prompt v1.0 — March 2026*
