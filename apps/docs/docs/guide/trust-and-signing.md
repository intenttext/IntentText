---
sidebar_position: 9
title: Trust & Signing
---

# Trust & Signing

How to approve, sign, seal, verify, and amend `.it` documents.

## The trust lifecycle

```
draft → tracked → approved → signed → frozen → amended (optional)
```

Each step is a keyword. Each keyword is a line in the document. No external system required.

## Step 1: Track changes

```intenttext
track: | version: 1.0 | by: Ahmed Al-Rashid
```

This activates history. From this point, the CLI can record revisions below the `history:` boundary.

## Step 2: Approve

Named approvals with role and timestamp:

```intenttext
approve: Legal review complete | by: Sarah Chen | role: General Counsel | at: 2026-03-05
approve: Finance approved | by: James Miller | role: CFO | at: 2026-03-06
```

Multiple approvals are common — legal, finance, management, compliance.

## Step 3: Sign

Integrity hash seal (tamper-evident record):

```intenttext
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-06T14:32:00Z | hash: sha256:a1b2c3d4...
```

`sign:` is tamper-evident — it records the signer's name, role, timestamp, and a SHA-256 hash of the document body at the time of signing. If the document is modified after signing, the stored hash will no longer match and verification will report the discrepancy. This is integrity sealing, not cryptographic non-repudiation (there are no private keys or PKI).

## Step 4: Freeze

Seal the document:

```intenttext
freeze: | status: locked | at: 2026-03-06T14:33:00Z | hash: sha256:e5f6a7b8...
```

After `freeze:`, the document is immutable. Any edit changes the content, which invalidates the hash.

## Seal with the CLI

One command does approve + sign + freeze:

```bash
intenttext seal contract.it --signer "Ahmed Al-Rashid" --role "CEO"
```

This:

1. Computes the content hash
2. Adds a `sign:` block
3. Adds a `freeze:` block with the hash
4. Writes the sealed file

## Verify anytime

```bash
intenttext verify contract.it
```

```
✓ Document integrity verified
  Signer: Ahmed Al-Rashid (CEO)
  Sealed: 2026-03-06T14:33:00Z
  Hash: sha256:a1b2c3...
  Amendments: 0
  Status: INTACT — no modifications detected
```

If someone edits the file:

```
✗ Document integrity FAILED
  Expected hash: sha256:a1b2c3...
  Actual hash:   sha256:x9y8z7...
  Status: TAMPERED — content has been modified since sealing
```

## Step 5: Amend (when needed)

A frozen contract needs to change. You have two options:

**Without `amendment:` (the old way):**

1. Break the seal
2. Edit the document
3. Re-approve
4. Re-sign
5. Re-freeze

All original signatures are voided. The audit trail has a gap.

**With `amendment:` (the IntentText way):**

```intenttext
amendment: Payment terms updated | section: Payment | was: Net 30 | now: Net 15 | ref: Amendment #1 | by: Ahmed Al-Rashid | approved-by: Sarah Chen
```

The original seal is preserved. The amendment is additive — it records what changed, where, and who authorized it.

## Amend with the CLI

```bash
intenttext amend contract.it \
  --section "Payment" \
  --was "Net 30" \
  --now "Net 15" \
  --ref "Amendment #1" \
  --by "Ahmed Al-Rashid"
```

## Verify after amendment

```bash
intenttext verify contract.it
```

```
✓ Document integrity verified
  Signer: Ahmed Al-Rashid (CEO)
  Sealed: 2026-03-06T14:33:00Z
  Hash: sha256:a1b2c3...
  Amendments: 1
    #1: Payment terms updated (2026-03-15) by Ahmed Al-Rashid
  Status: INTACT — original seal preserved, 1 amendment applied
```

## View history

```bash
intenttext history contract.it
```

```
v1.0  2026-03-01  Ahmed Al-Rashid   Initial draft
v1.1  2026-03-03  Sarah Chen         Legal review — clause 4.2 updated
v1.2  2026-03-05  Ahmed Al-Rashid   Final edits
      2026-03-06  Ahmed Al-Rashid   SEALED
      2026-03-15  Ahmed Al-Rashid   Amendment #1: Payment terms
```

Filter by author or section:

```bash
intenttext history contract.it --by "Sarah Chen"
intenttext history contract.it --section "Payment"
intenttext history contract.it --json
```

## The history boundary

The `history:` keyword separates the document from machine-managed history:

```intenttext
title: Consulting Agreement
text: Terms and conditions...
freeze: | status: locked

history:
revision: | version: 1.0 | at: 2026-03-01 | by: Ahmed | change: Initial draft
revision: | version: 1.1 | at: 2026-03-03 | by: Sarah | change: Legal review
```

History is below the `history:` keyword. You read it, but the CLI manages it.

## Physical signatures for print

`sign:` is tamper-evident — records signer name, role, timestamp, and SHA-256 hash. Verifiable by code.
`signline:` is physical — a printed signature line for paper:

```intenttext
signline: Ahmed Al-Rashid | role: CEO | org: Acme Corp | date-line: Date | width: 60%
signline: James Miller | role: CFO | org: GlobalTech Inc. | date-line: Date | width: 60%
```

Use both in contracts that need digital verification _and_ paper signatures:

```intenttext
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-06T14:32:00Z
signline: Ahmed Al-Rashid | role: CEO | org: Acme Corp | date-line: Date
```

|                  | `sign:`                 | `signline:`        |
| ---------------- | ----------------------- | ------------------ |
| **Type**         | Digital                 | Physical           |
| **Verification** | SHA-256 hash comparison | Visual on paper    |
| **Lives in**     | The `.it` file          | The printed output |
| **Queryable**    | Yes                     | Yes                |

---

**Related:**

- [Sealing Contracts →](../cookbook/trust/sealing-contracts)
- [Amending Frozen Documents →](../cookbook/trust/amending-frozen-docs)
- [Audit Trail →](../cookbook/trust/audit-trail)
- [Trust Keywords Reference →](../reference/keywords/trust)
