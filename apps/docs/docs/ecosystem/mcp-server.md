---
sidebar_position: 6
title: MCP Server
---

# MCP Server

The IntentText MCP server gives LLMs direct access to parsing, rendering, querying, trust operations, and template merging through the Model Context Protocol.

## Installation

```bash
npm install -g @anthropic/intenttext-mcp
```

## Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "intenttext": {
      "command": "intenttext-mcp",
      "args": ["--stdio"]
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
      "command": "intenttext-mcp",
      "args": ["--stdio"]
    }
  }
}
```

### HTTP mode

For remote or shared setups:

```bash
intenttext-mcp --http --port 3847
```

## Available tools

### Core tools

| Tool                | Description                    |
| ------------------- | ------------------------------ |
| `intenttext_parse`  | Parse a `.it` file into AST    |
| `intenttext_render` | Render to HTML, text, or JSON  |
| `intenttext_source` | Generate `.it` source from AST |
| `intenttext_merge`  | Merge template with data       |

### Query tools

| Tool               | Description                                             |
| ------------------ | ------------------------------------------------------- |
| `intenttext_query` | Structured queries across files                         |
| `intenttext_ask`   | Natural language queries (requires `ANTHROPIC_API_KEY`) |

### Trust tools

| Tool                 | Description                                |
| -------------------- | ------------------------------------------ |
| `intenttext_seal`    | Seal a document with signer identity       |
| `intenttext_verify`  | Verify document integrity                  |
| `intenttext_history` | Get trust history                          |
| `intenttext_amend`   | Create formal amendment to frozen document |

### Diff tools

| Tool              | Description                             |
| ----------------- | --------------------------------------- |
| `intenttext_diff` | Structural diff between two `.it` files |

## Tool examples

### Parse and render

```
User: "Render this invoice as HTML with the corporate theme"

Claude calls: intenttext_render({
  content: "title: Invoice #2847\n...",
  format: "html",
  theme: "corporate"
})
```

### Query across documents

```
User: "What contracts have deadlines this month?"

Claude calls: intenttext_query({
  path: "./contracts",
  type: "deadline",
  filter: "this_month",
  format: "table"
})
```

### Seal a contract

```
User: "Seal this NDA as Maria Santos, COO"

Claude calls: intenttext_seal({
  path: "nda.it",
  signer: "Maria Santos",
  role: "COO"
})
```

### Amend a frozen document

```
User: "Amend the payment terms in section 3 from Net 30 to Net 15"

Claude calls: intenttext_amend({
  path: "contract.it",
  section: "Payment Terms",
  was: "Net 30",
  now: "Net 15",
  ref: "Amendment #1"
})
```

## Lightweight alternative: `intenttext ask`

For environments where MCP isn't available, the CLI provides `intenttext ask` as a direct query interface:

```bash
intenttext ask ./company "Which invoices are overdue?" --format text
```

This calls the LLM directly with your documents as context. Useful for scripts and CI pipelines.

## Security

The MCP server operates on the local filesystem. It has the same access as the user running it — no additional permissions are granted. Trust operations (seal, verify, amend) use the same SHA-256 integrity system as the CLI.

## Source

Repository: [intenttext-mcp](https://github.com/intenttext/intenttext-mcp)
