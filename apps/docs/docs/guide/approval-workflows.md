---
title: Approval Workflows (in the document)
description: Carry the approval policy, live state, and a tamper-evident audit trail inside the .it file itself — route:/require:, workflowState(), and a hash-chained approval log. No external workflow database.
---

# Approval workflows — inside the document

Most systems run approvals in a database: a row somewhere tracks "who must sign,
who has signed, what's next," and the document is just an attachment in S3. The two
drift. The database says approved; the file in storage is a different version. The
audit log lives in one system, the document in another, and reconciling them is a
project.

IntentText puts the **whole workflow inside the file**:

- the **policy** — who must approve, in what order — is declared with `route:` / `require:`
- the **fulfillment** — who actually approved — is ordinary `approve:` lines
- the **live state** — pending, next, complete — is *derived* from those lines, never stored
- the **audit trail** — the sequence of approvals — is **hash-chained** so it can't be
  reordered, back-dated, or have entries inserted or deleted without detection

The `.it` document is the single source of truth. Re-deriving its state always matches
the file, because there is no second copy to drift from.

:::note This builds on Trust & Signing
Approvals here are the same `approve:` lines from [Trust & Signing](./trust-and-signing) —
this page adds the **policy** that says which approvals are *required*, and the
**chaining** that makes their *order* tamper-evident. Read that page first if `approve:`
/ `sign:` / `freeze:` are new to you.
:::

## 1. Declare the policy: `route:` and `require:`

Two lines describe an approval policy:

```intenttext
route: sequential
require: manager
require: finance | when: amount > 100000
require: legal
```

- **`route:`** sets the order — `sequential` (default) means approvers act in the order
  listed; `parallel` means order doesn't matter, all required approvers must approve.
- **`require:`** names one required approver. The token (`manager`, `finance`, `legal`)
  is matched against an `approve:` line's `role:` or `by:`.
  - `| when: <condition>` makes the requirement **conditional** — it only applies while
    the condition holds (evaluated against the document's own `metric:` / `meta:` values,
    on the same safe, no-`eval` evaluator that forms use). Above, `finance` is only
    required when `amount` exceeds 100000.
  - `| optional: yes` marks an approver as informational — they may approve, but their
    absence never blocks completion.

`route:` and `require:` are **not** core keywords — they parse as preserved `custom`
blocks (the [unknown-keyword guarantee](../reference/keywords/index.md)). That means they
round-trip byte-for-byte and **a sealed document keeps its hash** with a policy inside it.
There is no workflow registry, no schema to register, nothing to configure server-side.

## 2. Fulfill it: ordinary `approve:` lines

Approvers sign off with the `approve:` lines you already know. The `role:` or `by:` token
is what matches a `require:`:

```intenttext
approve: Reviewed and approved | by: Sarah Chen | role: manager | at: 2026-03-20
approve: Budget confirmed | by: James Miller | role: finance | at: 2026-03-21
```

Because `approve:` lines are inside the hashed body, the fulfillment is part of what gets
sealed — you can't seal a document and later claim a different set of approvals.

## 3. Read the live state: `workflowState()`

`workflowState(source)` derives the current state purely from the `route:`/`require:`
policy and the `approve:` lines present:

```typescript
import { workflowState } from "@dotit/core";

const state = workflowState(source);
// {
//   hasRoute: true,
//   order: "sequential",
//   required:  [ { match: "manager", optional: false }, … ],
//   active:    [ … ],          // requirements whose `when:` currently holds
//   fulfilled: ["manager"],    // active requirements that have a matching approval
//   pending:   ["finance", "legal"],  // active, required, still awaiting approval
//   next:      "finance",      // sequential: the first pending approver (null if parallel/none)
//   complete:  false,          // true when nothing required is still pending
// }
```

| Field | Meaning |
| --- | --- |
| `hasRoute` | The document declares a `route:`/`require:` policy. |
| `order` | `sequential` or `parallel`. |
| `required` | Every declared requirement, verbatim. |
| `active` | Requirements currently in force (their `when:` holds, or they have none). |
| `fulfilled` | Active requirements that have a matching approval. |
| `pending` | Active, non-optional requirements still awaiting approval, **in declared order**. |
| `next` | Sequential: the first pending approver. Parallel or none: `null`. |
| `complete` | `true` when no required approver is still pending. |

This is what you render as a "who's next" widget, gate a publish action on, or decide
whether the document is ready to seal. A document with **no** policy returns
`complete: true` (nothing is outstanding).

```typescript
// Gate an action on the document's own declared policy:
if (!workflowState(source).complete) {
  throw new Error(`Awaiting approval from: ${workflowState(source).pending.join(", ")}`);
}
```

### Conditional requirements

