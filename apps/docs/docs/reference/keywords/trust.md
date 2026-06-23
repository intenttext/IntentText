---
sidebar_position: 8
title: Trust Keywords
---

# Trust Keywords

The canonical **contract** tier holds 9 keywords for document integrity, authority, and
in-file approval routing: `track:`, `approve:`, `sign:`, `freeze:`, `amendment:`, `certify:`,
`route:`, `require:`, and `cite:`. This page documents the trust and routing keywords —
tracking versions, recording approvals, signing with hash verification, sealing against
modification, formally amending sealed documents, certifying an authority identity, and
declaring an in-file approval policy with `route:`/`require:`. (`cite:` is documented with
[content keywords](./content); the machine-managed `x-trust: history`/`x-trust: revision`
blocks live below the audit-log boundary.)

## `track:`

**Category:** Trust
**Arabic:** `تتبع:`

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
**Arabic:** `اعتماد:`

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
- Queryable: `dotit query . --type approve --by "Sarah Chen"`

---

## `sign:`

**Category:** Trust
**Arabic:** `توقيع:`

Integrity hash seal. Records the signer's name, role, timestamp, and a SHA-256 hash of the document content at the time of signing. The hash **binds the signer's identity** (`name | role | at`), so editing either the content or the named signer breaks that signature. The hash **excludes styling and comments** — restyling never breaks it. If the document is modified after signing, the stored hash will no longer match and verification will report the discrepancy. This is tamper evidence via hash comparison, not cryptographic non-repudiation (anyone can type a name; proving *who* is the `@dotit/sign` layer below).

### Syntax

```
sign: signer name | role: title | at: timestamp | hash: algorithm:value | spec: version
```

### Properties

| Property | Type   | Required | Description                                          |
| -------- | ------ | -------- | ---------------------------------------------------- |
| `role`   | string | no       | Signer's role                                        |
| `at`     | string | no       | Signing timestamp (ISO 8601)                         |
| `hash`   | string | no       | Content hash at time of signing                      |
| `spec`   | number | no       | Seal ruleset version that produced the hash (current `4`) |

### Examples

```intenttext
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-06T14:32:00Z | hash: sha256:a1b2c3d4e5f6 | spec: 4
sign: James Miller | role: CFO | at: 2026-03-06T15:00:00Z
```

### Cryptographic upgrade (`key:` + `sig:`)

