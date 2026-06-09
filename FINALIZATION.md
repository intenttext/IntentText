# IntentText — Finalization & Production-Readiness Plan

_Authored: 2026-06-09 · Target release: `v4.1.0`_

This plan takes IntentText from "many apps, three parsers, contradictory docs" to a
focused, production-ready monorepo with **one canonical parser**, a **simplified
tiered format**, and a **small maintained surface**.

It supersedes everything in `todo/`. Those documents describe a Rust-first
architecture that no longer exists (Rust was removed in v3.4.0) and must be deleted
in Phase 1.

---

## Decisions locked (2026-06-09)

| Decision | Choice |
| --- | --- |
| Duplicate parsers (Rust core, Python parser) | **Delete both.** TS core is the single source of truth. |
| Production-maintained surfaces | **Core, MCP server, VSCode extension, Editor app.** |
| Demoted to `experimental/` (kept, not deleted, no support promise) | Hub, Desktop, Docs, Builder. |
| First release after this work | `v4.1.0` |

---

## Current-state baseline (measured, not assumed)

- `@intenttext/core` v3.5.0 — **875/875 tests pass**, pure TS, ~10.8k LOC.
- Keyword surface today: **37 canonical + 52 aliases + 12 compat-only + 36 extension + 80 BlockType entries.**
- `keywords:check` validates the **TS core only** — Python, VSCode snippets, docs, README are *not* covered and drift silently.
- Duplicate parsers: `packages/python/intenttext/parser.py` (+ `merge.py`, dead `rust_bridge.py`), `packages/rust/` (~10.9k LOC, unused).
- Root leftovers from the pre-monorepo era: `cli.js` (28k), `intenttext.browser.js` (21k), `demo.js`, `preview.html`, `sample-output.html`.

---

## Phase 1 — Truth & hygiene  _(0.5–1 day · zero functional risk)_

**Goal:** the repo tells the truth about itself; no stale or duplicate top-level files.

- [ ] Delete the stale planning docs:
  - [ ] `todo/v3-unified-execution-plan.md` (Rust-first — false)
  - [ ] `todo/v3.3-implicit-text-spec-freeze.md` (Rust baseline — false)
  - [ ] `todo/v3-release-notes-draft.md`, `todo/core-update-rules.md` (review, likely delete)
  - [ ] Keep `todo/roadmap-2026-monorepo.md` only if still accurate; otherwise fold into this doc and delete.
- [ ] Write `ARCHITECTURE.md` at root: one paragraph stating **"`@intenttext/core` (TypeScript) is the single canonical implementation of the parser, merge, query, render, and trust logic. No other language re-implements the grammar."**
- [ ] Resolve root leftovers:
  - [ ] `cli.js` → move to `packages/core/bin/` (or confirm `packages/core` already exposes a `bin` and delete the root copy).
  - [ ] `intenttext.browser.js` → this is a build artifact; remove from VCS, regenerate via `browser:build` into `dist/`. Add to `.gitignore`.
  - [ ] `demo.js`, `preview.html`, `sample-output.html` → move into `examples/` or delete.
- [ ] Remove the `.DS_Store` files tracked in `packages/` and root; add to `.gitignore` if not already.

**Exit:** `git status` clean, root contains only monorepo plumbing + `packages/` + `apps/` + docs. No file at root claims an architecture that isn't shipped.

---

## Phase 2 — Delete duplicate parsers, end drift  _(1–2 days · highest value)_

**Goal:** exactly one parser implementation; every other consumer is generated from or
validated against it.

### 2a. Delete Rust
- [ ] Delete `packages/rust/` entirely.
- [ ] Remove `packages/rust` from `pnpm-workspace.yaml` and any root scripts referencing it.
- [ ] Delete `packages/core/src/rust-core.ts` and its tests (`rust-core-telemetry.test.ts`, `rust-core-theme-parity.test.ts`) **only after** confirming no package imports from `rust-core`. Re-point any imports to the direct TS functions (`parser.ts`, `renderer.ts`, `validate.ts`, `source.ts`).
  - [ ] `grep -rn "rust-core\|initRustCore\|setRustCoreRuntimeMode" packages apps` → must return zero after this step.
- [ ] Search apps (editor/desktop) for `prepare:wasm`, `initRustCore()`, `public/rust-wasm/` and remove them.

### 2b. Delete the Python parser, keep Python as a thin client
- [ ] Delete `packages/python/intenttext/parser.py`, `merge.py`, `rust_bridge.py`, and any other module that re-implements grammar (`renderer.py`, `validate.py`, `trust.py`, `query.py`, `source.py` — review each).
- [ ] Decide Python's new role:
  - **Recommended:** Python becomes a **types + subprocess client** that shells out to the core CLI for parsing and consumes JSON. Keeps a real PyPI package without a second grammar.
  - Alternative: deprecate the PyPI package entirely if there's no consumer.
- [ ] Update `packages/python/README.md` and `pyproject.toml` to reflect the new role; bump major version with a clear migration note.

### 2c. Turn `keywords:check` into a cross-consumer parity gate
- [ ] Extend `packages/core/scripts/check-keyword-consistency.cjs` (or add `gen-keyword-docs.ts`) to treat the TS `LANGUAGE_REGISTRY` as the source and **assert** these stay in sync:
  - [ ] README keyword table
  - [ ] `packages/vscode/snippets/*.json` + tokenizer grammar
  - [ ] `apps/docs` keyword reference page
  - [ ] Python `types.py` (the keyword enum/list, if retained)
