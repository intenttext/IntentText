---
sidebar_position: 15
title: CLI Reference
---

# CLI Reference

IntentText ships a command-line tool for parsing, rendering, querying, sealing, and managing `.it` files.

## Installation

```bash
npm install -g intenttext
```

Or use with `npx`:

```bash
npx intenttext <command>
```

## Commands

### Parse

Parse a `.it` file to JSON.

```bash
intenttext document.it
```

Output: full JSON AST of the document.

---

### Render to HTML

```bash
intenttext document.it --html
intenttext document.it --html --theme corporate
intenttext document.it --html --output document.html
```

| Flag             | Description                                 |
| ---------------- | ------------------------------------------- |
| `--html`         | Render to HTML                              |
| `--theme <name>` | Apply a built-in theme                      |
| `--output`       | Save to file (same name, `.html` extension) |

---

### Print render

Generate print-optimized HTML with page layout, fonts, headers, footers, and watermarks.

```bash
intenttext document.it --print
intenttext document.it --print --theme legal
```

| Flag             | Description         |
| ---------------- | ------------------- |
| `--print`        | Generate print HTML |
| `--theme <name>` | Apply a theme       |

---

### Template merge

Merge a template with data to produce a document.

```bash
intenttext template.it --data data.json
intenttext template.it --data data.json --html
intenttext template.it --data data.json --html --theme corporate
intenttext template.it --data data.json --print
intenttext template.it --data data.json --pdf
```

| Flag             | Description                        |
| ---------------- | ---------------------------------- |
| `--data <file>`  | JSON data file for template merge  |
| `--html`         | Render merged output to HTML       |
| `--print`        | Render merged output to print HTML |
| `--pdf`          | Render to PDF (requires Puppeteer) |
| `--theme <name>` | Apply a theme                      |

---

### Convert to IntentText

Convert Markdown or HTML files to `.it` format.

```bash
intenttext document.md --to-it
intenttext page.html --to-it
intenttext document.md --to-it --output
```

| Flag       | Description                   |
| ---------- | ----------------------------- |
| `--to-it`  | Convert input to `.it` format |
| `--output` | Save to file                  |

---

### Single-file query

Query blocks within a single document.

```bash
intenttext document.it --query "type=task owner=Ahmed sort:due:asc limit:10"
```

| Flag                 | Description                 |
| -------------------- | --------------------------- |
| `--query "<string>"` | Query string with operators |

See [Query System](./query) for operator syntax.

---

### Multi-file query

Query across a directory of `.it` files.

```bash
intenttext query <dir> --type <type> --format <format>
intenttext query "docs/*.it" --type deadline --format table
```

| Flag                        | Description                      |
| --------------------------- | -------------------------------- |
| `--type <type>`             | Filter by block type             |
| `--by <author>`             | Filter by author                 |
| `--status <status>`         | Filter by status                 |
| `--section <name>`          | Filter by section                |
| `--content <text>`          | Substring content search         |
| `--format table\|json\|csv` | Output format (default: `table`) |

---

### Natural language query

Ask questions about documents in plain English.

```bash
intenttext ask <dir> "What deadlines are coming up?" --format text
intenttext ask <dir> "Who approved the service agreement?" --format json
```

| Flag                  | Description   |
| --------------------- | ------------- |
| `--format text\|json` | Output format |

Requires `ANTHROPIC_API_KEY` environment variable.

---

### Validate

Validate a document against a built-in schema.

```bash
intenttext document.it --validate project
intenttext document.it --validate meeting
intenttext document.it --validate article
intenttext document.it --validate checklist
intenttext document.it --validate agentic
```

| Schema      | Description                                            |
| ----------- | ------------------------------------------------------ |
| `project`   | Project documents — expects title, sections, deadlines |
| `meeting`   | Meeting notes — expects title, attendees, action items |
| `article`   | Articles — expects title, summary, sections            |
| `checklist` | Checklists — expects title, items                      |
| `agentic`   | Agent pipelines — expects steps, gates                 |

---

### Theme management

List and inspect built-in themes.

```bash
intenttext theme list
intenttext theme info corporate
intenttext theme info legal
```

| Subcommand          | Description                                  |
| ------------------- | -------------------------------------------- |
| `theme list`        | List all 8 built-in themes with descriptions |
| `theme info <name>` | Show theme metadata and color palette        |

**Built-in themes**: `corporate`, `minimal`, `warm`, `technical`, `print`, `legal`, `editorial`, `dark`

---

### Build index

Build shallow `.it-index` files for fast queries.

```bash
intenttext index ./contracts
intenttext index ./company --recursive
```

| Flag          | Description                     |
| ------------- | ------------------------------- |
| `--recursive` | Build indexes in all subfolders |

See [Index Files](./index-file) for index architecture.

---

### Seal (sign + freeze)

Digitally sign and freeze a document in one step.

```bash
intenttext seal document.it --signer "Ahmed Al-Rashid" --role "CEO"
```

| Flag              | Description            |
| ----------------- | ---------------------- |
| `--signer <name>` | Signer name (required) |
| `--role <title>`  | Signer role            |

This adds `sign:` and `freeze:` blocks to the document with a computed content hash.

---

### Verify

Check document integrity — validate the seal hash against current content.

```bash
intenttext verify document.it
```

Output:

- **Valid**: seal is intact, content matches hash
- **Invalid**: content has been modified since sealing
- **Amendments**: lists all amendments applied after freeze

---

### History

View the change history of a tracked document.

```bash
intenttext history document.it
intenttext history document.it --json
intenttext history document.it --by "Ahmed"
intenttext history document.it --section "Payment"
```

| Flag               | Description       |
| ------------------ | ----------------- |
| `--json`           | Output as JSON    |
| `--by <author>`    | Filter by author  |
| `--section <name>` | Filter by section |

---

### Amend

_Since v2.11_

Add a formal amendment to a frozen document.

```bash
intenttext amend document.it \
  --section "Payment" \
  --was "Net 30" \
  --now "Net 15" \
  --ref "Amendment #1" \
  --by "Ahmed Al-Rashid"
```

| Flag               | Description                      |
| ------------------ | -------------------------------- |
| `--section <name>` | Section being amended (required) |
| `--was <text>`     | Previous value                   |
| `--now <text>`     | New value (required)             |
| `--ref <id>`       | Amendment reference (required)   |
| `--by <author>`    | Amendment author                 |

**Requirements**: The document must be frozen first. Returns an error if no `freeze:` block exists.

---

## Exit codes

| Code | Meaning                                           |
| ---- | ------------------------------------------------- |
| `0`  | Success                                           |
| `1`  | Parse error, validation failure, or general error |

## Global behavior

- All commands read from stdin if no file argument is provided
- `--output` flag writes to a file instead of stdout
- JSON output is pretty-printed by default