A plain `sign:` line (no `key:`/`sig:`) is a named approval, like `approve:`. To make it
cryptographically provable, the [`@dotit/sign`](../../guide/trust-and-signing#layer-2--identity-ed25519-signatures)
package adds `key:` (the signer's Ed25519 public key) and `sig:` (an Ed25519 signature over
the document hash):

```intenttext
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-06T14:32:00Z | hash: sha256:a1b2c3d4 | key: ed25519:<pubkey> | sig: <signature>
```

| Property | Type   | Description                                              |
| -------- | ------ | -------------------------------------------------------- |
| `key`    | string | Signer's Ed25519 public key (`ed25519:<base64url>`)      |
| `sig`    | string | Ed25519 signature over the document hash (base64url)     |

The public key travels in the line, so verification needs nothing but the file. Generated
and verified only by `@dotit/sign` (`signDocumentCrypto` / `verifyCryptoSignatures`) — never
hand-written.

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
**Arabic:** `تجميد:`

Seal the document. After `freeze:`, any edit to the **content** above invalidates the hash; the seal also covers the signatures and its own `at:`/`status:`, so editing those breaks it too. **Restyling and comments are excluded** — re-theming or reformatting a sealed document never breaks its seal.

### Syntax

```
freeze: | at: timestamp | hash: algorithm:value | spec: version | status: locked
```

### Properties

| Property | Type   | Description                                          |
| -------- | ------ | ---------------------------------------------------- |
| `status` | string | `locked`                                             |
| `at`     | string | Sealing timestamp (ISO 8601)                         |
| `hash`   | string | Seal hash (content + signatures + seal metadata)     |
| `spec`   | number | Seal ruleset version that produced the hash (current `4`) |

### Examples

```intenttext
freeze: | at: 2026-03-06T14:33:00Z | hash: sha256:e5f6a7b8 | spec: 4 | status: locked
```

### Notes

- `freeze:` content is typically empty — data is in properties
- After freezing, the only permitted additions are `amendment:` blocks
- Use `dotit seal` to compute the hash and add `sign:` + `freeze:` automatically
- Use `dotit verify` to check the hash against current content

---

## `amendment:`

**Category:** Trust
**Arabic:** `تعديل:`

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
- `dotit verify` reports both the original seal status and all amendments

### CLI

```bash
dotit amend contract.it \
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

## `route:`

**Category:** Trust (contract tier)
**Arabic:** —

Declares the **order** in which a document's required approvals are collected. With
`require:` it gives a `.it` document its own in-file approval workflow, whose live state is
**derived from the file** (`workflowState`) — never stored, so the document is the single
source of truth and can never drift from a separate database. `route:`/`require:` lines stay
inside the hashed body, so a sealed document keeps its hash.

### Syntax

```
route: sequential
route: parallel
```

The order may also be given as a property: `route: | order: sequential`.

### Properties

| Property | Type   | Required | Description                                                                 |
| -------- | ------ | -------- | --------------------------------------------------------------------------- |
| `order`  | enum   | no       | `sequential` (default) or `parallel`. The bare content (`route: parallel`) is read first, then this property. |

- **`sequential`** (default) — approvals are expected in the declared `require:` order; `next` is the first unfulfilled required approver.
- **`parallel`** — all required approvals may be collected in any order.

### Examples

```intenttext
route: sequential
require: manager
require: finance | when: amount > 100000
require: legal
```

### Notes

- Without a `route:`/`require:` policy a document has nothing outstanding (`complete: true`).
- `route:`/`require:` were reserved in 4.4. Documents authored earlier parsed them as `custom` blocks; the deriver still resolves those.

### Related

- [`require:`](#require) — the individual required approvers
- [`approve:`](#approve) — approvals fulfill the policy
- [Approval Workflows guide →](../../guide/approval-workflows)

---

## `require:`

**Category:** Trust (contract tier)
**Arabic:** —

Declares **one required approver** for the document's approval policy. Repeat `require:` once
per approver. A requirement is matched against the `role:`/`by:` token of the document's
`approve:` lines; an unmatched, non-optional requirement is what keeps the workflow open.

### Syntax

```
require: <role-or-name> | when: <condition> | optional: yes
```

### Properties

| Property   | Type   | Required | Description                                                                                                 |
| ---------- | ------ | -------- | ----------------------------------------------------------------------------------------------------------- |
| `when`     | string | no       | A **single comparison** (`key <op> value`) gating whether this approver is required (see below). When it does not hold, the requirement is inactive. |
| `optional` | enum   | no       | `yes`/`true` marks the requirement informational — it never blocks completion.                              |

The match token is the requirement's `content` (e.g. `require: legal`), falling back to a
`role:`/`by:` property if content is empty.

### Conditional requirements — `when:`

`when:` holds **one comparison**, `key <op> value` — operators `=` `==` `!=` `>` `<` `>=`
`<=` (`=` is loose for `==`). The compare is **numeric** when both sides parse as numbers
(thousands separators stripped), otherwise string. There is **no** `&&`/`||`/`!` and no
grouping — a single comparison only. The key is resolved against the document's own values:
`metric:` labels/keys and `meta:` properties. It runs on a safe recursive-descent evaluator,
never `eval`. An unresolvable condition defaults to **active** (a required approval is never
silently dropped because a value was missing).

```intenttext
metric: Contract Value | key: amount | value: 250000 | unit: USD

route: sequential
require: manager
require: finance | when: amount > 100000
require: legal | optional: yes
```

### Deriving the live state — `workflowState`

`workflowState(source)` (and `deriveWorkflowState(doc)`) DERIVE the live approval state
purely from the `route:`/`require:` lines and the `approve:` lines — nothing is stored, so
re-deriving always matches the file:

```ts
import { workflowState } from "@dotit/core";

const state = workflowState(source);
// → {
//     hasRoute,    // true when a route:/require: policy is declared
//     order,       // "sequential" | "parallel"
//     required,    // every declared requirement, verbatim: { match, when?, optional }
//     active,      // requirements currently in force (their when: holds, or none)
//     fulfilled,   // active required match-tokens that have a matching approve:
//     pending,     // active, non-optional match-tokens still awaiting approval (declared order)
//     next,        // the next pending approver (sequential), or null
//     complete,    // true when every active, required approver has approved
//   }
```

An `approve:` line fulfills a requirement when its `role:` or `by:` value equals the
requirement's match token:

```intenttext
require: manager
approve: Budget reviewed | by: Sarah | role: manager | at: 2026-03-20
// → manager is now fulfilled
```

### Examples

```intenttext
route: sequential
require: department-head
require: finance | when: amount >= 50000
require: ceo | when: amount >= 1000000
require: audit | optional: yes
```

### Notes

- A document with no `route:`/`require:` policy is `complete: true` (nothing outstanding).
- `require:`/`route:` round-trip byte-for-byte and stay inside the hashed body, so a sealed document keeps its hash.

### Related

- [`route:`](#route) — declares the approval order
- [`approve:`](#approve) — approvals fulfill the requirements
- [Approval Workflows guide →](../../guide/approval-workflows)

---

## `certify:` (authority layer)

**Category:** Trust (contract tier)
**Arabic:** —

`certify:` is a **canonical contract-tier keyword** — but unlike `sign:`/`freeze:` (which
are integrity, checkable from the bytes alone), it carries an *authority* claim that needs
the issuer's key to verify. The line itself is written by the
[`@dotit/sign`](../../guide/trust-and-signing#layer-3--authority-uts-certification) authority
layer: a certification authority (UTS) verifies the account/entity once, then issues a
`certify:` line that anyone can re-check offline. The core parser recognizes `certify:` and
round-trips it losslessly, but **presence of a `certify:` line is a claim, not a verdict** —
the certified trust tier is shown only when a caller passes a cryptographically verified
result from `@dotit/sign`.

### Syntax

```
certify: issuer | account: id | entity: legal name | at: timestamp | hash: sha256:value | key: ed25519:pubkey | sig: signature | ica: intermediate-cert
```

### Properties

| Property  | Type   | Required | Description                                                          |
| --------- | ------ | -------- | ------------------------------------------------------------------- |
| `account` | string | yes      | The certified account identifier                                    |
| `entity`  | string | no       | KYC-verified legal name (identity-verified accounts)                |
| `at`      | string | yes      | Certification timestamp (ISO 8601)                                  |
| `hash`    | string | yes      | The document hash being certified                                   |
| `key`     | string | yes      | The issuer's Ed25519 public key                                     |
| `sig`     | string | yes      | The issuer's signature over the certification payload               |
| `ica`     | string | no       | Intermediate certificate token chaining the signing key to a root  |

### Example

```intenttext
certify: UTS | account: al-diwan | entity: Al-Diwan Contracting W.L.L. | at: 2026-06-13T19:56:11Z | hash: sha256:a1b2c3d4 | key: ed25519:<pubkey> | sig: <signature> | ica: <intermediate-cert>
```

### Root → intermediate certificate hierarchy

`@dotit/sign` 1.3 adds a CA-style key hierarchy: an **offline root** key vouches for a
short-lived **online intermediate** key (via `issueIntermediate()`), producing the compact
`ica:` token embedded in each `certify:` line. Verifiers trust **only the root key** —
`verifyCertifications()` validates the chain root → intermediate → certification and returns
a `chain: { rootPublicKey, notBefore, notAfter }`. If the online intermediate key leaks, it
is rotated without re-trusting anything. A `certify:` line with no `ica:` falls back to the
legacy single-key model, where the signing key itself must be the trusted key.

### Notes

- `certify:` lines are **excluded from the document hash** (like `sign:`/`freeze:`/`amendment:`).
- Verified only by `@dotit/sign` (`verifyCertifications`) — never hand-computed.

---

## The trust chain

A typical trust workflow combines the routing and integrity keywords:

```intenttext
title: Service Agreement

section: Parties
contact: Ahmed Al-Rashid | role: CEO | email: ahmed@acme.com
contact: Sarah Chen | role: General Counsel | email: sarah@acme.com

section: Terms
text: Full contract terms...

track: | version: 1.0 | by: Ahmed Al-Rashid
approve: Legal review complete | by: Sarah Chen | role: General Counsel | at: 2026-03-05
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-06T14:32:00Z | hash: sha256:a1b2c3d4 | spec: 4
freeze: | at: 2026-03-06T14:33:00Z | hash: sha256:e5f6a7b8 | spec: 4 | status: locked
```

---

## Extension keywords

Automated history and revision blocks are available in the `x-trust:` namespace. These are managed by the CLI — you do not write them manually.

| Extension            | Purpose                                            |
| -------------------- | -------------------------------------------------- |
| `x-trust: history`   | History boundary marker — separates live document from machine-managed history section |
| `x-trust: revision`  | Auto-generated change record written by `dotit seal` and `dotit amend` |

See the extensions overview in [Keywords →](./index.md#extension-keywords) for full syntax.
