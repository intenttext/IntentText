# Core Update Rules (Forever)

Source guardrail: `todo/master-plans/v3-unified-execution-plan.md`

Use these rules before any parser, keyword, runtime, or SDK change.

1. Ship product value before language novelty.
2. Prefer additive changes over rewrites.
3. Keep deterministic output across parser/render/SDKs.
4. Maintain TypeScript, Rust, Python parity contracts.
5. No keyword growth without hard adoption evidence.
6. Every new keyword must include parser, renderer, validation, docs, tests, and migration note.
7. If a feature raises grammar complexity more than user value, defer it.
8. Keep one canonical path and keep alternates optional.
9. Preserve backward compatibility unless major version and migration are explicit.
10. Require an end-to-end real workflow demo for major claims.

## Canonical Data-Table Direction (Deferred Note)

Proposal to evaluate after PDF beta stability:

- Make `table:` a canonical keyword for repeated row data blocks.
- Allow `each:`/`repeat:` interoperability with `table:` mapping.
- Keep header-based row modeling as legacy-compatible during transition.
- Consider eventual deprecation of header-as-row patterns only after parity tests and migration tooling are ready.

Decision gate before implementation:

- Confirm this reduces confusion and parser complexity.
- Confirm it does not break existing templates.
- Confirm cross-SDK behavior stays deterministic.
