---
sidebar_position: 13
title: Query System
---

# Query System

IntentText documents are queryable. Every block is structured data — you can filter, search, sort, and export without external databases.

## Single-file query

### CLI

```bash
dotit document.it --query "type=task owner=Ahmed due<2026-03-01 sort:due:asc limit:10"
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

### Dates are ISO 8601

Date comparisons (`due<2026-03-01`, `date>=2026-01-01`) work out of the box **when the values are ISO 8601** — `YYYY-MM-DD` or a full timestamp like `2026-03-01T09:00:00Z`. ISO dates sort and compare correctly as dates, not as strings.

This is why the format standardizes on ISO for the date-bearing property keys (`date`, `due`, `at`, `expires`, `issued`). Locale forms like `09/03/2026` are ambiguous (March 9 or September 3?) and break range queries — the semantic validator flags them with a `DATE_NOT_ISO` warning. Template placeholders (`due: {{invoice.dueDate}}`) are exempt.

```bash
# Every task due before March — works because due: values are ISO
dotit document.it --query "type=task due<2026-03-01 sort:due:asc"
```

### Queries cross languages

Arabic localized keyword names resolve to canonical types, so one query finds blocks regardless of the language they were written in. Given a quotation written in Arabic:

```intenttext
عنوان: عرض سعر — تأثيث المكتب الرئيسي
مهمة: اعتماد العرض | owner: أحمد | due: 2026-06-20
مهلة: انتهاء صلاحية العرض | date: 2026-07-15 | consequence: يلزم عرض جديد
```

`type=task due<2026-07-01` matches the `مهمة:` block exactly as it would an English `task:` line. Custom Arabic keywords and property keys are queryable too — `فئة=أثاث` filters `مصروف:` expense blocks by their Arabic category property.

## Multi-file query

Query `.it` files across an entire directory.

```bash
# Query all .it files in a directory
dotit query ./contracts --type approve --format table

# Glob pattern
dotit query "docs/*.it" --type deadline --format json

# Combined filters
dotit query ./hr --type contact --by "Sarah" --format csv
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
import { parseIntentText, queryDocument } from "@dotit/core";

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

The string syntax is also available programmatically via `queryBlocks` + `parseQuery`:

```javascript
import { parseIntentText, queryBlocks, parseQuery } from "@dotit/core";

const doc = parseIntentText(source);
const { blocks, matched } = queryBlocks(doc, parseQuery("type=task due<2026-03-01 sort:due:asc"));
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
dotit ask ./contracts "What tasks are overdue?" --format text
dotit ask ./hr "Who are the contacts in the Engineering section?" --format json
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
dotit index ./contracts --recursive
dotit index ./hr --recursive

# Query uses indexes automatically when available
dotit query ./contracts --type deadline --format table
```

See [Index Files](./index-file) for details on the `.it-index` format.
