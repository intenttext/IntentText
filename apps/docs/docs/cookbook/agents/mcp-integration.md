---
sidebar_position: 4
title: MCP Integration
---

# MCP Integration

## The problem

You want Claude or another LLM to read, write, query, and manage `.it` files directly — parse a document, render it, seal it, amend it — without custom API integration.

## The solution

The IntentText MCP server exposes every core operation as a tool. Connect it to Claude Desktop, VS Code with Copilot, or any MCP-compatible client.

### Installation

```bash
npm install -g @anthropic/intenttext-mcp
```

### Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "intenttext": {
      "command": "npx",
      "args": ["@anthropic/intenttext-mcp"]
    }
  }
}
```

### Configure VS Code

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "intenttext": {
      "command": "npx",
      "args": ["@anthropic/intenttext-mcp"]
    }
  }
}
```

## Available tools

| Tool              | Description                                 |
| ----------------- | ------------------------------------------- |
| `parse`           | Parse a `.it` file to JSON AST              |
| `render`          | Render to HTML with optional theme          |
| `render_print`    | Render to print HTML                        |
| `query`           | Query blocks in a document                  |
| `query_directory` | Query across a directory of `.it` files     |
| `merge`           | Merge a template with data                  |
| `validate`        | Validate against a schema                   |
| `seal`            | Sign and freeze a document                  |
| `verify`          | Verify document integrity                   |
| `history`         | Get document revision history               |
| `amend`           | Add a formal amendment to a frozen document |
| `diff`            | Compare two `.it` files                     |
| `source`          | Read raw `.it` source                       |

## Example conversation

**User**: "Read the contract at contracts/service-agreement.it and tell me when the payment deadline is."

**Claude** uses `parse` tool → reads the document → finds `deadline:` blocks:

> The payment deadline is April 15, 2026 (Net 30 from invoice date). The contract also has a renewal deadline of March 31, 2027.

**User**: "Amend the payment terms from Net 30 to Net 45."

**Claude** uses `amend` tool:

```json
{
  "file": "contracts/service-agreement.it",
  "section": "Payment",
  "was": "Net 30",
  "now": "Net 45",
  "ref": "Amendment #1"
}
```

> Done. Amendment #1 has been added to the contract. The original seal is preserved. The payment terms now read Net 45.

**User**: "Verify the contract is still valid."

**Claude** uses `verify` tool:

> ✓ Original seal is valid (sha256:f9a0b1c2, sealed 2026-03-22). One amendment applied: Amendment #1 — Payment terms changed from Net 30 to Net 45. Both signatures from Ahmed Al-Rashid (CEO) and Maria Santos (COO) are intact.

## The lightweight alternative: `intenttext ask`

If you don't need full MCP integration, use the built-in natural language query:

```bash
intenttext ask ./contracts "What are the payment terms?" --format text
intenttext ask ./hr "Who are the contacts in Engineering?" --format json
```

This uses the Anthropic API directly — no MCP server needed.

## Building agent pipelines with MCP

An agent can use MCP tools to execute a pipeline defined in a `.it` file:

1. `parse` the pipeline definition
2. Read `step:` blocks and their dependencies
3. Execute each step's `tool:` in dependency order
4. Check `gate:` conditions for branching
5. Write `audit:` blocks for logging
6. Mark `done:` when complete

The `.it` file is both the plan and the execution log.

## Next steps

- [Task Planning](./task-planning) — write agent task plans
- [Pipeline Definition](./pipeline-definition) — define pipelines with error handling
- [Agent Handoff](./agent-handoff) — pass context between agents