`when:` is evaluated against the document's own data — `metric:` values (by label or
`key:`) and `meta:` properties:

```intenttext
metric: amount | value: 250000
metric: region | value: EU

route: sequential
require: manager
require: finance | when: amount > 100000
require: compliance | when: region = EU
```

Here both `finance` and `compliance` are active. Change `amount` to `50000` and `finance`
drops out of `pending` — the requirement simply isn't in force. An **unresolvable**
condition (a value the document doesn't carry) defaults to **active**: IntentText never
silently drops a required approval because a value was missing.

## 4. Make the order tamper-evident: the audit chain

The seal proves the document **body** is intact, and each `sign:` carries the body hash.
But on its own, nothing stops someone from inserting an approval, deleting one, or
reordering them *before* the document is sealed. The **audit chain** closes that gap.

`appendApproval` adds an `approve:` line that carries `prev:` — the hash of the
immediately preceding audit event (or, for the first link, a stable anchor over the
document body). Each link commits to everything before it, so any insertion, deletion,
or reordering breaks the chain:

```typescript
import { appendApproval, verifyAuditChain } from "@dotit/core";

let src = baseDocument;
src = appendApproval(src, { by: "Sarah Chen", role: "manager", note: "Reviewed" });
src = appendApproval(src, { by: "James Miller", role: "finance", note: "Budget confirmed" });

// → each line now carries prev: sha256:…
// approve: Reviewed | by: Sarah Chen | role: manager | at: 2026-03-20T… | prev: sha256:abc…
// approve: Budget confirmed | by: James Miller | role: finance | at: … | prev: sha256:def…

const chain = verifyAuditChain(src);
// { valid: true, length: 2, chained: 2 }
```

If anyone edits, reorders, or removes a chained approval, verification reports the first
broken link:

```typescript
const chain = verifyAuditChain(tamperedSource);
// {
//   valid: false,
//   length: 2,
//   chained: 2,
//   brokenAt: 1,
//   reason: "audit link 1 (approve) expected prev sha256:def012… but found sha256:000…",
// }
```

Use `appendApproval` **before sealing** — `approve:` is part of the hashed body, so the
chain is itself covered by the final seal. After that, the seal protects the body and the
chain protects the order; together they make the entire approval history tamper-evident.

`auditTrail(source)` returns the ordered events (`approve` / `sign` / `freeze` /
`amendment` / `revision`) if you want to render or export the trail directly.

:::note Chained and un-chained approvals coexist
A plain `approve:` line written by hand (no `prev:`) is a valid, un-chained link.
`verifyAuditChain` reports it as un-chained — never as *tampered*. You opt into chaining
by using `appendApproval`; older documents and hand-edited approvals still verify.
:::

## Putting it together

A purchase order that approves itself, in order, with a tamper-evident trail — and seals:

```intenttext
title: Purchase Order PO-2026-114
metric: amount | value: 250000

route: sequential
require: manager
require: finance | when: amount > 100000
require: legal | optional: yes

approve: Reviewed | by: Sarah Chen | role: manager | at: 2026-03-20 | prev: sha256:…
approve: Budget confirmed | by: James Miller | role: finance | at: 2026-03-21 | prev: sha256:…
sign: James Miller | role: finance | at: 2026-03-21T16:00:00Z | hash: sha256:… | spec: 4
freeze: | at: 2026-03-21T16:01:00Z | hash: sha256:… | spec: 4 | status: locked
```

```typescript
import { workflowState, verifyAuditChain, verifyDocument } from "@dotit/core";

verifyDocument(src).intact;     // body unchanged since sealing
verifyAuditChain(src).valid;    // approval order intact
workflowState(src).complete;    // every required approver signed off
```

Three offline checks, answered from the file alone — no workflow database, no S3 lookup,
no reconciliation. The document *is* the workflow.

## Why this is the moat

- **One source of truth.** State is derived, not stored, so it can't drift from the file.
- **Portable.** Email the `.it`, commit it to Git, drop it in any store — the policy,
  the approvals, and the proof travel with it.
- **Offline-verifiable forever.** No server is required to answer "is this fully approved
  and was the order intact?" — just the file and SHA-256.
- **Byte-sacred.** Because `route:`/`require:`/`prev:` live in preserved lines, none of
  this perturbs the seal. See [Byte Preservation](./byte-preservation).

---

**Related:**

- [Trust & Signing →](./trust-and-signing) — approve / sign / freeze / amend, and the hash spec
- [Byte Preservation →](./byte-preservation) — why a sealed `.it` never loses its seal
- [Config & Options →](./config-and-options) — the same routing + audit applied to config files
- [ERP / App Integration →](../ecosystem/erp-integration) — wiring this into a backend
- [Trust Spec →](../reference/trust-spec) — the normative definition
