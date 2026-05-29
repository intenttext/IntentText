# IntentText — Consolidation & Monorepo Roadmap

_Created: May 2026_

---

## Diagnosis: Why so many uncommitted files?

**Short answer: The USB HDD move changed file permissions.**

Every file on macOS HFS+/APFS uses mode `644`. FAT32/exFAT USB drives don't store Unix permissions, so macOS assigned `755` to every file when writing. When you copied back to APFS it kept `755`. Git records permissions, so all `118` files in `IntentText` (and similar counts in every other repo) show as "modified" with **zero content changes** — they are just permission flips `100644 → 100755`.

There are also **real** uncommitted changes from the last dev session (parser.ts `body-text → text`, editor fixes, etc.).

### Fix — one command per repo

```bash
# Restore permissions and then commit the real changes
git diff --summary | grep "mode change" | awk '{print $NF}' | xargs git update-index --chmod=-x
# then review what's left
git status --short
git add -p   # stage only intentional changes
git commit -m "chore: restore file permissions after USB move"
```

Run this inside each repo before doing anything else.

### All repos — state summary

| Repo               | Uncommitted | node_modules | Notes                                 |
| ------------------ | ----------- | ------------ | ------------------------------------- |
| IntentText (core)  | 118         | MISSING      | ~all permission, + real parser.ts fix |
| intenttext-rust    | 41          | n/a (Cargo)  | permission + test changes             |
| intenttext-mcp     | 21          | MISSING      | permission + v3.3 updates             |
| intenttext-vscode  | 20          | MISSING      | permission + hover/tokenizer fixes    |
| intenttext-action  | 12          | MISSING      | permission only                       |
| intenttext-python  | 51          | MISSING      | permission + 3.3.0 changes            |
| intenttext-docs    | 97          | MISSING      | permission + doc updates              |
| intenttext-editor  | 64          | MISSING      | permission + many session fixes       |
| intenttext-builder | 102         | MISSING      | permission                            |
| intenttext-hub     | 212         | MISSING      | permission                            |
| intenttext-desktop | 99          | MISSING      | permission + session fixes            |

---

## Phase 0 — Restore working state (do this first)

1. **Fix permissions + reinstall deps** in all repos:

```bash
cd /Users/emad/projects/dotit

for repo in IntentText intenttext-mcp intenttext-vscode intenttext-action intenttext-python intenttext-docs intenttext-editor intenttext-hub intenttext-builder intenttext-desktop; do
  echo "=== $repo ==="
  pushd $repo
  # Fix permissions
  git diff --summary | grep "mode change" | awk '{print $NF}' | xargs -I{} git update-index --chmod=-x {}
  # Reinstall deps
  npm install
  popd
done
```

2. **Rust**: `cd intenttext-rust && cargo build` (no node_modules needed).

3. **Python**: `cd intenttext-python && pip install -e ".[dev]"`.

4. After cleanup, in each repo: `git status --short` should show only **real** changes from the last session. Review, stage, and commit those.

---

## Phase 1 — Remove Rust/WASM dependency (TS-only core)

**Goal:** `@intenttext/core` should work in all environments (browser, Node, Python bridge) using the TS parser only. No WASM compilation step, no `.wasm` file to ship.

### What the Rust core currently does

- `intenttext-rust/` compiles to WASM via `wasm-pack`
- `IntentText/packages/core/dist/rust-core.js` is the JS shim
- The browser editor calls `initRustCore()` before parsing
- `intenttext-python/intenttext/rust_bridge.py` calls the Rust binary directly

### Steps

1. **In `IntentText/packages/core`:**
   - Remove `initRustCore`, `setRustCoreRuntimeMode` exports
   - Delete `dist/rust-core.js`, `dist/rust-core_bg.wasm` shims
   - The TS `parser.ts` becomes the **only** parser (it already works correctly after `body-text → text` fix)
   - Remove the `rust-wasm` optional dependency from `package.json`
   - Bump to `v3.4.0`

