# NEXT_RELEASE_PLAN

## Goal

Ship `v3.2.0` as a pure-Rust core release.

Execution tracker: `IntentText/todo/v3.2-pure-rust-cutover.md`

Definition of done for `3.2.0`:

- No runtime TS parser/renderer execution path remains in shipped core.
- npm package is a thin JS/TS loader over Rust/WASM only.
- Python package is a thin bridge over Rust-core only.
- CLI flow is Rust-first (JS wrapper only if needed for compatibility launch).

## Current State

- Rust parser/renderer are default in core routing.
- TS runtime parser/renderer fallback paths in core have been removed.
- Full suite is green in default mode.
- CLI now uses Rust-first execution via JS launcher handoff (`cli.js`) with compatibility fallback.

Last updated: `11/03/2026`

Execution snapshot:

- Completed: Step 2, Step 3, Step 4, CI pure-Rust regression guard (theme fallback zero gate).
- In progress: Step 1 (owners and freeze communication pending), Step 5 (npm thin-layer measurement and reduction).
- Next active implementation target: Step 5 npm package slimming (remove remaining legacy parser/renderer artifact footprint from publish surface).

Current parity note (`11/03/2026`):

- Rust-core semantic validation path no longer routes to TS runtime fallback for the known v2.12 history warning case (`HISTORY_WITHOUT_FREEZE` parity preserved in Rust path).
- Rust CLI now includes `validate`, `query`, `index`, `ask`, and trust commands (`seal`, `verify`, `history`, `amend`); JS CLI now defaults to Rust handoff with compatibility fallback.
- Python SDK now includes an optional Rust semantic-validation bridge mode (`INTENTTEXT_PY_VALIDATE_ENGINE=rust`) with compatibility code mapping; parser/validate/query compatibility tests remain green in default mode.

## Notes To Keep

- Python cutover note: remaining failures were narrowed to Rust output shape differences (alias normalization, table structure, and metadata-only keywords).
- Action note: normalize Rust block payloads in the Python bridge so existing Python helpers/tests keep working while Rust stays the source of truth.
- Packaging direction note: npm core package should keep only a thin compatibility layer around Rust/WASM implementation.
- Packaging direction note: Python package should keep only a thin bridge layer and remove duplicated Python parser/runtime implementation over time.
- Date format policy note: default format is UK style `DD/MM/YYYY` (example: `14/03/2026`), not US `MM/DD/YYYY`.

## v3.2 Execution Order (One by One)

### Immediate Next Actions (Start Now)

- [ ] Create `v3.2-pure-rust-cutover` tracking issue with owners for core, CLI, Python, docs, CI.
- [x] Add fallback telemetry stubs in core runtime and expose counters in CI artifacts.
- [x] Publish a short release note draft: `3.2.0` removes TS runtime parser/renderer. (`IntentText/todo/v3.2.0-release-note-draft.md`)
- [ ] Freeze non-parity feature merges until Step 4 is complete.

### Step 1: Freeze Scope and Declare Cutover Rules

- Freeze `3.2.0` scope: no new feature work outside parity/blockers.
- Add an explicit release rule in docs and changelog draft: `3.2.0` removes TS runtime parser/renderer.
- Open a single tracking issue with checklist owners for core, CLI, Python, docs, CI.

Exit criteria:

- Tracking issue exists with owners and deadlines.
- Scope freeze announced to all packages depending on core.

### Step 2: Measure and Eliminate Fallback Dependence

- Add runtime counters/logging for current fallback triggers:
  - parser fallback to TS
  - renderer fallback to TS
  - theme fallback path
  - WASM load/call failure fallback
- Record fallback counts in CI artifacts (or weekly dashboard).
- Patch remaining known parity blockers so fallback is not needed in production paths.

Exit criteria:

- Fallback usage is zero in CI and near-zero in real usage.
- Any non-zero fallback has a documented blocker ticket.

### Step 3: Complete Rust Theme and Rendering Parity

