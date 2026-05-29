---
sidebar_position: 4
title: Multi-Folder Query
---

# Multi-Folder Query

## The problem

Your documents are spread across multiple folders — contracts, HR, finance. Each folder has its own `.it-index`. You need to query across all of them without building one giant index.

## The solution

IntentText indexes are **always shallow** — each `.it-index` knows only the files in its own folder. When you query a parent folder, the CLI composes the relevant indexes automatically.

## The shallow architecture

```
hr/
├── .it-index              ← knows: policy.it ONLY
├── policy.it
├── profiles/
│   ├── .it-index          ← knows: ahmed.it, sarah.it ONLY
│   ├── ahmed.it
│   └── sarah.it
└── templates/
    ├── .it-index          ← knows: offer-letter.it ONLY
    └── offer-letter.it
```

Each `.it-index` covers only its immediate folder. `hr/.it-index` knows about `policy.it` but not `ahmed.it` or `offer-letter.it`.

## Why shallow?

1. **Access control** — HR profiles and finance budgets should be separate. A single index would mix them.
2. **Invalidation** — editing one file only invalidates its folder's index. Everything else stays fresh.
3. **Speed** — small indexes are fast to read and fast to rebuild.
4. **Composition** — you choose which folders to include in a query.

## How cross-folder queries work

### Step 1: Build indexes

```bash
intenttext index ./hr --recursive
```

This creates:

- `hr/.it-index` — indexes `policy.it`
- `hr/profiles/.it-index` — indexes `ahmed.it`, `sarah.it`
- `hr/templates/.it-index` — indexes `offer-letter.it`

### Step 2: Query

```bash
intenttext query ./hr --type contact --format table
```

The CLI:

1. Finds all `.it-index` files under `hr/`
2. Composes them into a combined view
3. Runs the query against the composed view
4. Returns results with file paths

```
File                         Type     Content       Section    Properties
hr/profiles/ahmed.it         contact  Ahmed         Personal   role: Engineer
hr/profiles/sarah.it         contact  Sarah Chen    Personal   role: VP Eng
```

### Step 3: Narrow queries

```bash
# Only profiles, not templates
intenttext query ./hr/profiles --type contact --format table

# Only policies
intenttext query ./hr --type policy --format table
```

## Real-world example

An organization with 500+ documents:

```bash
# Build all indexes
intenttext index ./company --recursive

# Find all deadlines across the entire company
intenttext query ./company --type deadline --format table

# Find contracts expiring this quarter
intenttext ask ./company/contracts "Which contracts expire before July 2026?" --format text

# Build a contact directory
intenttext query ./company --type contact --format csv > contacts.csv

# Find all amendments
intenttext query ./company/contracts --type amendment --format table
```

Each query reads only the relevant `.it-index` files. No full file parsing needed.

## Programmatic composition

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

## Common question

**"Can I build one index for everything?"**

No. Indexes are shallow by design. This is intentional — it keeps boundaries clean and invalidation fast. The CLI composes them for you transparently. You never need to think about composition unless you're using the programmatic API.

## Next steps

- [Indexing Folders](./indexing-folders) — build and maintain indexes
- [Querying Documents](./querying-documents) — query syntax and output formats
- [Folder Structure](./folder-structure) — recommended folder layouts
