---
slug: v211-keyword-expansion
title: "v2.11: Eight New Keywords — Amendment, Metric, Contact, Deadline, and More"
authors: [intenttext]
tags: [release, keywords]
---

v2.11 adds eight keywords that close the gap between IntentText and the real documents organizations produce every day: `amendment`, `metric`, `contact`, `deadline`, `def`, `figure`, `signline`, and `cite`.

<!-- truncate -->

## The amendment story

Frozen documents have a problem. After you seal a contract, reality changes. Payment terms get renegotiated. Scopes expand. Parties are replaced. Until v2.11, your only option was to create a new document.

The `amendment:` keyword gives frozen documents a formal amendment path:

```
amendment: Payment terms revised
  | ref: Amendment #1
  | section: Payment Terms
  | was: Net 30
  | now: Net 15
  | by: Ahmed Al-Rashid
  | at: 2026-03-07T09:00:00Z
```

Amendments are recorded in the trust history. They reference the section they modify, capture what changed, and track who authorized the change. The original document remains sealed — the amendment sits alongside it as an auditable record.

```bash
intenttext amend contract.it --section "Payment Terms" --was "Net 30" --now "Net 15" --ref "Amendment #1"
```

This is how legal teams actually work. Contracts get amended, not rewritten.

## The metric story

Organizations measure things. Revenue, expenses, conversion rates, uptime. Until now, these numbers lived in spreadsheets or dashboards — separate from the documents that give them context.

```
metric: Revenue | value: $4.2M | target: $4.0M | status: above | trend: up
metric: Customer Churn | value: 2.8% | target: 3.0% | status: below | trend: stable
metric: NPS Score | value: 72 | target: 65 | status: above | trend: up
```

Now you can query metrics across all your reports:

```bash
intenttext query ./reports --type metric --format table
```

| Metric         | Value | Target | Status |
| -------------- | ----- | ------ | ------ |
| Revenue        | $4.2M | $4.0M  | above  |
| Customer Churn | 2.8%  | 3.0%   | below  |
| NPS Score      | 72    | 65     | above  |

Your quarterly reports become a queryable dashboard. No BI tool required.

## The contact story

Every organization has contacts scattered across documents — in contracts, proposals, invoices, HR files. Finding "everyone at Acme Corp" means opening dozens of files.

```
contact: Ahmed Al-Rashid | role: CEO | email: ahmed@acme.com | org: Acme Corp | phone: +1-555-0100
```

One query:

```bash
intenttext query ./company --type contact --format csv > contacts.csv
```

Your documents become a contact directory.

## The deadline story

Contracts have deadlines. Projects have milestones. Policies have renewal dates. These dates are critical — missed deadlines have consequences.

```
deadline: Phase 1 delivery | date: 2026-04-30 | consequence: Penalty clause applies
deadline: Contract renewal | date: 2026-12-31 | authority: COO
```

Query them:

```bash
intenttext query ./company --type deadline --sort date:asc --format table
```

Your document folder becomes a deadline tracker. Sort by date, filter by authority, export to CSV. No project management tool required for the basics.

## Four more keywords

- **`def:`** — Term definitions with meaning. Build glossaries, define jargon, create reference sections.
- **`figure:`** — Images with captions and numbering. `figure: Architecture diagram | src: arch.png | number: 1`
- **`signline:`** — Signature lines for print. `signline: | role: CEO | date: true | line: true`
- **`cite:`** — Formal citations with source, author, and date.

## The vision

We think AI agents will produce `.it` files alongside `.md` files. When an agent generates a contract, a report, or an invoice, the output should be structured — not just readable. IntentText gives agents a format where every block has a keyword, every property is named, and every document is queryable.

Eight new keywords. 718 tests passing. The format keeps growing because documents keep needing more.

[See the full v2.11 reference →](/docs/reference/keywords)
