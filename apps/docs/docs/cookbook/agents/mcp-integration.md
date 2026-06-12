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
npm install -g @dotit/mcp
```

### Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

### Configure VS Code

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "intenttext": {
      "command": "npx",
      "args": ["-y", "@dotit/mcp"]
    }
  }
}
```

## Available tools

| Tool                   | Description                                  |
| ---------------------- | -------------------------------------------- |
| `parse_intent_text`    | Parse `.it` source into a structured document |
| `render_html`          | Render to styled HTML with optional theme    |
| `render_print`         | Render to print-optimised HTML               |
| `query_document`       | Query blocks by type, content, or properties |
| `merge_template`       | Merge a `{{variable}}` template with data    |
| `validate_document`    | Semantic validation beyond syntax            |
| `seal_document`        | Sign and freeze a document                   |
| `verify_document`      | Verify document integrity                    |
| `get_document_history` | Get document revision history                |
| `diff_documents`       | Semantic diff between two versions           |
| `document_to_source`   | Convert a parsed document back to `.it`      |
| `extract_workflow`     | Extract the execution graph from a workflow  |

## Example conversation

**User**: "Read the contract at contracts/service-agreement.it and tell me when the payment deadline is."

**Claude** uses the `parse_intent_text` tool → reads the document → finds `deadline:` blocks:

> The payment deadline is 2026-04-15 (Net 30 from invoice date). The contract also has a renewal deadline of 2027-03-31.

**User**: "Amend the payment terms from Net 30 to Net 45."

**Claude** appends an `amendment:` line (amendment lines are excluded from the document hash, so the seal is preserved):

```intenttext
amendment: Payment terms updated | section: Payment | was: Net 30 | now: Net 45 | ref: Amendment #1 | at: 2026-09-15
```

> Done. Amendment #1 has been added to the contract. The original seal is preserved. The payment terms now read Net 45.

**User**: "Verify the contract is still valid."

**Claude** uses the `verify_document` tool:

> ✓ Original seal is valid (sha256:f9a0b1c2, sealed 2026-03-22). One amendment applied: Amendment #1 — Payment terms changed from Net 30 to Net 45. Both signatures from Ahmed Al-Rashid (CEO) and Maria Santos (COO) are intact.

## The lightweight alternative: `dotit ask`

If you don't need full MCP integration, use the built-in natural language query:

```bash
dotit ask ./contracts "What are the payment terms?" --format text
dotit ask ./hr "Who are the contacts in Engineering?" --format json
```

This uses the Anthropic API directly — no MCP server needed.

## Building agent pipelines with MCP

An agent can use MCP tools to execute a pipeline defined in a `.it` file:

1. `extract_workflow` on the pipeline definition (or `parse_intent_text` for the raw blocks)
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
