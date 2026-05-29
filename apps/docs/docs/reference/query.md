---
sidebar_position: 13
title: Query System
---

# Query System

IntentText documents are queryable. Every block is structured data — you can filter, search, sort, and export without external databases.

## Single-file query

### CLI

```bash
intenttext document.it --query "type=task owner=Ahmed due<2026-03-01 sort:due:asc limit:10"
```

### Query string syntax

```
type=task owner=Ahmed due<2026-03-01 sort:due:asc limit:10
```

Space-separated conditions. All conditions are ANDed.

:::warning Whitespace limitation
Conditions are split on whitespace. Values that contain spaces (e.g., `owner=Ahmed Al-Rashid`) cannot be expressed in the string syntax — the parser will treat `Al-Rashid` as a separate (broken) token. Use the programmatic API with `QueryOptions` for multi-word values.
:::

### Operators

| Operator         | Description      | Example                   |
| ---------------- | ---------------- | ------------------------- |
| `=`              | Equality         | `type=task`               |
| `!=`             | Not equal        | `status!=done`            |
| `<`              | Less than        | `due<2026-03-01`          |
| `>`              | Greater than     | `value>1000`              |
| `<=`             | Less or equal    | `priority<=3`             |
| `>=`             | Greater or equal | `confidence>=0.8`         |
| `:contains`      | Substring match  | `content:contains=urgent` |
| `:startsWith`    | Prefix match     | `content:startsWith=API`  |
| `?`              | Field exists     | `priority?`               |
| `sort:field:dir` | Sort results     | `sort:due:asc`            |
| `limit:N`        | Limit results    | `limit:10`                |
| `offset:N`       | Pagination       | `offset:5`                |

## Multi-file query

Query `.it` files across an entire directory.

```bash
# Query all .it files in a directory
intenttext query ./contracts --type approve --format table

# Glob pattern
intenttext query "docs/*.it" --type deadline --format json

# Combined filters
intenttext query ./hr --type contact --by "Sarah" --format csv
```

### Flags

| Flag                        | Description                      |
| --------------------------- | -------------------------------- |
| `--type <type>`             | Filter by block type             |
| `--by <author>`             | Filter by author/attribution     |
| `--status <status>`         | Filter by status property        |
| `--section <name>`          | Filter by section                |
| `--content <text>`          | Substring content search         |
| `--format table\|json\|csv` | Output format (default: `table`) |

### Output formats

**Table** (default) — human-readable formatted output:

```
File            Type     Content              Section    Properties
contracts/a.it  approve  Legal review         Terms      by: Sarah Chen
contracts/b.it  deadline Q2 deliverables      Timeline   due: 2026-06-30
```

**JSON** — machine-readable array:

```json
[
  {
    "file": "contracts/a.it",
    "type": "approve",
    "content": "Legal review",
    "section": "Terms",
    "properties": { "by": "Sarah Chen" }
  }
]
```

**CSV** — spreadsheet-compatible:

```csv
file,type,content,section,by
contracts/a.it,approve,Legal review,Terms,Sarah Chen
```

## Programmatic API

```javascript
import { parseIntentText, queryDocument } from "intenttext";

const doc = parseIntentText(source);

const results = queryDocument(doc, {
  type: "deadline", // string or string[] (ORed)
  content: /Q[1-4]/, // string (substring) or RegExp
  properties: {
    // All must match (ANDed)
    status: "pending",
  },
  section: "Timeline", // string or RegExp
  limit: 10, // max results
});
```

### Return value

Array of matching `IntentBlock` objects:

```javascript
[
  {
    type: "deadline",
    content: "Q2 deliverables due",
    properties: { due: "2026-06-30", status: "pending" },
  },
];
```

## Natural language query

Ask questions in plain English. Uses an LLM to interpret the question and return structured answers.

```bash
intenttext ask ./contracts "What tasks are overdue?" --format text
intenttext ask ./hr "Who are the contacts in the Engineering section?" --format json
```

### Flags

| Flag                  | Description   |
| --------------------- | ------------- |
| `--format text\|json` | Output format |

:::note
Natural language query requires an API key for Anthropic. Set `ANTHROPIC_API_KEY` in your environment.
:::

## Querying across indexes

For large document collections, build indexes first, then query the composed index:

```bash
# Build indexes
intenttext index ./contracts --recursive
intenttext index ./hr --recursive

# Query uses indexes automatically when available
intenttext query ./contracts --type deadline --format table
```

See [Index Files](./index-file) for details on the `.it-index` format.
