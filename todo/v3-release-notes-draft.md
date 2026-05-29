# v3 Release Notes Draft

Date: 2026-03-12
Status: publish-ready

## Entry Gate Evidence (Before v3.3)

Required suite:

- `parity:check`
- `replay:check`
- `determinism:check`
- `migration:check`
- `runtime-error:check`
- `pdf:smoke`
- `erp-contract:check`

Cycle records:

1. Run ID: `local-2026-03-12-cycle-1`
   Outcome: PASS
   Notes: All seven required gates passed; no preview/PDF drift observed in golden fixture checks.

2. Run ID: `local-2026-03-12-cycle-2`
   Outcome: PASS
   Notes: Full suite rerun passed consecutively with same gate set.

Recorded at: `2026-03-12 22:42:00 +03`

## v3.3 Draft Section (Implicit Text)

- Entry gate is satisfied.
- Work in progress: spec freeze, acceptance matrix, Rust parser implementation, and compatibility validation.
- Canonical explicit syntax remains stable and trust/hash invariant for explicit-source artifacts.

Implementation progress (2026-03-12):

- Spec freeze doc added: `todo/v3.3-implicit-text-spec-freeze.md`.
- Rust parser acceptance tests added for:
  - bare implicit text line,
  - explicit + implicit mixed parsing,
  - blank-line split behavior,
  - unknown `word:` precedence over implicit fallback.
- Validation run: `cargo test parser::tests::` -> `28 passed, 0 failed`.

Validation evidence added (2026-03-12):

- Rust trust invariants: `cargo test trust` -> `9 passed, 0 failed`.
- JS trust/parity checks: `npm test -- tests/trust.test.ts tests/rust-core-theme-parity.test.ts` -> `60 passed, 0 failed`.
- Python compatibility checks: `pytest tests/test_trust.py tests/test_parser.py tests/test_renderer.py` -> `101 passed, 0 failed`.

Rust fixture harness status:

- `cargo test --test core_smoke_fixtures core_smoke_fixtures_matrix` -> `1 passed, 0 failed` after aligning stale fixture expectations with current parser/renderer output contract.

Exit-gate evidence (v3.3):

- Non-targeted parity stability: `npm run parity:check` -> pass (`12 fixtures`).
- Replay stability: `npm run replay:check` -> pass.
- Determinism stability: `npm run determinism:check` -> pass.
- Explicit-source trust/hash invariants: Rust `cargo test trust` and JS `tests/trust.test.ts` both pass.

## Publish Summary (v3.3)

- Implicit text behavior is frozen and validated for Rust parser delivery.
- Explicit-source trust/hash behavior remains stable.
- Cross-runtime compatibility checks are green across Rust, JS core, Python, and builder parity/replay/determinism gates.
