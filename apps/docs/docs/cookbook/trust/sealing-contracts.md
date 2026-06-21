---
sidebar_position: 2
title: Sealing Contracts
---

# Sealing Contracts

## The problem

You need to prove a document hasn't been tampered with since it was signed. If someone changes a word, you need to know.

## The solution

`dotit seal` computes a SHA-256 hash of the document content, adds a `sign:` block and a `freeze:` block. `dotit verify` checks the hash against the current content.

### Seal

```bash
dotit seal contract.it --signer "Ahmed Al-Rashid" --role "CEO"
```

This adds to the document:

```intenttext
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-22T15:00:00Z | hash: sha256:a1b2c3d4e5f6a7b8 | spec: 4
freeze: | at: 2026-03-22T15:00:00Z | hash: sha256:a1b2c3d4e5f6a7b8 | spec: 4 | status: locked
```

### Verify

```bash
dotit verify contract.it
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

The hash is computed from **document content above the history boundary**, excluding trust
metadata, comments, and presentation. The current ruleset is `spec: 4`. It covers:

- `title:`, `summary:`, `meta:` blocks
- All section content
- All block content and **content** properties
- `approve:` blocks

The hash does **not** cover:

- `sign:`/`freeze:`/`certify:`/`amendment:` lines (the seal/signature scope keeps the
  `freeze:` line with its own `hash:` blanked; everything else is stripped)
- **Styling** — presentation lines (`page:`, `font:`, `style:`) and presentation
  properties (`color`, `size`, `align`, `margin`, `leading`, …). **Restyling never breaks
  a seal** — "sign content, not presentation."
- **Comments** (`//` lines)
- The `history:` boundary and revisions below it

This is what makes amendments possible: `amendment:` lines are excluded from the content
(like `sign:` and `freeze:`), so adding one never breaks the original seal. Likewise,
re-theming or reformatting a sealed contract leaves its seal intact.

Two scopes share this algorithm: each `sign:` line hashes the **content** (and binds the
signer's `name | role | at`), while the `freeze:` line hashes the **seal** scope — the
content _plus_ the signatures _plus_ the seal's own metadata.

## Multiple signatures

A document can have multiple signers:

```bash
# First signer
dotit seal contract.it --signer "Ahmed Al-Rashid" --role "CEO, Acme Corp"

# Second signer (adds another sign: block, re-computes freeze:)
dotit seal contract.it --signer "Maria Santos" --role "COO, GlobalTech"
```

After both:

```intenttext
sign: Ahmed Al-Rashid | role: CEO, Acme Corp | at: 2026-03-22T10:00:00Z | hash: sha256:a1b2c3d4 | spec: 4
sign: Maria Santos | role: COO, GlobalTech | at: 2026-03-22T14:30:00Z | hash: sha256:e5f6a7b8 | spec: 4
freeze: | at: 2026-03-22T14:30:00Z | hash: sha256:e5f6a7b8 | spec: 4 | status: locked
```

## Verification in code

```javascript
import { verifyDocument } from "@dotit/core";

// verifyDocument takes the raw .it source string — the hash covers exact bytes
const result = verifyDocument(source);

if (result.intact) {
  console.log("Seal intact:", result.hash);
  for (const s of result.signers ?? []) {
    console.log(`${s.signer} (${s.role}) — valid: ${s.valid}`);
  }
} else {
  console.log("SEAL BROKEN");
  console.log("Expected:", result.expectedHash);
  console.log("Actual:  ", result.hash);
}
```

To seal in code, use `sealDocument(source, { signer, role })` — it returns `{ success, hash, source, at }`. Store the returned `source` exactly as-is (no trimming, no CRLF conversion): the hash covers the exact bytes.

## Complete workflow

```bash
# 1. Write the contract
# 2. Review and add approvals (manually or via editor)
# 3. Seal
dotit seal contract.it --signer "Ahmed Al-Rashid" --role "CEO"

# 4. Send to counterparty, they seal too
dotit seal contract.it --signer "Maria Santos" --role "COO"

# 5. Verify at any time
dotit verify contract.it

# 6. View full history
dotit history contract.it
```

## Next steps

- [Amending Frozen Documents](./amending-frozen-docs) — when a sealed contract needs changes
- [Approval Workflow](./approval-workflow) — the full approve → sign → freeze flow
- [Audit Trail](./audit-trail) — revision tracking
