## Professional Assessment of IntentText

### A. Version & Release Hygiene

**Problem: Version numbers are inconsistent across the project.**

| Location                         | Version          | What it means             |
| -------------------------------- | ---------------- | ------------------------- |
| Root `package.json`              | 1.3.0            | Workspace root            |
| `packages/core/package.json`     | 1.2.0            | Published to npm          |
| VS Code extension `package.json` | 1.3.0            | Not published             |
| `parser.ts` emits `version:`     | "1.1"            | In the JSON output        |
| `SPEC.md` header                 | v1.0             | Specification doc         |
| `CHANGELOG.md`                   | Only 1.0.0 entry | Everything after is blank |

This needs to be synchronized. The parser should emit the current version, and the CHANGELOG should document what shipped in 1.1.0 and 1.2.0.

---

### B. SPEC.md is Outdated

The spec still says:

- `question:` is the keyword (now `ask:` is canonical, `question:` is alias)
- `sub2:` is "reserved for v1.1" (it was added and then removed)
- No mention of `//` comments, `subsection:` alias, `done:` normalization, `version` field, `ask:`, `quote:`, callouts (`info:`, `warning:`, `tip:`, `success:`), `---` as divider alias, or ` ``` ` fence blocks
- The IntentBlock interface in the spec doesn't include `version` or `link` inline nodes
- Section 3.4 still lists `question:` not `ask:`

The spec is the "source of truth" — it needs a v1.2 update or it actively misleads implementors.

---

### C. npm Package Ships Too Much

The published tarball is 60KB / 300KB unpacked with **57 files** including:

- `ai-features.js` (11KB) — mostly stubs
- `knowledge-graph.js` (16KB) — Node-only, niche
- `collaboration.js` (11KB) — Node-only, niche
- `export.js` (12KB) — Node-only, niche
- `templates.js` (9KB) — Node-only, niche
- `dates.js` (6KB) — not heavily tested

Most users just need `parser.js` + `renderer.js` + `types.js` (~44KB total). The advanced modules account for ~65% of the package weight. Consider either:

1.  Marking them as separate entry points (`@intenttext/core/query`, etc.)
2.  Or just accepting the weight since it's still only 60KB gzipped

---

### D. Browser Bundle Not Rebuilt

After all the changes this session (done normalization, comments, subsection alias), `intenttext.browser.js` hasn't been rebuilt. Anyone running `preview.html` from disk is using the old bundle.

---

### E. VS Code Extension Needs Updating

The extension grammar (`syntaxes/intenttext.tmLanguage.json`) likely doesn't highlight:

- `//` comment lines
- `subsection:` keyword
- `ask:` keyword (may only highlight `question:`)
- `quote:` keyword
- Callout keywords (`info:`, `warning:`, `tip:`, `success:`)

The snippets file may also be missing the newer keywords.

---

### F. Dead/Stub Code in Core

| Module              | Issue                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai-features.ts`    | `generateSynthesis()` is a stub that returns hardcoded text. The whole module is infrastructure without an AI backend.                          |
| `dates.ts`          | `parseNaturalDate()` is implemented but never called by the parser. Not integrated into the pipeline.                                           |
| `InlineMark` type   | Deprecated since v1.0, still in types.ts. Zero renderers use it.                                                                                |
| `body-text` keyword | Not in the KEYWORDS array but used as a fallback type — inconsistency. It should either be a keyword users can write, or just an internal type. |

---

### G. Parser Edge Cases

1.  **`//` comments inside code blocks**: A `// comment` line inside a `code:` ... `end:` block would be swallowed as a comment instead of preserved as code content. The comment check runs before the code capture check.

2.  **`divider:` keyword** is in the KEYWORDS array and parsed, but `---` is handled as a special case before line parsing. Both work, but the logic is split across two places.

3.  **Callout keywords** (`info:`, `warning:`, `tip:`, `success:`) are in the parser KEYWORDS but NOT in the exported `KEYWORDS` array in `types.ts`. Any consumer using `KEYWORDS` from types won't see them.

---

### H. Actionable Recommendations (Priority Order)

1.  **Fix `//` comment bug inside code blocks** — comments should NOT be stripped from code capture mode
2.  **Rebuild browser bundle** — `npm run browser:build`
3.  **Sync version numbers** — parser should emit `"1.2"`, CHANGELOG needs entries
4.  **Update SPEC.md** — reflect all v1.1/v1.2 changes (aliases, comments, callouts, etc.)
5.  **Sync KEYWORDS in types.ts** — add `info`, `warning`, `tip`, `success`, `body-text`
6.  **Update VS Code extension grammar** — add new keywords and comment highlighting
7.  **Remove `InlineMark` type** — no consumers, just dead weight
8.  **Consider trimming `files` in package.json** — exclude advanced modules from npm or document them as optional
