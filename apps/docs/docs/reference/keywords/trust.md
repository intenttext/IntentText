---
sidebar_position: 8
title: Trust Keywords
---

# Trust Keywords

Five keywords for document integrity — tracking versions, recording approvals, signing with hash verification, sealing against modification, and formally amending sealed documents.

## `track:`

**Category:** Trust
**Since:** v2.8

Activates document version tracking. Once set, the CLI records revisions below the `history:` boundary automatically.

### Syntax

```
track: | version: value | by: author
```

### Properties

| Property  | Type   | Required | Description                |
| --------- | ------ | -------- | -------------------------- |
| `version` | string | yes      | Current version identifier |
| `by`      | string | yes      | Who created this version   |

### Examples

```intenttext
track: | version: 1.0 | by: Ahmed Al-Rashid
track: | version: 2.3 | by: Sarah Chen
```

### Notes

- `track:` content is typically empty — data is in properties
- Required before `approve:`, `sign:`, or `freeze:` can be used
- History is recorded automatically below `x-trust: history` as `x-trust: revision` blocks

### Related

- [`approve:`](#approve) — next step in the trust chain
- [Trust & Signing Guide](../../guide/trust-and-signing)

---

## `approve:`

**Category:** Trust
**Since:** v2.8

Named approval stamp. Records who approved the document, their role, and when.

### Syntax

```
approve: description | by: name | role: title | at: timestamp | ref: reference
```

### Properties

| Property | Type   | Required | Description                                 |
| -------- | ------ | -------- | ------------------------------------------- |
| `by`     | string | yes      | Approver name                               |
| `role`   | string | no       | Approver's role or title                    |
| `at`     | string | no       | Approval timestamp (ISO 8601)               |
| `ref`    | string | no       | Reference to approval authority or document |

### Examples

```intenttext
approve: Legal review complete | by: Sarah Chen | role: General Counsel | at: 2026-03-05
approve: Finance approved | by: James Miller | role: CFO | at: 2026-03-06
approve: Compliance review | by: Maria Santos | role: Compliance Officer | ref: Policy CMP-2026-01
```

### Notes

- Multiple `approve:` blocks are common — legal, finance, compliance, management
- Requires `track:` to be set first
- Queryable: `intenttext query . --type approve --by "Sarah Chen"`

---

## `sign:`

**Category:** Trust
**Since:** v2.8

Integrity hash seal. Records the signer's name, role, timestamp, and a SHA-256 hash of the document body at the time of signing. If the document is modified after signing, the stored hash will no longer match and verification will report the discrepancy. This is tamper evidence via hash comparison, not cryptographic non-repudiation.

### Syntax

```
sign: signer name | role: title | at: timestamp | hash: algorithm:value
```

### Properties

| Property | Type   | Required | Description                     |
| -------- | ------ | -------- | ------------------------------- |
| `role`   | string | no       | Signer's role                   |
| `at`     | string | no       | Signing timestamp (ISO 8601)    |
| `hash`   | string | no       | Content hash at time of signing |

### Examples

```intenttext
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-06T14:32:00Z | hash: sha256:a1b2c3d4e5f6
sign: James Miller | role: CFO | at: 2026-03-06T15:00:00Z
```

### `sign:` vs `x-doc: signline`

|                  | `sign:`                                      | `x-doc: signline`                   |
| ---------------- | -------------------------------------------- | ----------------------------------- |
| **Type**         | Digital                                      | Physical                            |
| **Verification** | SHA-256 hash comparison — machine-verifiable | Visual line on paper — human-verifiable |
| **Lives in**     | The `.it` file permanently                   | The printed/PDF output              |
| **Use case**     | File integrity verification                  | Paper contract signatures           |

Use both when a contract needs digital verification _and_ paper signatures.

---

## `freeze:`

**Category:** Trust
**Since:** v2.8
**Aliases:** `lock:`

Seal the document. After `freeze:`, any edit to the content above invalidates the hash.

### Syntax

```
freeze: | status: locked | at: timestamp | hash: algorithm:value
```

### Properties

| Property | Type   | Description                         |
| -------- | ------ | ----------------------------------- |
| `status` | string | `locked`                            |
| `at`     | string | Sealing timestamp (ISO 8601)        |
| `hash`   | string | Content hash of the frozen document |

### Examples

```intenttext
freeze: | status: locked | at: 2026-03-06T14:33:00Z | hash: sha256:e5f6a7b8
```

### Notes

- `freeze:` content is typically empty — data is in properties
- After freezing, the only permitted additions are `amendment:` blocks
- Use `intenttext seal` to compute the hash and add `sign:` + `freeze:` automatically
- Use `intenttext verify` to check the hash against current content

---

## `amendment:`

**Category:** Trust
**Since:** v2.11
**Aliases:** `amend:`, `change:`

Formal change to a frozen document. Preserves the original seal while recording what was changed, where, who authorized it, and when.

### Syntax

```
amendment: description | section: target | was: previous | now: current | ref: identifier | by: author | at: timestamp | approved-by: approver | hash: value
```

### Properties

| Property      | Type   | Required | Description                    |
| ------------- | ------ | -------- | ------------------------------ |
| `section`     | string | yes      | Which section was amended      |
| `was`         | string | no       | The previous value or text     |
| `now`         | string | yes      | The new value or text          |
| `ref`         | string | no       | Amendment reference identifier |
| `by`          | string | no       | Who authored the amendment     |
| `at`          | string | no       | Amendment timestamp            |
| `approved-by` | string | no       | Who approved the amendment     |
| `hash`        | string | no       | Hash of the amendment block    |

### Examples

```intenttext
amendment: Payment terms updated | section: Payment | was: Net 30 | now: Net 15 | ref: Amendment #1 | by: Ahmed Al-Rashid | approved-by: Sarah Chen
amendment: Scope extended | section: Scope | now: Includes Phase 2 deliverables | ref: Amendment #2 | by: Ahmed Al-Rashid | at: 2026-04-01
```

### The amendment model

Without `amendment:`, changing a frozen document means:

1. Breaking the seal (invalidating `freeze:` and `sign:`)
2. Making edits, re-approving, re-signing, re-freezing

All original signatures are voided. The audit trail has a gap.

With `amendment:`:

- The original seal is **preserved**
- The amendment is **additive** — it records the change alongside the sealed content
- Each amendment can have its own approval chain (`approved-by:`)
- `intenttext verify` reports both the original seal status and all amendments

### CLI

```bash
intenttext amend contract.it \
  --section "Payment" \
  --was "Net 30" \
  --now "Net 15" \
  --ref "Amendment #1" \
  --by "Ahmed Al-Rashid"
```

### Notes

- Validation error `AMENDMENT_WITHOUT_FREEZE` if the document has no `freeze:` block
- Amendments appear after `freeze:` but before the `x-trust: history` boundary
- Each amendment is independently queryable

### Related

- [`freeze:`](#freeze) — amendments require a frozen document
- [Trust & Signing guide →](../../guide/trust-and-signing)

---

## The trust chain

A typical trust workflow combines all five keywords:

```intenttext
title: Service Agreement

section: Parties
contact: Ahmed Al-Rashid | role: CEO | email: ahmed@acme.com
contact: Sarah Chen | role: General Counsel | email: sarah@acme.com

section: Terms
text: Full contract terms...

track: | version: 1.0 | by: Ahmed Al-Rashid
approve: Legal review complete | by: Sarah Chen | role: General Counsel | at: 2026-03-05
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-06T14:32:00Z | hash: sha256:a1b2c3d4
freeze: | status: locked | at: 2026-03-06T14:33:00Z | hash: sha256:e5f6a7b8
```

---

## Extension keywords

Automated history and revision blocks are available in the `x-trust:` namespace. These are managed by the CLI — you do not write them manually.

| Extension            | Purpose                                            |
| -------------------- | -------------------------------------------------- |
| `x-trust: history`   | History boundary marker — separates live document from machine-managed history section |
| `x-trust: revision`  | Auto-generated change record written by `intenttext seal` and `intenttext amend` |

See [Extension Keywords →](./extensions) for full syntax documentation.
