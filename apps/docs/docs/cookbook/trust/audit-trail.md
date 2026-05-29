---
sidebar_position: 4
title: Audit Trail
---

# Audit Trail

## The problem

You need a complete record of who changed what, when, and why — from first draft to final version.

## The solution

`track:` enables revision tracking. The CLI records changes as `revision:` blocks below the `history:` boundary.

```intenttext
title: Service Agreement v2.1
meta: | type: contract | track: true

section: Terms
text: Payment within 30 days of invoice.

section: Signatures
approve: Legal review | by: Sarah Chen | role: General Counsel | at: 2026-03-20
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-22 | hash: sha256:a1b2c3d4
freeze: | status: locked | at: 2026-03-22T15:00:00Z | hash: sha256:f9a0b1c2

track: | by: legal@acme.co

history:
revision: | version: 1.0 | at: 2026-03-01 | by: Ahmed | change: Initial draft
revision: | version: 1.1 | at: 2026-03-05 | by: Sarah | change: Legal review — clause 4.2 updated | section: Payment | was: Net 60 | now: Net 30
revision: | version: 1.2 | at: 2026-03-15 | by: Ahmed | change: Incorporated finance feedback
revision: | version: 2.0 | at: 2026-03-20 | by: Sarah | change: Final legal review
revision: | version: 2.1 | at: 2026-03-22 | by: Ahmed | change: Sealed
```

## The history boundary

The `history:` keyword separates the document from its history. Everything above is the document content. Everything below is metadata about the document's evolution.

```
[document content]
track: | by: owner@example.com

history:
[revision blocks]
```

The history boundary:

- Never included in content hashes
- Never rendered in HTML output
- Present in the raw `.it` file for tools and auditors

## Viewing history

### CLI

```bash
intenttext history contract.it
```

```
Version  Date        Author  Change
1.0      2026-03-01  Ahmed   Initial draft
1.1      2026-03-05  Sarah   Legal review — clause 4.2 updated
1.2      2026-03-15  Ahmed   Incorporated finance feedback
2.0      2026-03-20  Sarah   Final legal review
2.1      2026-03-22  Ahmed   Sealed
```

### Filtered history

```bash
# By author
intenttext history contract.it --by "Sarah"

# By section
intenttext history contract.it --section "Payment"

# As JSON — for downstream processing
intenttext history contract.it --json
```

### JSON output

```json
[
  {
    "version": "1.1",
    "at": "2026-03-05",
    "by": "Sarah",
    "change": "Legal review — clause 4.2 updated",
    "section": "Payment",
    "was": "Net 60",
    "now": "Net 30"
  }
]
```

## Revision metadata

Each `revision:` block can track:

| Property   | Description               |
| ---------- | ------------------------- |
| `version:` | Version identifier        |
| `at:`      | Timestamp                 |
| `by:`      | Author                    |
| `change:`  | Description of the change |
| `section:` | Which section changed     |
| `id:`      | Block identifier          |
| `block:`   | Block type that changed   |
| `was:`     | Previous value            |
| `now:`     | New value                 |

## Revisions vs amendments

|                  | `revision:`                    | `amendment:`                      |
| ---------------- | ------------------------------ | --------------------------------- |
| **Where**        | Below the `history:` boundary  | After `freeze:`, above `history:` |
| **When**         | During drafting, before freeze | After the document is sealed      |
| **Written by**   | The CLI (auto-generated)       | The `intenttext amend` command    |
| **Purpose**      | Draft history                  | Formal post-seal changes          |
| **Affects seal** | No — below the boundary        | No — after `freeze:`              |

Use `revision:` to track how the document was built. Use `amendment:` to track how it was changed after signing.

## Complete audit trail

For a fully auditable document:

1. `track:` — enables tracking
2. `approve:` — records who reviewed
3. `sign:` — integrity hash seals
4. `freeze:` — seals the content
5. `amendment:` — formal post-seal changes
6. `revision:` — draft history below `history:`

```bash
# Full picture
intenttext verify contract.it   # seal + amendments
intenttext history contract.it  # revision history
```

## Next steps

- [Approval Workflow](./approval-workflow) — the approve → sign → freeze chain
- [Amending Frozen Documents](./amending-frozen-docs) — post-seal amendments
- [Sealing Contracts](./sealing-contracts) — the seal command
