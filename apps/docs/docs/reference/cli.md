---
sidebar_position: 15
title: CLI Reference
---

# CLI Reference

Complete command and flag reference for `dotit`, the command-line tool that ships
with `@dotit/core`. For a guided tour with worked examples — including the full
trust walkthrough — see the [CLI guide](/docs/ecosystem/cli).

## Installation

```bash
npm install -g @dotit/core
```

Or with `npx`:

```bash
npx -p @dotit/core dotit <command>
```

## Commands

### Parse

Parse a `.it` file and print the full JSON AST. This is the default when no other
flag is given.

```bash
dotit document.it
```

---

### Render to HTML

```bash
dotit document.it --html
dotit document.it --html --theme corporate
dotit document.it --html --output
```

| Flag             | Description                                            |
| ---------------- | ------------------------------------------------------ |
| `--html`         | Render to HTML (printed to stdout)                     |
| `--theme <name>` | Apply a built-in theme                                 |
| `--output`       | Save next to the source as `<name>.html` instead       |

---

### Print render

Print-optimized HTML: `@page` size and margins, running header/footer with live
page counters, multi-page table handling.

```bash
dotit document.it --print
dotit document.it --print --theme legal
dotit document.it --print --output
```

| Flag             | Description                                          |
| ---------------- | ---------------------------------------------------- |
| `--print`        | Generate print HTML (stdout)                         |
| `--theme <name>` | Apply a theme                                        |
| `--output`       | Save next to the source as `<name>-print.html`       |

---

### PDF

```bash
dotit document.it --pdf
dotit template.it --data data.json --pdf
```

Saves `<name>.pdf` next to the source (A4, backgrounds printed). Requires
Puppeteer: `npm install puppeteer` — without it the command prints install
guidance and exits 1. For server-side/batch PDF generation use
[`@dotit/pdf`](/docs/ecosystem/erp-integration) instead.

---

### Template merge

Merge a template with JSON data, then output in any render mode.

```bash
dotit template.it --data data.json
dotit template.it --data data.json --html --theme corporate
dotit template.it --data data.json --print
dotit template.it --data data.json --pdf
```

| Flag            | Description                       |
| --------------- | --------------------------------- |
| `--data <file>` | JSON data file for template merge |

Combines with `--html`, `--print`, `--pdf`, `--theme`, and `--output`.

---

### Convert to IntentText

Convert Markdown or HTML to `.it`. The converter is chosen by file extension
(`.html`/`.htm` → HTML converter, anything else → Markdown).

```bash
dotit document.md --to-it
dotit page.html --to-it
dotit document.md --to-it --output    # saves document.it next to the source
```

---

### Single-file query

Query blocks within one document using the operator syntax.

```bash
dotit document.it --query "type=task owner=Ahmed due<2026-03-01 sort:due:asc limit:10"
```

