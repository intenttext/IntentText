---
sidebar_position: 10
title: Migrating to v2.12
---

# Migrating to v2.12

v2.12 is a format fix release with three targeted changes. Most documents require no manual changes — the CLI handles migration automatically.

## What changed

### 1. `history:` keyword replaces `---` boundary

The two-line `---` + `// history` pattern that marked the history section is now a single `history:` keyword.

**Before (v2.11):**

```intenttext
freeze: | status: locked | at: 2026-03-22 | hash: sha256:a1b2c3d4

---
// history
revision: | version: 1.0 | at: 2026-03-01 | by: Ahmed | change: Initial draft
```

**After (v2.12):**

```intenttext
freeze: | status: locked | at: 2026-03-22 | hash: sha256:a1b2c3d4

history:
revision: | version: 1.0 | at: 2026-03-01 | by: Ahmed | change: Initial draft
```

### 2. `---` is always a visible divider

`---` on its own line now always renders as a horizontal rule (`<hr>`). It is no longer reserved as a history boundary marker.

### 3. `divider:` keyword with style support

`divider:` is the keyword form of `---` with an optional `style` property:

```intenttext
divider:
divider: | style: dashed
divider: | style: dotted
divider: End of Section | style: solid
```

Aliases: `hr:`, `separator:` both resolve to `divider:`.

## Backward compatibility

The old `---` + `// history` pattern is still **recognized** by the parser. Documents using the legacy pattern will parse correctly but emit a `LEGACY_HISTORY_BOUNDARY` diagnostic warning.

To migrate automatically, run `intenttext seal` or `intenttext amend` on any existing sealed document — the CLI now writes `history:` instead of `---`.

## New diagnostic warnings

| Code                      | Severity | When                                              |
| ------------------------- | -------- | ------------------------------------------------- |
| `LEGACY_HISTORY_BOUNDARY` | warning  | Old `---` + `// history` pattern detected         |
| `HISTORY_WITHOUT_FREEZE`  | warning  | `history:` section present but no `freeze:` block |

## Keyword changes

- **Keywords:** 55 → 57 (added `history` to Trust layer)
- **Aliases:** 47 → 49 (added `hr` → `divider`, `separator` → `divider`)

## Package versions

| Package               | Version |
| --------------------- | ------- |
| `@intenttext/core`    | 2.12.0  |
| `intenttext` (Python) | 2.12.0  |
| `intenttext-vscode`   | updated |
| `@intenttext/mcp`     | updated |
