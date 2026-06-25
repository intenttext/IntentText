---
sidebar_position: 1
title: Approval Workflow
---

# Approval Workflow

## The problem

A document needs review and sign-off from multiple people — legal, finance, management — before it becomes official.

## The solution

IntentText has three keywords for the approval chain: `approve:` → `sign:` → `freeze:`.

```intenttext
title: Service Agreement — Acme Corp & GlobalTech Industries
summary: Annual IT support contract
meta: | type: contract | domain: legal | track: true

section: Terms
Provider shall deliver monthly IT support services...
Payment within 30 days of invoice.

section: Approval Chain

// Step 1: Approvals (review, no crypto)
approve: Legal review complete | by: Sarah Chen | role: General Counsel | at: 2026-03-20
approve: Finance approved | by: James Miller | role: CFO | at: 2026-03-21
approve: Management sign-off | by: Lisa Park | role: CTO | at: 2026-03-21

// Step 2: Integrity hash seals (tamper-evident)
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-22T10:00:00Z | hash: sha256:a1b2c3d4 | spec: 4
sign: Maria Santos | role: COO, GlobalTech | at: 2026-03-22T14:30:00Z | hash: sha256:e5f6a7b8 | spec: 4

// Step 3: Freeze (seal the document)
freeze: | at: 2026-03-22T15:00:00Z | hash: sha256:f9a0b1c2 | spec: 4 | status: locked

track: | by: legal@acme.co
```

## Step by step

### 1. Enable tracking

```intenttext
meta: | type: contract | track: true
```

`track: true` in metadata enables the trust chain. Without it, `approve:`, `sign:`, and `freeze:` still parse, but the document isn't formally tracked.

### 2. Record approvals

```intenttext
approve: Legal review complete | by: Sarah Chen | role: General Counsel | at: 2026-03-20
```

Each `approve:` block records:

- **What** was approved (the content)
- **Who** approved it (`by:`)
- **Their role** (`role:`)
- **When** (`at:`)

Add as many `approve:` blocks as your workflow requires. Common chains:

- Legal → Finance → Management
- Technical → Security → Architecture
- Author → Editor → Publisher

### 3. Add digital signatures

```intenttext
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-22T10:00:00Z | hash: sha256:a1b2c3d4 | spec: 4
```

`sign:` records a SHA-256 hash of the document content at the time of signing (and binds the signer's identity). This is machine-verifiable: if anyone changes the content, the hash won't match.

### 4. Freeze the document

```intenttext
freeze: | at: 2026-03-22T15:00:00Z | hash: sha256:f9a0b1c2 | spec: 4 | status: locked
```

`freeze:` seals the document. The hash covers all content above the `history:` boundary — including the signatures and the seal's own metadata — but **excludes** the `sign:`/`freeze:`/`amendment:` payload, **styling** (presentation lines/properties), and **comments** (`approve:` lines ARE included). After freezing, any edit to the content invalidates the seal; restyling does not.

## In-file approval routing: `route:` and `require:`

The `approve:` lines above record _what already happened_. To declare _what must still
happen_ — the policy — a document carries its own approval route. The route travels **inside**
the file, and its live state is **derived**, never stored in a database:

```intenttext
title: Purchase Order PO-9001
meta: | type: purchase-order
summary: Capital equipment purchase — routed for sequential approval.

route: sequential
require: manager
require: finance | when: amount > 100000
require: legal

section: Order
text: Supplier | end: Medad Industrial Co.
metric: Amount | value: 250000 | unit: USD

section: Approvals
approve: Within budget; vendor vetted | by: Sarah Chen | role: manager | at: 2026-03-20
approve: Funds confirmed for Q2 | by: James Miller | role: finance | at: 2026-03-21
// legal approval is still pending
```

Three canonical contract-tier keywords work together:

- **`route:`** declares the order — `sequential` (each approver in turn) or `parallel`
  (any order). `route:` and `require:` are stable canonical keywords (and `certify:` records
  an authority certification).
- **`require:`** declares **who** must approve, by role. Add `when:` to make a requirement
  conditional — and like every form/route condition, `when:` holds **exactly one comparison**
  (`==`, `!=`, `>`, `<`, `>=`, `<=`). Here `finance` is only required `when: amount > 100000`.
- **`approve:`** fulfils a requirement. An approval matches a requirement by its `role:`.

### Derived workflow state

`workflowState(source)` computes where the route stands right now — you never persist this,
you re-derive it from the document:

```javascript
import { workflowState } from "@dotit/core";

const state = workflowState(source);
// {
//   hasRoute: true,
//   order: "sequential",
//   required: [ { match: "manager" }, { match: "finance", when: "amount > 100000" }, { match: "legal" } ],
//   active:   [ … requirements whose `when:` currently holds … ],
//   fulfilled: ["manager", "finance"],
//   pending:   ["legal"],
//   next:      "legal",     // who's up now (null when complete)
//   complete:  false,       // true once every active requirement is fulfilled
// }
```

Because `amount` is `250000`, the `when: amount > 100000` condition holds, so `finance` is
**active** and must approve; manager and finance have signed off, leaving `next: "legal"` and
`complete: false`. Drop the amount below 100000 and `finance` falls out of `active` — the
route would be complete after manager and legal alone. (`deriveWorkflowState(doc)` is the
same computation if you already have a parsed document; `extractRoute(doc)` returns just the
declared route.)

This is what drives the **approval-route panel** in the editor: it reads `workflowState` to
show the ordered approvers, ticks off the fulfilled ones, and highlights `next` — no external
workflow engine, the file _is_ the workflow.

## Using the CLI

The `seal` command automates steps 2–4:

```bash
dotit seal contract.it --signer "Ahmed Al-Rashid" --role "CEO"
```

This:

1. Computes a content hash
2. Adds a `sign:` block
3. Adds a `freeze:` block
4. Writes the updated document

## Querying approvals

```bash
# Find all approved documents
dotit query ./contracts --type approve --format table

# Who approved what?
dotit query ./contracts --type approve --by "Sarah Chen" --format json

# Find unsigned documents (have approve but no freeze)
dotit ask ./contracts "Which contracts have approvals but no freeze?" --format text
```

## Next steps

- [Sealing Contracts](./sealing-contracts) — deep dive on the seal command and verification
- [Amending Frozen Documents](./amending-frozen-docs) — changing a frozen document formally
- [Audit Trail](./audit-trail) — tracking changes over time
- [Fillable Forms](../forms/fillable-forms) — route a completed form for sign-off
- [Conformance](./conformance) — gate a document before it enters the approval route