- [ ] Wire the gate into CI so a registry change that doesn't update consumers **fails the build**.

**Exit:** one parser. `grep -rn "def parse\|fn parse" packages` finds only the TS core. CI parity gate is green and would fail on drift.

---

## Phase 3 — Simplify the file format  _(2–4 days · the headline change)_

**Goal:** a plain `.it` file needs ~12 keywords. Everything else is opt-in.

### 3a. Define tiers (single source: `LANGUAGE_REGISTRY`)
Add a `tier` field to each keyword definition:

- **`core` (~12)** — `title`, `section`, `sub`, `text`, `task`, `done`, `note`, `list`, `table`, `link`, `code`, `meta`.
- **`profile:contract`** — `sign`, `approve`, `freeze`, `revision`, `deadline`, `def`, `contact`, `amendment`.
- **`profile:agent`** — `step`, `decision`, `checkpoint`, `tool`, `prompt`, `result`, `handoff`, `retry`, `gate`, `signal`, `loop`, `parallel`, `wait`, `call`.
- **`profile:print`** — `font`, `page`, `break`, `byline`, `epigraph`, `caption`, `footnote`, `toc`, `dedication`, `header`, `footer`, `watermark`.

### 3b. Make profiles opt-in, lean on the existing `custom` passthrough
- [ ] A document declares profiles it uses (e.g. `meta: | profile: agent, contract`) or the parser auto-detects. Keywords **outside active tiers** flow through the v3.5 `custom` passthrough you already shipped — no error, no data loss.
- [ ] Collapse `compat-only` (12) and most `alias` (52) entries: keep only aliases with real usage; mark the rest `deprecated` with a removal version. Goal: cut the alias count by >50%.
- [ ] Reduce the 36 extension keywords to those that earn their place; the rest become plain `custom` passthrough.

### 3c. Freeze and document
- [ ] Write **one** canonical grammar doc (`packages/core/SPEC.md`) — line precedence, tiers, profiles, passthrough, trust/freeze semantics. Delete scattered spec fragments.
- [ ] Freeze the spec at `v4.1` and reference it from README.

**Exit:** `parseIntentText` of a core-only document touches ≤12 reserved keywords; everything beyond a declared profile round-trips as `custom`. The format is demonstrably smaller without losing capability.

---

## Phase 4 — Production readiness & scope cut  _(1–2 days)_

**Goal:** small maintained surface, one honest CI, one release.

- [ ] Create `experimental/` and move **Hub, Desktop, Docs, Builder** there (or tag them in `package.json` as `"private": true` + a README banner: _"Experimental — not part of the supported v4 release."_). Remove them from the default `build`/`test` matrix.
- [ ] Keep in the supported build/test/release matrix: **core, mcp, vscode, editor.**
- [ ] One CI pipeline (`.github/workflows/ci.yml`): install → build supported packages → `pnpm -r test` (supported only) → `keywords:check` parity gate → `size:check`.
- [ ] One release pipeline that publishes: `@intenttext/core` (npm), `@intenttext/mcp-server` (npm), VSCode extension (marketplace). Editor deploys via Vercel.
- [ ] Rewrite root `README.md` to describe **only** the supported surface; link experimental apps separately.
- [ ] Single honest `CHANGELOG.md` entry for `v4.1.0` summarizing: Rust removed, Python parser removed, format tiered, scope focused.
- [ ] Tag and release `v4.1.0`.

**Exit:** green CI on the four supported packages, published artifacts, README that matches reality.

---

## Sequencing & risk

```
Phase 1 ──▶ Phase 2 ──▶ Phase 3 ──▶ Phase 4
(safe)     (high value) (headline)  (release)
```

- Phases 1, 2, 4 are low-risk mechanical/structural work.
- **Phase 3 is the only design-risk phase** — tiering can subtly change parse output for documents that used now-demoted keywords. Mitigation: the `custom` passthrough already exists, so demoted keywords degrade to preserved-verbatim blocks rather than errors. Add golden fixtures for each profile before/after.
- Each phase is independently shippable; stop after any phase and the repo is still in a better state than before.

## Definition of done for `v4.1.0`

1. One parser (TS), enforced by `grep` and CI.
2. Cross-consumer keyword parity gate green.
3. Core-only `.it` files use ≤12 reserved keywords; profiles opt-in; unknown keywords pass through.
4. Supported surface = core + mcp + vscode + editor; experimental clearly separated.
5. README, SPEC, ARCHITECTURE, CHANGELOG all describe the shipped reality.

## Known issues uncovered during finalization

These were **pre-existing** bugs exposed by actually building/testing the supported
surface (previously masked by missing dependencies and a broken `prepare:wasm`
step). None were regressions from this work.

1. **Serializer round-trip for nested list-item + keyword — FIXED.**
   `documentToSource` now renders list/step bullets as `- …` / `1. …` (with a
   typed child rendered inline, e.g. `- task: Buy groceries`) and custom blocks
   with their original keyword (e.g. `computer: …`), instead of the internal
   `list-item:`/`step-item:`/`custom:` forms that never reparsed. The MCP
   round-trip test is re-enabled; two `source.test.ts` tests that had codified the
   broken output were rewritten to assert real reparse round-trips.

### Dependency/build fixes applied (were latent breakages)

- `@intenttext/mcp-server` imported `zod` without declaring it — added.
- `apps/editor` imported `@tiptap/core` without declaring it — added.
- `apps/editor` vite build failed on CJS named exports from the core workspace
  package — fixed via `build.commonjsOptions.include` matching the resolved
  `packages/core/dist` path.
