---
sidebar_position: 2
title: Sealing Contracts
---

# Sealing Contracts

## The problem

You need to prove a document hasn't been tampered with since it was signed. If someone changes a word, you need to know.

## The solution

`intenttext seal` computes a SHA-256 hash of the document content, adds a `sign:` block and a `freeze:` block. `intenttext verify` checks the hash against the current content.

### Seal

```bash
intenttext seal contract.it --signer "Ahmed Al-Rashid" --role "CEO"
```

This adds to the document:

```intenttext
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-22T15:00:00Z | hash: sha256:a1b2c3d4e5f6a7b8
freeze: | status: locked | at: 2026-03-22T15:00:00Z | hash: sha256:a1b2c3d4e5f6a7b8
```

### Verify

```bash
intenttext verify contract.it
```

Output when valid:

```
✓ Document sealed at 2026-03-22T15:00:00Z
✓ Hash valid: sha256:a1b2c3d4e5f6a7b8
✓ 1 signature: Ahmed Al-Rashid (CEO)
✓ No amendments
```

Output when tampered:

```
✗ SEAL BROKEN
  Expected: sha256:a1b2c3d4e5f6a7b8
  Actual:   sha256:9c8d7e6f5a4b3c2d
  The document has been modified since sealing.
```

## What the hash covers

The hash is computed from **document content above the history boundary**, excluding trust metadata lines:

- `title:`, `summary:`, `meta:` blocks
- All section content
- All block content and properties
- `approve:` blocks
- Layout blocks (`page:`, `font:`, etc.)

The hash does **not** cover:

- `sign:` lines (stripped before hashing)
- `freeze:` lines (stripped before hashing)
- `amendment:` lines (stripped before hashing)
- The `history:` boundary and revisions below it

This is what makes amendments possible: they live after the `freeze:` block, so they don't break the original seal.

## Multiple signatures

A document can have multiple signers:

```bash
# First signer
intenttext seal contract.it --signer "Ahmed Al-Rashid" --role "CEO, Acme Corp"

# Second signer (adds another sign: block, re-computes freeze:)
intenttext seal contract.it --signer "Maria Santos" --role "COO, GlobalTech"
```

After both:

```intenttext
sign: Ahmed Al-Rashid | role: CEO, Acme Corp | at: 2026-03-22T10:00:00Z | hash: sha256:a1b2c3d4
sign: Maria Santos | role: COO, GlobalTech | at: 2026-03-22T14:30:00Z | hash: sha256:e5f6a7b8
freeze: | status: locked | at: 2026-03-22T14:30:00Z | hash: sha256:e5f6a7b8
```

## Verification in code

```javascript
import { parseIntentText, verify } from "intenttext";

const doc = parseIntentText(source);
const result = verify(doc);

if (result.valid) {
  console.log("Seal intact");
  console.log("Signatures:", result.signatures);
  console.log("Amendments:", result.amendments.length);
} else {
  console.log("SEAL BROKEN:", result.reason);
}
```

## Complete workflow

```bash
# 1. Write the contract
# 2. Review and add approvals (manually or via editor)
# 3. Seal
intenttext seal contract.it --signer "Ahmed Al-Rashid" --role "CEO"

# 4. Send to counterparty, they seal too
intenttext seal contract.it --signer "Maria Santos" --role "COO"

# 5. Verify at any time
intenttext verify contract.it

# 6. View full history
intenttext history contract.it
```

## Next steps

- [Amending Frozen Documents](./amending-frozen-docs) — when a sealed contract needs changes
- [Approval Workflow](./approval-workflow) — the full approve → sign → freeze flow
- [Audit Trail](./audit-trail) — revision tracking
