---
sidebar_position: 14
title: Index Files
---

# Index Files (`.it-index`)

The `.it-index` file is a shallow index of every `.it` file in a single folder. It enables fast queries across large document collections without parsing every file on every request.

## Architecture: always shallow

Each `.it-index` covers **only** the `.it` files in its immediate folder. Never subfolders. This is by design:

```
company/
├── contracts/
│   ├── service-agreement.it
│   ├── nda-template.it
│   └── .it-index          ← indexes only contracts/
├── hr/
│   ├── offer-letter.it
│   ├── policy-manual.it
│   └── .it-index          ← indexes only hr/
└── finance/
    ├── q1-budget.it
    ├── q2-forecast.it
    └── .it-index           ← indexes only finance/
```

Why shallow? Because folders are organizational boundaries. An HR folder might have different access controls than a finance folder. A shallow index respects these boundaries — you compose them explicitly when you need cross-folder queries.

## Building indexes

### CLI

```bash
# Build a shallow index for one folder
intenttext index ./contracts

# Build indexes in all subfolders recursively
intenttext index ./company --recursive
```

### Programmatic API

```javascript
import { buildShallowIndex } from "intenttext";

const index = buildShallowIndex(folder, files, coreVersion);
```

## Index structure

```json
{
  "version": "1",
  "scope": "shallow",
  "folder": "contracts",
  "built_at": "2026-03-15T10:30:00Z",
  "core_version": "3.1.0",
  "files": {
    "service-agreement.it": {
      "hash": "abc123",
      "modified_at": "2026-03-14T09:00:00Z",
      "metadata": {
        "title": "Service Agreement — Acme Corp",
        "type": "contract",
        "domain": "legal",
        "track": "true"
      },
      "blocks": [
        {
          "type": "contact",
          "content": "Sarah Chen",
          "section": "Parties",
          "properties": { "role": "General Counsel", "email": "sarah@acme.co" }
        },
        {
          "type": "deadline",
          "content": "Contract renewal",
          "section": "Timeline",
          "properties": { "due": "2027-03-01" }
        }
      ]
    }
  }
}
```

### What's indexed

Every block type **except** layout and structural blocks:

- **Indexed**: `text:`, `quote:`, `contact:`, `deadline:`, `metric:`, `approve:`, `sign:`, `freeze:`, `step:`, `gate:`, `policy:`, `amendment:`, etc.
- **Skipped**: `font:`, `page:`, `header:`, `footer:`, `watermark:`, `meta:`, `break:`, `toc:`

### Index entry fields

| Field                 | Description                                    |
| --------------------- | ---------------------------------------------- |
| `hash`                | Simple hash for staleness detection            |
| `modified_at`         | File's last modification timestamp             |
| `metadata`            | Document metadata (title, type, domain, track) |
| `blocks[]`            | Array of indexed blocks                        |
| `blocks[].type`       | Block keyword                                  |
| `blocks[].content`    | Block content text                             |
| `blocks[].section`    | Section the block appears in                   |
| `blocks[].properties` | All block properties                           |

## Staleness detection

The index tracks file hashes. When you run `intenttext index`, it checks:

1. Are there new `.it` files not in the index?
2. Have any indexed files been modified (hash mismatch)?
3. Have any indexed files been deleted?

Only stale entries are rebuilt — unchanged files are skipped.

```javascript
import { checkStaleness, updateIndex } from "intenttext";

const { changed, removed, added } = checkStaleness(existingIndex, currentFiles);
const updated = updateIndex(existingIndex, changedFiles, removedFiles);
```

## Composing indexes

To query across folders, compose multiple shallow indexes:

```javascript
import { composeIndexes, queryComposed } from "intenttext";

const composed = composeIndexes(
  [contractsIndex, hrIndex, financeIndex],
  "company",
);

const results = queryComposed(composed, {
  type: "deadline",
  section: "Timeline",
});
```

### CLI

Multi-folder queries compose indexes automatically when `.it-index` files exist:

```bash
# Queries contracts/ and uses .it-index if available
intenttext query ./contracts --type deadline --format table
```

## Real-world example: HR department

```
hr/
├── employees/
│   ├── ahmed-offer.it
│   ├── sarah-offer.it
│   ├── james-review.it
│   └── .it-index
├── policies/
│   ├── remote-work.it
│   ├── pto-policy.it
│   ├── code-of-conduct.it
│   └── .it-index
└── templates/
    ├── offer-letter.it
    ├── review-template.it
    └── .it-index
```

```bash
# Build all indexes
intenttext index ./hr --recursive

# Find all deadlines across HR
intenttext query ./hr/employees --type deadline --format table

# Find all contacts
intenttext query ./hr/employees --type contact --format json

# Find policies by topic
intenttext query ./hr/policies --content "remote" --format table
```

Each `.it-index` covers only its folder. The `--recursive` flag builds one per subfolder, not a single giant index.
