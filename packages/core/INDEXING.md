# IntentText Indexing & Folder Query

How `.it` documents are made queryable across a folder tree. Authoritative; where any
other doc disagrees, this wins.

## Principle: the index is a cache, the `.it` files are the truth

A `.it-index` never holds information that isn't derivable from the `.it` files next to
it. It exists only to make queries fast. It can always be deleted and rebuilt. This
single rule decides every design question below.

## Scope: shallow, per-folder

Each folder owns one `.it-index` (JSON) that indexes **only the `.it` files in that
folder — never subfolders**.

```
company/
├── contracts/  service.it  nda.it   .it-index   ← indexes only contracts/
├── hr/         offer.it    policy.it .it-index   ← indexes only hr/
└── finance/    q1.it       q2.it     .it-index   ← indexes only finance/
```

Why shallow:

- **Folders are boundaries.** HR, finance, and contracts often have different access
  controls. A shallow index respects them — you compose across folders *explicitly*.
- **It's per-folder, not per-device.** The index lives in the folder, so it travels
  with it (git, shared drives, any machine). No central per-device database to sync.
- **It stays simple.** One folder → one flat index. No tree to invalidate.

## Recursive search: explicit composition

To query a whole tree, build a `.it-index` in every folder, then compose them:

```bash
intenttext index ./company --recursive   # writes .it-index in each folder with .it files
intenttext query ./company "type=deadline"  # composes the tree, queries across it
```

Programmatically:

```ts
import { buildShallowIndex, composeIndexes, queryComposed } from "@intenttext/core";

const composed = composeIndexes([contractsIndex, hrIndex, financeIndex], "company");
const overdue = queryComposed(composed, { type: "deadline" });
```

## Two query surfaces

- **Block queries** — things *inside* documents: `type=deadline`, `type=sign`,
  `type=task`. Use `queryComposed`.
- **Document-metadata queries** — attributes *about* documents from each file's `meta:`
  block: `type`, `status`, `client`, … Read `index.files[name].metadata`. (As of v4.1
  the index captures every `meta:` field, not just `type`/`domain`.)

## Freshness: lazy self-healing (default)

Because the index is a cache, it is reconciled to the files **whenever you touch it** —
no daemon, no cron:

1. On query, `checkStaleness(existingIndex, currentFiles)` compares each file's
   `modified_at` + content hash against the index → `{ stale, added, removed, unchanged }`.
2. `updateIndex(...)` rebuilds only the stale/added entries and drops removed ones.
3. The refreshed index is written back, then the query runs.

Only changed files reparse, so refresh is cheap. A missing index builds from scratch; a
deleted one rebuilds on next use. The index can never silently disagree with the files.

**Optimization — on-save (editor / watched workspace):** when a file is saved, update
just that one file's entry in its folder index. This is layered *on top of* lazy
self-healing, never a replacement for it.

**Avoid cron/scheduled rebuilds** as the primary strategy — the index would be stale
between runs and full rebuilds are wasteful. Only consider it for very large, rarely
changing corpora, and even then lazy refresh still applies on query.

## Should you commit `.it-index`?

Either is fine, because it's derived:

- **Gitignore it** (simplest) — it regenerates on first query.
- **Commit it** — gives a fast cold-start query with no rebuild, at the cost of diff
  noise. Choose this for read-mostly shared repos.

## Index file shape

```json
{
  "version": "1",
  "scope": "shallow",
  "folder": "contracts",
  "built_at": "2026-06-10T10:30:00Z",
  "core_version": "4.1.0",
  "files": {
    "service.it": {
      "hash": "hash:...",
      "modified_at": "2026-06-09T12:00:00Z",
      "metadata": { "title": "...", "type": "contract", "status": "active", "client": "Acme" },
      "blocks": [ { "type": "deadline", "content": "...", "section": "...", "properties": { "date": "..." } } ]
    }
  }
}
```

## Implementation status (v4.1)

- ✅ Core engine: `buildShallowIndex`, `buildIndexEntry`, `checkStaleness`,
  `updateIndex`, `composeIndexes`, `queryComposed`.
- ✅ CLI: `intenttext index <dir> [--recursive]`, `intenttext query <dir> "<q>"`.
- ⏳ **To wire:** make `index` use `checkStaleness`/`updateIndex` for incremental
  refresh (currently full rebuild), and make `query` self-heal stale entries before
  querying. The building blocks exist; only the CLI plumbing is pending.
