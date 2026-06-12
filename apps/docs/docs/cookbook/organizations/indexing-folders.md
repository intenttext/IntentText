---
sidebar_position: 3
title: Indexing Folders
---

# Indexing Folders

## The problem

Querying hundreds of `.it` files means parsing every file on every query. As your document collection grows, this gets slow.

## The solution

Build a `.it-index` for each folder. The index pre-parses every `.it` file and stores the results as JSON. Queries read the index instead of parsing each file.

### Build an index

```bash
# Single folder
dotit index ./contracts

# All subfolders
dotit index ./company --recursive
```

The `--recursive` flag creates one `.it-index` per subfolder — not one giant index.

### What gets indexed

Every block is indexed except layout and structural blocks:

| Indexed                                      | Skipped                |
| -------------------------------------------- | ---------------------- |
| `text:`, `quote:`, `warning:`, `tip:`        | `page:`, `font:`       |
| `contact:`, `deadline:`, `metric:`           | `header:`, `footer:`   |
| `approve:`, `sign:`, `freeze:`, `amendment:` | `watermark:`, `break:` |
| `step:`, `gate:`, `policy:`                  | `meta:`, `toc:`        |
| `def:`, `figure:`, `ref:`, `cite:`           |                        |

### Index structure

```json
{
  "version": "1",
  "scope": "shallow",
  "folder": "contracts/active",
  "built_at": "2026-03-15T10:30:00Z",
  "core_version": "1.0.0",
  "files": {
    "acme-service.it": {
      "hash": "abc123",
      "modified_at": "2026-03-14T09:00:00Z",
      "metadata": { "title": "Service Agreement — Acme Corp" },
      "blocks": [
        {
          "type": "deadline",
          "content": "Payment due",
          "section": "Payment",
          "properties": { "date": "2026-04-15" }
        }
      ]
    }
  }
}
```

## Staleness detection

The index tracks file hashes. On rebuild, only changed files are re-parsed:

```bash
# Rebuild — unchanged files are skipped
dotit index ./contracts
```

New files → added to the index. Modified files → re-indexed. Deleted files → removed from the index.

## When to rebuild

| Event                   | Action                             |
| ----------------------- | ---------------------------------- |
| Added a new `.it` file  | `dotit index ./folder`        |
| Edited an existing file | `dotit index ./folder`        |
| Deleted a file          | `dotit index ./folder`        |
| Nothing changed         | No action needed — index is reused |

Rebuilding is fast because only stale entries are updated.

## Automatic query speedup

Queries use the index automatically when `.it-index` exists:

```bash
# Without index: parses every .it file in contracts/
dotit query ./contracts --type deadline --format table

# With index: reads .it-index, returns results instantly
dotit query ./contracts --type deadline --format table
```

No flag needed. If `.it-index` exists and is fresh, it's used.

## Next steps

- [Multi-Folder Query](./multi-folder-query) — cross-folder queries with shallow indexes
- [Folder Structure](./folder-structure) — how to organize folders
- [Querying Documents](./querying-documents) — query syntax reference
