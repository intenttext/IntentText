---
sidebar_position: 6
title: MCP Server
---

# MCP Server

The IntentText MCP server gives LLMs direct access to parsing, rendering, querying, trust operations, and template merging through the Model Context Protocol.

## Installation

```bash
npm install -g @dotit/mcp
```

## Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "intenttext": {
      "command": "intenttext-mcp"
    }
  }
}
```

Or run it without a global install via `npx`:

```json
{
  "mcpServers": {
    "intenttext": {
      "command": "npx",
      "args": ["-y", "@dotit/mcp"]
    }
  }
}
```

### VS Code (Copilot)

Add to your `.vscode/mcp.json`:

```json
{
  "servers": {
    "intenttext": {
      "command": "intenttext-mcp"
    }
  }
}
```

### HTTP mode

For remote or shared setups, the package ships a second binary that serves the same tools over Streamable HTTP:

```bash
PORT=3847 intenttext-mcp-http
```

`PORT` defaults to 3000.

## Available tools

All tools operate on IntentText source strings — pass the `.it` text in, get JSON or rendered output back.

### Parse & serialize

| Tool                 | Parameters             | Description                                                                       |
| -------------------- | ---------------------- | --------------------------------------------------------------------------------- |
| `parse_intent_text`  | `source`, `safe`       | Parse `.it` source into a structured JSON document. `safe` (default `true`) collects warnings instead of throwing |
| `document_to_source` | `document`             | Convert a document JSON object back to `.it` source text                          |

### Render

| Tool           | Parameters        | Description                                                                  |
| -------------- | ----------------- | ----------------------------------------------------------------------------- |
| `render_html`  | `source`, `theme?` | Render to styled HTML. Optional built-in theme: `corporate`, `minimal`, `warm`, `technical`, `print`, `legal`, `editorial`, `dark` |
| `render_print` | `source`, `theme?` | Print-optimised HTML with `@media print` CSS — applies `font:` and `page:` blocks; suitable for PDF generation. Same optional `theme` |

### Templates

| Tool             | Parameters                                | Description                                                       |
| ---------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| `merge_template` | `template`, `data`, `render?`, `missing?` | Merge `{{variable}}` placeholders with a data object. `render`: `none` (default, returns `.it` source), `html`, or `print`. `missing`: `keep` leaves unresolved placeholders visible (default), `blank` removes them so optional fields never print |

### Validate & query

| Tool                | Parameters                                | Description                                                          |
| ------------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| `validate_document` | `source`                                  | Semantic validation beyond syntax: broken step references, missing required properties, unresolved variables, workflow logic errors |
| `query_document`    | `source`, `type?`, `content?`, `section?`, `limit?` | Filter blocks by type (comma-separated for multiple: `step,gate`), content substring, or section |
| `diff_documents`    | `before`, `after`                         | Semantic diff between two versions — which blocks were added, removed, or modified |

### Workflow

| Tool               | Parameters | Description                                                                |
| ------------------ | ---------- | --------------------------------------------------------------------------- |
| `extract_workflow` | `source`   | Extract the execution graph: steps in topological order, dependencies, parallel batches, gate positions |

### Trust

| Tool                   | Parameters                       | Description                                                  |
| ---------------------- | -------------------------------- | -------------------------------------------------------------- |
| `seal_document`        | `source`, `signer`, `role?`      | Seal with a cryptographic signature — appends `sign:` and `freeze:` blocks, returns sealed source + hash |
| `verify_document`      | `source`                         | Verify integrity of a sealed document — reports tampering    |
| `get_document_history` | `source`, `block_id?`, `section?` | Revision history of a tracked document: what changed, who, when |

## Tool examples

### Parse and render

```
User: "Render this invoice as HTML with the corporate theme"

Claude calls: render_html({
  source: "title: Invoice #2847\n...",
  theme: "corporate"
})
```

### Merge a template

```
User: "Generate the invoice for Acme from the standard template"

Claude calls: merge_template({
  template: "title: Invoice {{number}}\n...",
  data: { "number": "INV-2847", "client": "Acme Corp" },
  render: "print",
  missing: "blank"
})
```

### Query a document

```
User: "What tasks are in this project plan?"

Claude calls: query_document({
  source: "title: Project Plan\n...",
  type: "task",
  limit: 20
})
```

### Seal a contract

```
User: "Seal this NDA as Maria Santos, COO"

Claude calls: seal_document({
  source: "title: NDA\n...",
  signer: "Maria Santos",
  role: "COO"
})
```

The result includes the sealed source — store it exactly as returned (the hash covers the exact bytes).

### Validate a generated workflow

```
User: "Check this deployment workflow before we run it"

Claude calls: validate_document({
  source: "step: Build\nstep: Deploy | after: Build\n..."
})
```

## Security

The MCP server is stateless: every tool takes document source as input and returns results — it does not read or write your filesystem. Trust operations (seal, verify, history) use the same SHA-256 integrity system as the rest of the toolchain.

## Source

Repository: [intenttext-mcp](https://github.com/intenttext/intenttext-mcp) · npm: [`@dotit/mcp`](https://www.npmjs.com/package/@dotit/mcp) (1.0.0 — formerly `@intenttext/mcp`, now deprecated with a pointer)
