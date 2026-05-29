---
sidebar_position: 4
title: Your First Document
---

# Your First Document

Build a complete, professional invoice from scratch — with contacts, deadlines, metrics, approval, and a seal.

## Start with identity

Every `.it` file starts with what the document _is_:

```intenttext
title: Invoice INV-2026-042
summary: Consulting services — Acme Corp — Q2 2026
meta: | type: invoice | currency: USD | ref: INV-2026-042
track: | version: 1.0 | by: Ahmed Al-Rashid
```

`title:` becomes the H1. `summary:` is the subtitle. `meta:` holds machine-readable metadata. `track:` activates change history.

## Add the parties

Use `contact:` to declare who's involved:

```intenttext
section: Parties

contact: Ahmed Al-Rashid | role: CEO | email: ahmed@acme.com | org: Acme Corp | phone: +971-4-555-0100
contact: James Miller | role: CFO | email: j.miller@globaltech.co | org: GlobalTech Inc. | phone: +1-415-555-0200
```

Every `contact:` is queryable. Later, you can run `intenttext query ./invoices --type contact --org "Acme"` and find every contact across every invoice.

## Add line items

Use a Markdown pipe table with `each:` for dynamic rows:

```intenttext
section: Line Items

| Description | Hours | Rate | Total | each: items |
| {{item.description}} | {{item.hours}} | {{item.rate}} | {{item.total}} |
```

Or for a static invoice, write the rows directly:

```intenttext
section: Line Items

| Description               | Hours | Rate      | Total      |
| Strategy consultation     | 40    | USD 150   | USD 6,000  |
| Technical implementation  | 80    | USD 150   | USD 12,000 |
| Project management        | 40    | USD 150   | USD 6,000  |
```

## Add totals with metrics

```intenttext
section: Summary

metric: Subtotal | value: 24000 | unit: USD
metric: Tax (5%) | value: 1200 | unit: USD
metric: Total Due | value: 25200 | unit: USD | weight: bold
```

`metric:` blocks are queryable and renderable. They show up in dashboards, queries, and reports.

## Set the deadline

```intenttext
deadline: Payment due | date: 2026-04-30 | consequence: Late fee of 1.5% per month | owner: GlobalTech Inc.
```

`deadline:` renders with proximity color coding — green when far away, amber when approaching, red when overdue.

## Approve and seal

```intenttext
approve: Reviewed and approved | by: Sarah Chen | role: Finance Director | at: 2026-03-06
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-06T14:32:00Z
freeze: | status: locked | at: 2026-03-06T14:33:00Z
```

Now seal it with the CLI:

```bash
intenttext seal invoice.it --signer "Ahmed Al-Rashid" --role "CEO"
```

The document is now frozen. Any edit breaks the hash.

## Verify anytime

```bash
intenttext verify invoice.it
```

```
✓ Document integrity verified
  Signer: Ahmed Al-Rashid (CEO)
  Sealed: 2026-03-06T14:33:00Z
  Hash: sha256:a1b2c3...
  Status: INTACT — no modifications detected
```

## Render it

```bash
intenttext invoice.it --html --theme corporate
intenttext invoice.it --print --theme corporate
intenttext invoice.it --print --theme corporate --pdf invoice.pdf
```

## The complete file

```intenttext
title: Invoice INV-2026-042
summary: Consulting services — Acme Corp — Q2 2026
meta: | type: invoice | currency: USD | ref: INV-2026-042
track: | version: 1.0 | by: Ahmed Al-Rashid

section: Parties
contact: Ahmed Al-Rashid | role: CEO | email: ahmed@acme.com | org: Acme Corp
contact: James Miller | role: CFO | email: j.miller@globaltech.co | org: GlobalTech Inc.

section: Line Items
| Description               | Hours | Rate      | Total      |
| Strategy consultation     | 40    | USD 150   | USD 6,000  |
| Technical implementation  | 80    | USD 150   | USD 12,000 |
| Project management        | 40    | USD 150   | USD 6,000  |

section: Summary
metric: Subtotal | value: 24000 | unit: USD
metric: Tax (5%) | value: 1200 | unit: USD
metric: Total Due | value: 25200 | unit: USD

deadline: Payment due | date: 2026-04-30 | consequence: Late fee of 1.5% per month

approve: Reviewed and approved | by: Sarah Chen | role: Finance Director
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-06T14:32:00Z
freeze: | status: locked
```

---

**Next:** [Turn this into a reusable template →](./first-template)
