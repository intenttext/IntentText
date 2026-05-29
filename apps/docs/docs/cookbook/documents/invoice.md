---
sidebar_position: 1
title: Invoice
---

# Invoice

## The problem

You need a professional invoice that renders to PDF, has queryable line items, and supports payment tracking with deadlines.

## The solution

```intenttext
title: Invoice #2026-0042
summary: Cloud migration services — Phase 1
meta: | type: invoice | domain: finance | track: true

// Print layout
page: | size: A4 | margins: 2.54cm
font: | body: Inter | heading: Inter | size: 11pt
header: Acme Corp | align: left | size: 9pt
footer: Page {page} of {pages} | align: center | size: 8pt

section: Parties

contact: Acme Corp | role: Provider | email: billing@acme.co | phone: +1-555-0100
contact: GlobalTech Industries | role: Client | email: accounts@globaltech.co | phone: +1-555-0200

section: Line Items

| Description | Qty | Unit Price | Total |
| Cloud infrastructure setup | 1 | $15,000 | $15,000 |
| Data migration (500GB) | 1 | $8,000 | $8,000 |
| Security audit | 2 | $5,000 | $10,000 |
| Training sessions | 4 | $2,000 | $8,000 |

section: Summary

metric: Subtotal | value: 41000 | unit: USD
metric: Tax (8%) | value: 3280 | unit: USD
metric: Total Due | value: 44280 | unit: USD | color: green | weight: bold

section: Payment

deadline: Payment due | due: 2026-04-15 | status: pending
text: Wire transfer to Acme Corp, Account #****4521, Routing #****7890.
text: Late payments subject to 1.5% monthly interest.

track: | by: billing@acme.co
```

## Step by step

1. **Identity** — `title:` and `summary:` identify the invoice. `meta:` with `track: true` enables the trust chain.
2. **Layout** — `page:`, `font:`, `header:`, `footer:` control PDF rendering.
3. **Contacts** — `contact:` blocks for both parties. These are queryable across all your invoices.
4. **Table** — Standard table for line items. For templates, use `each: items` to make this dynamic.
5. **Metrics** — `metric:` blocks for subtotal, tax, total. Queryable and renderable with emphasis.
6. **Deadline** — `deadline:` for payment due date. Color-coded by proximity in rendered output.
7. **Track** — `track:` enables the revision history.

## Query it

```bash
# Find all pending invoices
intenttext query ./invoices --type deadline --status pending --format table

# Find invoices for a specific client
intenttext query ./invoices --type contact --content "GlobalTech" --format json

# Total revenue across all invoices
intenttext query ./invoices --type metric --content "Total Due" --format csv
```

## Render to PDF

```bash
intenttext invoice.it --print --theme corporate
intenttext invoice.it --pdf --theme corporate
```

## Template version

Convert this to a reusable template. See [Building Templates](../templates/building-templates).

## Next steps

- [Dynamic Tables](../templates/dynamic-tables) — make line items dynamic with `each:`
- [Sealing Contracts](../trust/sealing-contracts) — add integrity verification
- [Deadline Tracking](../organizations/deadline-tracking) — track payment deadlines across invoices
