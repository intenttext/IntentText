---
sidebar_position: 5
title: CLI
---

# CLI

The IntentText command-line tool handles parsing, rendering, querying, template merging, trust operations, and file management.

## Installation

```bash
npm install -g intenttext
```

Or use without installing:

```bash
npx intenttext <command>
```

## Quick start

```bash
# Parse a file
intenttext document.it

# Render to HTML
intenttext document.it --html --theme corporate

# Query deadlines
intenttext query ./contracts --type deadline --format table

# Seal a contract
intenttext seal contract.it --signer "Ahmed" --role "CEO"

# Verify integrity
intenttext verify contract.it

# Amend a frozen document
intenttext amend contract.it --section "Payment" --was "Net 30" --now "Net 15" --ref "Amendment #1"
```

## Common workflows

### Writing and rendering

```bash
# Write a .it file in your editor
# Render to see the output
intenttext document.it --html --theme minimal

# Iterate — edit the .it file, re-render
intenttext document.it --print --theme corporate

# Export to PDF
intenttext document.it --pdf --theme legal
```

### Template workflow

```bash
# Start with a Hub template
intenttext hub pull invoice-standard --domain finance

# Prepare your data
echo '{"client": "Acme Corp", "amount": 5000}' > data.json

# Merge and render
intenttext invoice-standard.it --data data.json --pdf --theme corporate
```

### Trust workflow

```bash
# Create the document with track: true in meta
# Get approvals (add approve: blocks manually or via editor)

# Seal when ready
intenttext seal contract.it --signer "Ahmed Al-Rashid" --role "CEO"

# Send to counterparty — they seal too
intenttext seal contract.it --signer "Maria Santos" --role "COO"

# Verify at any time
intenttext verify contract.it

# Amend if needed
intenttext amend contract.it --section "Scope" --now "Extended to Phase 2" --ref "Amendment #1"

# View complete history
intenttext history contract.it
```

### Organizational workflow

```bash
# Build indexes
intenttext index ./company --recursive

# Query across everything
intenttext query ./company --type deadline --format table
intenttext query ./company --type contact --format csv > contacts.csv

# Natural language queries
intenttext ask ./company "Which contracts expire this quarter?" --format text
```

## Configuration

### `~/.intenttext/` directory

| Path                      | Contents                 |
| ------------------------- | ------------------------ |
| `~/.intenttext/themes/`   | Local custom themes      |
| `~/.intenttext/auth.json` | Hub authentication token |
| `~/.intenttext/cache/`    | Cached Hub content       |

### Environment variables

| Variable            | Description                                            |
| ------------------- | ------------------------------------------------------ |
| `ANTHROPIC_API_KEY` | Required for `intenttext ask` (natural language query) |
| `INTENTTEXT_THEME`  | Default theme for all render commands                  |

## Full command reference

See [CLI Reference](/docs/reference/cli) for every command, flag, and option.
