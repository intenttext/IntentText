---
sidebar_position: 2
title: Querying Documents
---

# Querying Documents

## The problem

You have dozens (or hundreds) of `.it` files and need to find specific information — overdue deadlines, contacts at a company, unsigned contracts, pending tasks.

## The solution

IntentText has three query modes: single-file, multi-file, and natural language.

### Single-file query

Query blocks inside one document:

```bash
# All deadlines
intenttext contract.it --query "type=deadline"

# Pending tasks by Ahmed
intenttext plan.it --query "type=step status=pending owner=Ahmed"

# Sorted, limited
intenttext contract.it --query "type=deadline sort:due:asc limit:5"
```

### Multi-file query

Query across a directory:

```bash
# All contacts in active contracts
intenttext query ./contracts/active --type contact --format table

# Deadlines in April
intenttext query ./contracts --type deadline --content "April" --format json

# All approvals by Sarah
intenttext query ./contracts --type approve --by "Sarah Chen" --format table

# Metrics across all reports
intenttext query ./reports --type metric --format csv
```

### Natural language query

Ask questions in English:

```bash
intenttext ask ./contracts "Which contracts expire in Q2?" --format text
intenttext ask ./hr "Who are the engineering team leads?" --format json
intenttext ask ./finance "What invoices are unpaid?" --format text
```

## Output formats

### Table (default)

```bash
intenttext query ./contracts --type deadline --format table
```

```
File                    Type      Content              Section    Due
contracts/acme.it       deadline  Payment due          Payment    2026-04-15
contracts/globaltech.it deadline  Contract renewal     Timeline   2027-03-31
contracts/nextgen.it    deadline  Q1 deliverables      Scope      2026-06-30
```

### JSON

```bash
intenttext query ./contracts --type deadline --format json
```

```json
[
  {
    "file": "contracts/acme.it",
    "type": "deadline",
    "content": "Payment due",
    "section": "Payment",
    "properties": { "due": "2026-04-15", "status": "pending" }
  }
]
```

### CSV

```bash
intenttext query ./contracts --type deadline --format csv
```

```csv
file,type,content,section,due,status
contracts/acme.it,deadline,Payment due,Payment,2026-04-15,pending
```

Import directly into spreadsheets.

## Filter flags

| Flag        | Description        | Example               |
| ----------- | ------------------ | --------------------- |
| `--type`    | Block type         | `--type deadline`     |
| `--by`      | Author/attribution | `--by "Sarah Chen"`   |
| `--status`  | Status property    | `--status pending`    |
| `--section` | Section name       | `--section "Payment"` |
| `--content` | Substring search   | `--content "overdue"` |

All flags are ANDed — `--type deadline --status pending` finds blocks that are both deadlines and pending.

## Query operators (single-file)

| Operator         | Example                    |
| ---------------- | -------------------------- |
| `=`              | `type=deadline`            |
| `!=`             | `status!=done`             |
| `<`, `>`         | `due<2026-04-01`           |
| `<=`, `>=`       | `confidence>=0.8`          |
| `:contains`      | `content:contains=urgent`  |
| `:startsWith`    | `content:startsWith=API`   |
| `?`              | `priority?` (field exists) |
| `sort:field:dir` | `sort:due:asc`             |
| `limit:N`        | `limit:10`                 |

## Programmatic queries

```javascript
import { parseIntentText, queryDocument } from "intenttext";

const doc = parseIntentText(source);
const deadlines = queryDocument(doc, {
  type: "deadline",
  properties: { status: "pending" },
  limit: 10,
});
```

## Next steps

- [Indexing Folders](./indexing-folders) — speed up queries with indexes
- [Multi-Folder Query](./multi-folder-query) — how cross-folder queries compose
- [Contact Directory](./contact-directory) — build a contact directory from queries
