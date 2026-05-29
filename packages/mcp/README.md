# @intenttext/mcp-server

<!-- mcp-name: io.github.intenttext/intenttext-mcp -->

## What is IntentText?

IntentText (`.it`) is a plain-text document format where every line has a declared semantic type — making documents simultaneously human-writable and natively JSON. A `task:` is a task. A `step:` is an executable workflow step. Every block parses to typed, deterministic JSON with no interpretation required.

This MCP server gives any AI agent the ability to work with IntentText documents as native tool calls.

**Deployed instance:** [https://intenttext-mcp.onrender.com](https://intenttext-mcp.onrender.com) — use this URL directly in any MCP client that supports remote servers.

---

MCP server for [IntentText](https://github.com/intenttext/IntentText) — parse, validate, query, render, and generate `.it` documents from any AI agent.

With this server running, Claude, GPT, or any MCP-compatible agent can work with IntentText documents as native tool calls — without needing to understand the format itself.

## Installation

```bash
npm install -g @intenttext/mcp-server
# or use npx (no install required)
npx @intenttext/mcp-server
```

## Configure with Claude Desktop

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

## Configure with any MCP client

```json
{
  "command": "npx",
  "args": ["@intenttext/mcp-server"],
  "env": {}
}
```

## HTTP Wrapper (for hosted MCP URLs)

This package also includes an HTTP wrapper so you can deploy it from this GitHub repo to platforms like Railway/Render/Fly and provide a URL (for directories that ask for `https://.../mcp`).

```bash
npm install
npm run build
npm run start:http
```

Endpoints:

- `POST /mcp` - MCP Streamable HTTP endpoint
- `GET /health` - health check endpoint

Environment variables:

- `PORT` (default `3000`)
- `HOST` (default `0.0.0.0`)

Note: GitHub itself cannot host a long-running Node server process. Keep the wrapper code in GitHub, then deploy it to a runtime provider and use that public URL in Smithery forms.

The public deployment is available at **https://intenttext-mcp.onrender.com**.

## Available Tools

### parse_intent_text

Parse an IntentText (.it) source string into a structured JSON document.

| Parameter | Type    | Description                                                              |
| --------- | ------- | ------------------------------------------------------------------------ |
| `source`  | string  | The IntentText source string to parse                                    |
| `safe`    | boolean | If true, never throw — returns warnings instead of errors. Default: true |

### render_html

Render an IntentText source string to styled HTML.

| Parameter | Type   | Description                           |
| --------- | ------ | ------------------------------------- |
| `source`  | string | IntentText source string (.it format) |

### render_print

Render an IntentText document to print-optimised HTML with @media print CSS. Suitable for PDF generation.

| Parameter | Type   | Description              |
| --------- | ------ | ------------------------ |
| `source`  | string | IntentText source string |

### merge_template

Merge an IntentText template (containing `{{variable}}` placeholders) with a data object.

| Parameter  | Type   | Description                                                                      |
| ---------- | ------ | -------------------------------------------------------------------------------- |
| `template` | string | IntentText template source with `{{variable}}` placeholders                      |
| `data`     | object | JSON object with values to substitute into the template                          |
| `render`   | string | `"none"` (default), `"html"`, or `"print"` — optionally render the merged result |

### validate_document

Validate an IntentText document for semantic correctness. Checks for broken step references, missing required properties, unresolved variables, and workflow logic errors.

| Parameter | Type   | Description                          |
| --------- | ------ | ------------------------------------ |
| `source`  | string | IntentText source string to validate |

### query_document

Query an IntentText document for specific blocks by type, content, or properties.

| Parameter | Type   | Description                                               |
| --------- | ------ | --------------------------------------------------------- |
| `source`  | string | IntentText source string                                  |
| `type`    | string | Block type filter — e.g. `"task"`, `"step,gate,decision"` |
| `content` | string | Substring to search for in block content                  |
| `section` | string | Only return blocks within this section                    |
| `limit`   | number | Maximum number of results to return                       |

### diff_documents

Compare two versions of an IntentText document and return a semantic diff.

| Parameter | Type   | Description                    |
| --------- | ------ | ------------------------------ |
| `before`  | string | The original IntentText source |
| `after`   | string | The updated IntentText source  |

### document_to_source

Convert an IntentText JSON document back to `.it` source format.

| Parameter  | Type   | Description                                                           |
| ---------- | ------ | --------------------------------------------------------------------- |
| `document` | object | An IntentText document JSON object (as produced by parse_intent_text) |

### extract_workflow

Extract the execution graph from an IntentText workflow document. Returns steps in topological order, dependency relationships, parallel batches, and gate positions.

| Parameter | Type   | Description                                                                  |
| --------- | ------ | ---------------------------------------------------------------------------- |
| `source`  | string | IntentText source containing workflow blocks (step:, decision:, gate:, etc.) |

## Example: Agent Workflow

```
User: Create a deployment workflow for a web app

Agent calls: parse_intent_text with a generated .it document
Agent calls: validate_document to check for issues
Agent calls: extract_workflow to get the execution graph
Agent calls: render_html to produce a visual version
```

## License

MIT