- Define exact theme parity contract (inputs, precedence, defaults, output shape).
- Implement all remaining theme logic in Rust renderer.
- Remove `metadata.meta.theme` TS fallback path.
- Snapshot-test themes against canonical fixtures.

Exit criteria:

- Theme fixtures are green in Rust-only rendering.
- No theme path calls TS renderer.

### Step 4: Cut TS Runtime Parser/Renderer from Core

- Remove TS parser/renderer runtime code from package exports and runtime routing.
- Remove engine-selection flags/env switches that pick TS engines.
- Keep one architecture path: Rust/WASM.
- Keep only a temporary emergency switch behind explicit internal guard if strictly required.

Exit criteria:

- No runtime dependency on TS parser/renderer remains.
- All parser/renderer tests pass with Rust-only runtime.

Current progress (`10/03/2026`):

- Completed: removed public engine-selection routing flags/env switches from `packages/core/src/rust-core.ts` (`__INTENTTEXT_CORE_ENGINE`, `INTENTTEXT_CORE_ENGINE` are no longer used).
- Completed: Rust parse path now handles `includeHistorySection` directly (history extraction stays available without parser-option TS fallback).
- Completed: first Step 4 renderer parity burn-down batch (`byline`, `epigraph`, `caption`, `dedication`, `footnote` + docgen integration patterns) now renders in Rust path without TS fallback.
- Completed: remaining v2.11 renderer burn-down (`ref`, `def`, `figure`, `signline`, `contact`, `deadline`) and emergency TS renderer fallback removal.
- Active blocker list: `IntentText/todo/step4-renderer-parity-blockers.md` (renderer open count: `0`).
- Completed: parser-side TS runtime fallback removal (`options.extensions` and wasm-failure parser fallback removed from `rust-core` runtime path).

### Step 5: Ship Thin npm Layer

- Keep only bridge/loader code and compatibility API surface in npm package.
- Remove non-essential TS runtime logic from published artifacts.
- Verify package size reduction and API compatibility.

Exit criteria:

- npm package contains no duplicate parser/renderer runtime implementation.
- Size target met and tracked in CI.

### Step 6: Ship Thin Python Layer

- Remove duplicated Python parser/runtime implementation paths.
- Keep Rust bridge + Python-friendly output mapping.
- Preserve current helper/test expectations by normalizing Rust block payload shapes at bridge boundary.

Exit criteria:

- Python package behavior remains compatible while source of truth is Rust.
- Python tests green on Rust-only core path.

### Step 7: Complete Rust CLI Migration for 3.2

- Rust CLI must cover: `parse`, `render`, `query`, `validate`, `index`, `ask`.
- Port trust commands: `seal`, `verify`, `history`, `amend`.
- Keep JS launcher only as a thin compatibility wrapper if required for user transition.

Exit criteria:

- Rust CLI is default execution path in release artifacts.
- JS CLI logic is reduced to wrapper level or removed.

### Step 8: Enforce Format and Locale Contract

- Define and enforce canonical date format across parser/render/docs/examples:
  - default: UK `DD/MM/YYYY`
  - include migration/lint guidance for old US-style examples
- Add explicit tests for date parsing/rendering and locale-sensitive examples.
- Update docs, templates, and sample files to UK-first defaults.

Exit criteria:

- UK date format is the default in docs/templates/output examples.
- No ambiguous default date examples remain in core docs and SDK docs.

## CI and Quality Gates

- Add required checks per PR:
  - full unit/integration suite
  - Rust/WASM build validation
  - snapshot/parity checks for parser and renderer output
- Add required pure-Rust gate for `3.2` branch:
  - fail PR if TS parser/renderer runtime imports reappear
- Keep a weekly parity dashboard:
  - failed parity cases
  - fallback-trigger counts
  - top regressions and owners

## Package Size Work

- Track baseline package size before each phase.
- Track size after each change (compressed + unpacked).
- Set target reductions for each phase and fail CI if size regresses unexpectedly.

