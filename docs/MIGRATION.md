# IntentText Migration Guide

## v2.11 → v2.12

### Breaking Change: History Boundary

The `---` + `// history` two-line pattern that marked the history section has
been replaced by the `history:` keyword.

**Before (v2.11):**

```
note: Content

---
// history

// registry
abc12 | note | | Content
```

**After (v2.12):**

```
note: Content

history:

// registry
abc12 | note | | Content
```

The legacy pattern is still recognized for backward compatibility but emits a
`LEGACY_HISTORY_BOUNDARY` diagnostic warning. Update your documents by running
`intenttext seal` or `intenttext amend` — both now write `history:`.

### `---` Is Now Always a Visible Divider

`---` on its own line now always renders as `<hr>` — a visible horizontal rule.
It is no longer reserved as a history boundary marker.

### New `divider:` Keyword

`divider:` is the keyword form of `---`. It accepts an optional `style` property:

```
divider:
divider: | style: dashed
divider: | style: dotted
divider: End of Section | style: solid
```

Aliases: `hr:`, `separator:` → `divider:`

### `break:` Is Invisible in Web

`break:` now renders as `display:none` with `aria-hidden="true"` in web output.
It only takes effect in print (page break). This is a clarification, not a
behavior change for most users.

### New Diagnostic Warnings

- **`LEGACY_HISTORY_BOUNDARY`** — Fires when parsing a document with the old
  `---` + `// history` pattern. Suggests using `history:` instead.
- **`HISTORY_WITHOUT_FREEZE`** — Fires when a document has a `history:` section
  but no `freeze:` block, which may indicate manual editing or a broken seal.

### Keyword Count

- **Keywords:** 55 → 57 (added `history` to Trust)
- **Aliases:** 47 → 49 (added `hr` → `divider`, `separator` → `divider`)