Operators: `=` `!=` `<` `>` `<=` `>=` `:contains` `:startsWith` `?` (exists), plus
`sort:field:dir`, `limit:N`, `offset:N`. Date comparisons work when values are ISO
8601. Conditions are ANDed; values with spaces cannot be expressed in the string
syntax (use the [programmatic API](./query#programmatic-api)). Full syntax:
[Query System](./query).

---

### Multi-file query

Query a directory tree (or glob) of `.it` files. Directory queries are backed by
per-folder `.it-index` caches that refresh automatically.

```bash
dotit query <dir> --type deadline --format table
dotit query "docs/*.it" --type sign --format json
```

| Flag                        | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| `--type <type>`             | Filter by block type (`task`, `deadline`, custom, …) |
| `--by <name>`               | Exact match on a block's `by:` property              |
| `--status <status>`         | Exact match on a block's `status:` property          |
| `--section <name>`          | Substring match on the containing section            |
| `--content <text>`          | Substring match on block content                     |
| `--format table\|json\|csv` | Output format (default: `table`)                     |

`--by` and `--status` match properties on the block line itself (e.g.
`approve: … | by: Sara`, `freeze: | status: locked`) — not fields of the `meta:`
block, which is excluded from indexes.

---

### Build index

Build or refresh the shallow `.it-index` for a folder. Indexes are also
self-healing — a directory query refreshes stale entries automatically.

```bash
dotit index ./contracts
dotit index ./company --recursive
```

| Flag          | Description                                          |
| ------------- | ---------------------------------------------------- |
| `--recursive` | Index every subfolder that contains `.it` files      |

See [Index Files](./index-file) for the architecture.

---

### Natural language query

```bash
dotit ask <dir> "Which contracts renew before December?"
dotit ask <dir> "Who approved the service agreement?" --format json
```

| Flag                  | Description                      |
| --------------------- | -------------------------------- |
| `--format text\|json` | Output format (default: `text`)  |

Requires the `ANTHROPIC_API_KEY` environment variable; without it the command
prints an error explaining how to set it.

---

### Validate

Validate against a built-in schema. Exits 0 when valid, 1 when not.

```bash
dotit document.it --validate project
```

| Schema      | Description                                          |
| ----------- | ---------------------------------------------------- |
| `project`   | Project documents — title required, typed task props |
| `meeting`   | Meeting notes — title and sections required          |
| `article`   | Articles — title and summary required, strict blocks |
| `checklist` | Checklists — title plus task/done items only         |
| `agentic`   | Agent workflows — steps, gates, statuses             |

---

### Theme management

```bash
dotit theme list
dotit theme info corporate
```

| Subcommand          | Description                                       |
| ------------------- | ------------------------------------------------- |
| `theme list`        | List the 8 built-in themes with descriptions      |
| `theme info <name>` | Show a theme's fonts, sizes, and colors           |

Built-in themes: `corporate`, `minimal`, `warm`, `technical`, `print`, `legal`,
`editorial`, `dark`.

---

### Seal

Compute the document hash and freeze the document, optionally recording a signer.
Writes the file in place. (Hash algorithm and the full trust model:
[CLI guide → Trust](/docs/ecosystem/cli#trust-a-complete-walkthrough).)

```bash
dotit seal document.it --signer "Fahad Al-Thani" --role "Managing Director"
dotit seal generated.it --no-sign
```

| Flag              | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| `--signer <name>` | Recorded signer identity (required unless `--no-sign`)       |
| `--role <title>`  | Signer role, recorded on the `sign:` line                    |
| `--no-sign`       | Write only the `freeze:` line (machine-issued documents)     |

Appends a `sign:` line (unless `--no-sign`) and a `freeze:` line, both carrying
the SHA-256 content hash and an ISO timestamp. Sealing an already-sealed document
adds another signature without invalidating earlier ones.

---

### Verify

Recompute the content hash and compare it against the `freeze:` block.

```bash
dotit verify document.it
```

Output and exit codes:

| Result        | Output                                                | Exit |
| ------------- | ----------------------------------------------------- | ---- |
| Intact        | `✅ Document intact` + sealed time, signers, hash      | 0    |
| Modified      | `❌ Document has been modified` + expected/current hash | 1   |
| Not sealed    | `⚠️ Document is not sealed` warning                    | 0    |

Each signer is reported individually — ✅ when that signer's recorded hash matches
the frozen hash.

---

### Amend

Add a formal `amendment:` line to a frozen document. Amendment lines are excluded
from the hash, so the seal stays intact. Interactive: shows the exact line to be
inserted and asks for confirmation.

```bash
dotit amend document.it "Late fee revised" \
  --section "Scope" --was "2% late fee" --now "1.5% late fee" \
  --ref "Amendment #1" --by "Fahad Al-Thani"
```

| Argument / flag    | Description                                  |
| ------------------ | -------------------------------------------- |
| `"description"`    | Optional amendment description (positional)  |
| `--now <text>`     | New value (**required**)                     |
| `--ref <id>`       | Amendment reference (**required**)           |
| `--section <name>` | Section being amended                        |
| `--was <text>`     | Previous value                               |
| `--by <name>`      | Amendment author                             |

Errors (exit 1) if the document has no `freeze:` block — seal first.

---

### History

Read the append-only audit log (`revision:` entries below the `history:`
boundary).

```bash
dotit history document.it
dotit history document.it --json
dotit history document.it --by "Sara Haddad"
dotit history document.it --section "Limits"
dotit history document.it --block <id>
```

| Flag               | Description                  |
| ------------------ | ---------------------------- |
| `--json`           | Output as JSON               |
| `--by <name>`      | Filter by revision author    |
| `--section <name>` | Filter by section            |
| `--block <id>`     | Filter by block registry ID  |

---

## Exit codes

| Code | Meaning                                                               |
| ---- | --------------------------------------------------------------------- |
| `0`  | Success — including `verify` on an intact or unsealed document        |
| `1`  | Error: file not found, parse/render error, validation failure, broken seal, missing required flag |
