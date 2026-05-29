---
sidebar_position: 2
title: Contract
---

# Contract

## The problem

You need a verifiable contract with defined terms, an approval trail, digital and physical signatures, and the ability to formally amend it after signing.

## The solution

```intenttext
title: Service Agreement — Acme Corp & GlobalTech Industries
summary: Annual IT support and cloud infrastructure management
meta: | type: contract | domain: legal | track: true

page: | size: A4 | margins: 2.54cm
font: | body: Inter | heading: Inter | size: 11pt
header: CONFIDENTIAL | align: right | size: 8pt
footer: Service Agreement — Page {page} of {pages} | align: center | size: 8pt

section: Definitions

def: Provider | meaning: Acme Corp, a Delaware corporation
def: Client | meaning: GlobalTech Industries, a California corporation
def: Services | meaning: IT support, cloud infrastructure management, and security monitoring as described in Section: Scope
def: Term | meaning: The 12-month period beginning on the Effective Date

section: Parties

contact: Acme Corp | role: Provider | email: legal@acme.co | org: Acme Corp
contact: GlobalTech Industries | role: Client | email: contracts@globaltech.co | org: GlobalTech Industries

section: Scope

text: Provider shall deliver the Services to Client for the duration of the Term, including:
text: 1. 24/7 infrastructure monitoring
text: 2. Monthly security audits
text: 3. Quarterly performance reviews
text: 4. On-call incident response (< 1 hour SLA)

section: Timeline

deadline: Contract effective | due: 2026-04-01 | status: confirmed
deadline: Q1 review | due: 2026-07-01 | status: pending
deadline: Q2 review | due: 2026-10-01 | status: pending
deadline: Contract renewal | due: 2027-03-31 | status: pending

section: Payment

metric: Monthly retainer | value: 15000 | unit: USD
metric: Annual value | value: 180000 | unit: USD | weight: bold
deadline: Payment due | due: 2026-04-15 | status: pending
text: Payment due within 15 days of each monthly invoice.

section: Signatures

approve: Legal review complete | by: Sarah Chen | role: General Counsel | at: 2026-03-20
approve: Finance approved | by: James Miller | role: CFO | at: 2026-03-21

sign: Ahmed Al-Rashid | role: CEO, Acme Corp | at: 2026-03-22T10:00:00Z | hash: sha256:a1b2c3d4
sign: Maria Santos | role: COO, GlobalTech | at: 2026-03-22T14:30:00Z | hash: sha256:e5f6a7b8

// Physical signature lines for the printed version
signline: Ahmed Al-Rashid | role: CEO, Acme Corp | label: Provider Signature
signline: | label: Date | width: 30%

break: | before: 0.5cm

signline: Maria Santos | role: COO, GlobalTech | label: Client Signature
signline: | label: Date | width: 30%

freeze: | status: locked | at: 2026-03-22T15:00:00Z | hash: sha256:f9a0b1c2

track: | by: legal@acme.co
```

## Step by step

1. **Definitions** — `def:` creates queryable, machine-readable defined terms. Every reference to "Provider" or "Client" has a formal definition.
2. **Contacts** — `contact:` for both parties. Query across all contracts to find every deal with a specific company.
3. **Deadlines** — `deadline:` for every milestone. Query to find upcoming deadlines across all contracts.
4. **Metrics** — `metric:` for financial terms. Queryable and renderable.
5. **Approvals** — `approve:` records who reviewed and when. Multiple approvals are standard: legal, finance, management.
6. **Digital signatures** — `sign:` with content hashes. Machine-verifiable.
7. **Physical signatures** — `signline:` creates lines on the printed page for wet-ink signatures.
8. **Freeze** — `freeze:` seals the document. Any content edit will invalidate the hash.

## Seal and verify

```bash
# Seal the contract (adds sign: and freeze: automatically)
intenttext seal contract.it --signer "Ahmed Al-Rashid" --role "CEO, Acme Corp"

# Verify integrity
intenttext verify contract.it
# ✓ Document sealed at 2026-03-22T15:00:00Z
# ✓ Hash valid: sha256:f9a0b1c2
# ✓ 2 signatures, 2 approvals
```

## Amend after sealing

Six months later, payment terms need to change:

```bash
intenttext amend contract.it \
  --section "Payment" \
  --was "Payment due within 15 days" \
  --now "Payment due within 30 days" \
  --ref "Amendment #1" \
  --by "Ahmed Al-Rashid"
```

The contract now has:

```intenttext
// Original content preserved, seal intact

amendment: Payment terms updated | section: Payment | was: Payment due within 15 days | now: Payment due within 30 days | ref: Amendment #1 | by: Ahmed Al-Rashid | at: 2026-09-15
```

Verify after amendment:

```bash
intenttext verify contract.it
# ✓ Original seal valid: sha256:f9a0b1c2
# ⚡ 1 amendment applied
#   Amendment #1: Payment terms updated (2026-09-15)
```

## Query it

```bash
# All contracts with GlobalTech
intenttext query ./contracts --type contact --content "GlobalTech" --format table

# Upcoming deadlines
intenttext query ./contracts --type deadline --format table

# All defined terms
intenttext query ./contracts --type def --format json

# All amendments
intenttext query ./contracts --type amendment --format table
```

## Next steps

- [Amending Frozen Documents](../trust/amending-frozen-docs) — the full amendment workflow
- [Approval Workflow](../trust/approval-workflow) — detailed approve → sign → freeze flow
- [Contact Directory](../organizations/contact-directory) — build a directory from contract contacts