2. **In `intenttext-editor/src/main.tsx`:**
   - Remove `initRustCore()` + `setRustCoreRuntimeMode("rust-only")` calls
   - Remove `prepare:wasm` script from `package.json`
   - Remove `public/rust-wasm/` folder

3. **In `intenttext-desktop/src/main.tsx`:** Same as editor.

4. **In `intenttext-python/intenttext/rust_bridge.py`:**
   - Point the bridge to the TS parser via the npm package (or duplicate parse logic in Python)
   - Long-term: keep `rust_bridge.py` but stub it to always fall back to TS

5. **`intenttext-rust/`:** Keep the repo, add a notice at top of README: _"Rust implementation — not currently used in production. Preserved for future performance work."_ Add `archived: true` tag on GitHub. Do **not** delete.

6. **Verify** all consumers work: editor, MCP server, vscode extension, action, docs build.

### Why this is safe

The TS parser and Rust parser produce identical output for all test cases (confirmed in the v3.3 test suite). The TS path is already the live fallback in every browser environment.

---

## Phase 2 — Custom / free keywords (passthrough blocks)

**Goal:** Any word the user writes at the start of a line that is **not** a reserved keyword is preserved as a `custom` block with that keyword intact.

Example:

```
computer: mac | cpu: 2.8GHz | ram: 16GB
```

Parses to:

```json
{
  "type": "custom",
  "keyword": "computer",
  "content": "mac",
  "properties": { "cpu": "2.8GHz", "ram": "16GB" }
}
```

### Parser change (small, surgical)

Currently in `parser.ts`, the **default/fallback** branch emits `type: "text"` for any unrecognized line. Change it to check whether the line looks like `word: content` — if the word before `:` is not in the reserved `KEYWORDS` set, emit a `custom` block instead:

```ts
// In parseLine(), at the bottom (currently the "default to text" branch):
if (keyword && !isCoreKeyword && !isExtensionKeyword) {
  return {
    id: nextId(),
    type: "custom",
    keyword, // preserve exactly as written
    content: restContent,
    properties: parsedProperties,
    originalContent: trimmed,
  };
}
// else: bare prose without keyword = text block (unchanged)
```

### Type system change

Add to `BlockType`:

```ts
| "custom"   // user-defined keyword, preserved verbatim
```

Add to block structure:

```ts
keyword?: string;   // the raw keyword for "custom" blocks
```

### Renderer change

Custom blocks render as:

```html
<div class="it-block it-custom" data-keyword="computer">mac</div>
```

With pipe properties as `data-*` attributes.

### Reserved keyword list

Before implementing, **freeze and document** the full reserved keyword list (see Phase 5 below). Anything not on that list = passthrough.

---

## Phase 3 — Monorepo consolidation

### What goes in

| Repo                      | Include?      | New path           |
| ------------------------- | ------------- | ------------------ |
| `IntentText` (core + CLI) | ✅            | `packages/core/`   |
| `intenttext-rust`         | ✅ (archived) | `packages/rust/`   |
| `intenttext-mcp`          | ✅            | `packages/mcp/`    |
| `intenttext-vscode`       | ✅            | `packages/vscode/` |
| `intenttext-action`       | ✅            | `packages/action/` |
| `intenttext-python`       | ✅            | `packages/python/` |
| `intenttext-docs`         | ✅            | `apps/docs/`       |
| `intenttext-editor`       | ✅            | `apps/editor/`     |
| `intenttext-builder`      | ✅            | `apps/builder/`    |
| `intenttext-desktop`      | ✅            | `apps/desktop/`    |
| `intenttext-hub`          | ✅            | `apps/hub/`        |

**Yes — put everything in one monorepo.** One repo, one `CHANGELOG`, one issue tracker, one CI pipeline, one `npm install`. Much easier to maintain. OSS contributors get the full picture.

### What `intenttext-action` is

