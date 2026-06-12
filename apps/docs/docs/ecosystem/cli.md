---
sidebar_position: 5
title: CLI
---

# CLI

The IntentText command-line tool handles parsing, rendering, querying, template merging, trust operations, and file management.

## Installation

```bash
npm install -g @dotit/core
```

Or use without installing:

```bash
npx -p @dotit/core dotit <command>
```

## Quick start

```bash
# Parse a file
dotit document.it

# Render to HTML
dotit document.it --html --theme corporate

# Query deadlines
dotit query ./contracts --type deadline --format table

# Seal a contract
dotit seal contract.it --signer "Ahmed" --role "CEO"

# Verify integrity
dotit verify contract.it

# Amend a frozen document
dotit amend contract.it --section "Payment" --was "Net 30" --now "Net 15" --ref "Amendment #1"
```

## Common workflows

### Writing and rendering

```bash
# Write a .it file in your editor
# Render to see the output
dotit document.it --html --theme minimal

# Iterate — edit the .it file, re-render
dotit document.it --print --theme corporate

# Export to PDF
dotit document.it --pdf --theme legal
```

### Template workflow

```bash
# Start with a Hub template
dotit hub pull invoice-standard --domain finance

# Prepare your data
echo '{"client": "Acme Corp", "amount": 5000}' > data.json

# Merge and render
dotit invoice-standard.it --data data.json --pdf --theme corporate
```

### Trust workflow

```bash
# Create the document with track: true in meta
# Get approvals (add approve: blocks manually or via editor)

# Seal when ready
dotit seal contract.it --signer "Ahmed Al-Rashid" --role "CEO"

# Send to counterparty — they seal too
dotit seal contract.it --signer "Maria Santos" --role "COO"

# Verify at any time
dotit verify contract.it

# Amend if needed
dotit amend contract.it --section "Scope" --now "Extended to Phase 2" --ref "Amendment #1"

# View complete history
dotit history contract.it
```

### Organizational workflow

```bash
# Build indexes
dotit index ./company --recursive

# Query across everything
dotit query ./company --type deadline --format table
dotit query ./company --type contact --format csv > contacts.csv

# Natural language queries
dotit ask ./company "Which contracts expire this quarter?" --format text
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
| `ANTHROPIC_API_KEY` | Required for `dotit ask` (natural language query) |
| `INTENTTEXT_THEME`  | Default theme for all render commands                  |

## Full command reference

See [CLI Reference](/docs/reference/cli) for every command, flag, and option.
