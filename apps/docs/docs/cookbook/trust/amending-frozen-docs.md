---
sidebar_position: 3
title: Amending Frozen Documents
---

# Amending Frozen Documents

## The problem

A signed, frozen contract needs to change. Payment terms, scope, a contact email — something has to be updated. But the contract is sealed. Breaking the seal means voiding all signatures, re-approving, re-signing, re-freezing. The audit trail has a gap.

## Without `amendment:`

The old way:

1. Break the seal (delete `freeze:` and `sign:` blocks)
2. Make the edit
3. Get new approvals
4. Re-sign
5. Re-freeze

**Result**: original signatures are voided. There's no record of what the document looked like before. Counterparties may dispute whether the change was authorized.

## With `amendment:`

The `amendment:` keyword (v2.11) adds a formal change record **alongside** the sealed content. The original seal stays intact.

```intenttext
// ... original content above ...

sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-22T10:00:00Z | hash: sha256:a1b2c3d4
sign: Maria Santos | role: COO | at: 2026-03-22T14:30:00Z | hash: sha256:e5f6a7b8
freeze: | status: locked | at: 2026-03-22T15:00:00Z | hash: sha256:f9a0b1c2

// Amendments live AFTER freeze:, so they don't break the seal
amendment: Payment terms updated | section: Payment | was: Net 15 | now: Net 30 | ref: Amendment #1 | by: Ahmed Al-Rashid | approved-by: Sarah Chen | at: 2026-09-15
```

## The CLI command

```bash
intenttext amend contract.it \
  --section "Payment" \
  --was "Net 15" \
  --now "Net 30" \
  --ref "Amendment #1" \
  --by "Ahmed Al-Rashid"
```

**Required flags**: `--now` and `--ref`. The document must have a `freeze:` block.

**Error if not frozen**:

```
Error: AMENDMENT_WITHOUT_FREEZE
Cannot amend a document that has not been frozen.
Use `intenttext seal` first.
```

## What `intenttext verify` reports

After an amendment:

```bash
intenttext verify contract.it
```

```
✓ Original seal valid: sha256:f9a0b1c2 (2026-03-22)
✓ 2 signatures intact
⚡ 1 amendment applied:
  Amendment #1: Payment terms updated (2026-09-15)
    Section: Payment
    Was: Net 15
    Now: Net 30
    By: Ahmed Al-Rashid
    Approved by: Sarah Chen
```

The original seal is verified first. Amendments are listed separately. A reader can see both the original terms and every change that was made.

## Multiple amendments

Amendments are additive. Each gets its own reference number:

```intenttext
freeze: | status: locked | at: 2026-03-22T15:00:00Z | hash: sha256:f9a0b1c2

amendment: Payment terms updated | section: Payment | was: Net 15 | now: Net 30 | ref: Amendment #1 | by: Ahmed Al-Rashid | approved-by: Sarah Chen | at: 2026-09-15

amendment: Scope extended | section: Scope | now: Includes Phase 2 deliverables | ref: Amendment #2 | by: Ahmed Al-Rashid | approved-by: James Miller | at: 2026-11-01

amendment: Contact updated | section: Parties | was: j.miller@old.co | now: j.miller@globaltech.co | ref: Amendment #3 | by: Maria Santos | at: 2026-12-15
```

## Amendment approval chains

Each amendment can have its own `approved-by:` — the approval chain for an amendment is independent of the original document's approval chain.

For high-stakes amendments, add separate `approve:` blocks before the `amendment:`:

```intenttext
freeze: | status: locked | at: 2026-03-22T15:00:00Z | hash: sha256:f9a0b1c2

approve: Amendment #1 legal review | by: Sarah Chen | role: General Counsel | at: 2026-09-14
amendment: Payment terms updated | section: Payment | was: Net 15 | now: Net 30 | ref: Amendment #1 | by: Ahmed Al-Rashid | approved-by: Sarah Chen | at: 2026-09-15
```

## Querying amendments

```bash
# Find all amended contracts
intenttext query ./contracts --type amendment --format table

# Amendments by a specific person
intenttext query ./contracts --type amendment --by "Ahmed Al-Rashid" --format json

# Natural language
intenttext ask ./contracts "Which contracts have been amended since September?" --format text
```

## The complete lifecycle

```bash
# 1. Write and seal the contract
intenttext seal contract.it --signer "Ahmed Al-Rashid" --role "CEO"

# 2. Time passes... terms need to change

# 3. Amend (seal is preserved)
intenttext amend contract.it \
  --section "Payment" \
  --was "Net 15" \
  --now "Net 30" \
  --ref "Amendment #1" \
  --by "Ahmed Al-Rashid"

# 4. Verify (original seal + amendments)
intenttext verify contract.it

# 5. View history
intenttext history contract.it
```

## Next steps

- [Sealing Contracts](./sealing-contracts) — the seal and verify workflow
- [Audit Trail](./audit-trail) — complete revision tracking
- [Contract](../documents/contract) — complete contract example