Current Step 5 baseline (`11/03/2026`, `@intenttext/core`):

- `dist.totalBytes`: `918,849`
- `dist.mapFileCount`: `0` (mapless publish output enforced)
- `wasm.bytes`: `581,659`
- `npm pack --dry-run`: packed `262,512`, unpacked `925,524`, entries `63`

Step 5 progress update (`11/03/2026`):

- Core runtime call paths in `merge`, `trust`, `history`, and browser entry were switched from `parser.ts` to Rust-core parse APIs.
- `detectHistoryBoundary` export moved off `parser.ts` onto `trust.ts` to reduce package entrypoint coupling to TS parser runtime.
- Post-build verification confirms `dist/index.js`, `dist/browser.js`, `dist/merge.js`, `dist/trust.js`, and `dist/history.js` no longer load `./parser` at runtime.
- `dist/parser.js` now ships as a thin runtime compatibility shim that forwards to `rust-core`, reducing shipped JS duplication while preserving parser deep-import API shape.

Active CI thresholds:

- `dist.totalBytes <= 950,000`
- `wasm.bytes <= 600,000`
- `dist.mapFileCount == 0`
- `npm pack packedBytes <= 265,000`
- `npm pack unpackedBytes <= 940,000`
- `npm pack entryCount <= 63`

## Risks and Mitigations

- Risk: subtle behavior regressions in niche formatting or metadata.
  - Mitigation: expand fixture coverage before removing TS code paths.
- Risk: WASM runtime compatibility edge cases.
  - Mitigation: keep temporary emergency switch until confidence window closes.
- Risk: removal done too early.
  - Mitigation: require fallback telemetry threshold before deletion.
- Risk: dependency bump exposed a behavioral regression test under Rust-default validation in MCP.
  - Mitigation: patch MCP to force TS validation path for that tool until Rust semantic parity for this case is complete.

## v3.2 Milestones

- M0: Scope freeze + owners assigned.
- M1: Fallback telemetry and parity blockers triaged.
- M2: Theme parity complete in Rust.
- M3: TS runtime parser/renderer removed from core.
- M4: npm and Python thin layers complete.
- M5: Rust CLI default + trust commands parity.
- M6: UK date-format contract fully enforced.

## Suggested Milestones

- M1: telemetry + docs complete.
- M1.5: Rust CLI skeleton (`main.rs` + command parser) with parity tests for parse/render/query/validate.
- M2: theme in Rust + fallback usage near-zero.
- M3: TS parser/renderer runtime removed.
- M4: JS CLI reduced to thin wrapper (or removed), docs updated for Rust CLI.
- M5: npm + Python thin-layer packaging complete.
- M6: UK date-format contract (`DD/MM/YYYY`) rolled out across ecosystem docs/templates.

## Owner Checklist

- [ ] Step 1 complete: scope freeze and owner assignment.
- [x] Step 2 complete: fallback telemetry added and reviewed.
- [x] Step 3 complete: theme parity contract implemented in Rust.
- [x] Step 4 complete: TS runtime parser/renderer removed.
- [ ] Step 5 complete: npm package slimmed to thin Rust/WASM loader.
- [ ] Step 6 complete: Python package slimmed to thin Rust bridge.
- [ ] Step 7 complete: Rust CLI default with trust commands parity.
- [ ] Step 8 complete: UK date-format contract enforced (`DD/MM/YYYY`).
- [x] CI pure-Rust regression guards active.
- [ ] Final docs/changelog updated for `3.2.0` pure-Rust declaration.

## Post-v3.2 Language Sequencing

- `v3.3`: implement implicit text only (no shortcuts, no serializer rewrite).
  - Plan: `IntentText/todo/v3.3-implicit-text-plan.md`
- `v3.4`: implement property continuation formatting only (`indented | key: value` lines).
  - Plan: `IntentText/todo/v3.4-property-continuation-plan.md`
- Explicitly deferred until after `v3.4`: shortcut syntaxes, `with:` defaults, multiline grammar redesign.