It's a **GitHub Action** — a CI/CD tool that other people's GitHub repositories can use to validate `.it` files in their own projects. Example: a team puts `.it` workflow files in their repo and the action runs on every PR to lint them. It's genuinely useful and should stay. In the monorepo it lives at `packages/action/`.

### Monorepo structure

```
intenttext/                   ← new root repo name
├── package.json              ← pnpm workspaces root
├── pnpm-workspace.yaml
├── turbo.json                ← optional: Turborepo for build caching
├── .github/
│   └── workflows/
│       ├── ci.yml            ← runs tests for all packages
│       └── release.yml       ← publishes npm + PyPI + VSCode marketplace
├── packages/
│   ├── core/                 ← was IntentText — @intenttext/core
│   ├── mcp/                  ← was intenttext-mcp
│   ├── vscode/               ← was intenttext-vscode
│   ├── action/               ← was intenttext-action
│   ├── python/               ← was intenttext-python
│   └── rust/                 ← was intenttext-rust (preserved, not built by default)
└── apps/
    ├── docs/                 ← was intenttext-docs (Docusaurus)
    ├── editor/               ← was intenttext-editor (Vite+React)
    ├── builder/              ← was intenttext-builder
    ├── desktop/              ← was intenttext-desktop (Tauri)
    └── hub/                  ← was intenttext-hub (Next.js)
```

### Migration steps

1. Create new GitHub repo `intenttext-org/intenttext` (or `dotit/intenttext`)
2. Use `git subtree add` or `git filter-repo` to bring in each repo's history
3. Set up pnpm workspaces: `pnpm-workspace.yaml` lists `packages/*` and `apps/*`
4. Update all cross-package `import` paths (`@intenttext/core` stays the same — already the npm package name)
5. Archive the 10 old GitHub repos (mark as archived, add a README banner pointing to the monorepo)
6. Update npm, PyPI, VSCode Marketplace publish configs to point to monorepo

---

## Phase 4 — Fix keyword consistency (README vs docs vs parser)

The reserved keyword list needs to be **single-sourced** from `packages/core/src/types.ts` (`CANONICAL_KEYWORDS` array) and auto-generated into:

- `README.md` keyword reference table
- `apps/docs/docs/reference/keywords.md`
- `packages/vscode/snippets/intenttext.json`
- `packages/python/intenttext/types.py`

### Steps

1. Write a script `scripts/gen-keyword-docs.ts` that reads `CANONICAL_KEYWORDS` and generates a markdown table
2. Run it as part of the docs build (`turbo build --filter=docs`)
3. Remove all manually-maintained keyword lists from README files
4. Add a CI check: `diff <generated> <committed>` — fails if docs are stale

---

## Phase 5 — Release plan

| Milestone | Deliverable                                                           | Version  |
| --------- | --------------------------------------------------------------------- | -------- |
| M0        | Fix permissions, reinstall, commit session work                       | current  |
| M1        | Remove Rust/WASM from editor + desktop, TS-only core works everywhere | `v3.4.0` |
| M2        | Custom/free keyword passthrough in parser                             | `v3.5.0` |
| M3        | Monorepo created, all repos migrated, old repos archived              | `v4.0.0` |
| M4        | Keyword docs auto-generated, consistency enforced by CI               | `v4.0.1` |

---

## Open questions for you to decide

1. **Monorepo tooling**: pnpm workspaces alone (simple) or + Turborepo (faster builds)? Recommend: start with pnpm only, add Turbo later.
2. **New root repo name**: `intenttext` (matches the format), `intenttext-org/intenttext`, or keep `dotit`?
3. **Python**: Keep the Python package as a wrapper calling the TS parser via Node subprocess, or rewrite the parser natively in Python?
4. **Hub** (`intenttext-hub`): Is this the public website / registry? It has 212 uncommitted files — should it be in the monorepo or stay separate since it's a deployed Next.js app with its own Vercel config?
5. **Desktop**: Tauri (Rust-based). Once Rust core is archived, the desktop app still uses Rust for the _shell_ (Tauri), not the parser. Confirm this is fine.
