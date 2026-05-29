---
sidebar_position: 6
title: Deadline Tracking
---

# Deadline Tracking

## The problem

Contract deadlines are scattered across hundreds of documents. Renewal dates, payment due dates, delivery milestones — nobody knows what's coming up next week without manually searching every file.

## The solution

Use `deadline:` in every document. Query them to see every upcoming deadline across the organization.

### Deadlines in documents

Contracts have renewal dates:

```intenttext
deadline: Contract renewal | due: 2027-03-31 | status: pending
deadline: Payment due | due: 2026-04-15 | status: pending
```

Projects have milestones:

```intenttext
deadline: Phase 1 complete | due: 2026-06-01 | status: in-progress
deadline: Beta launch | due: 2026-07-15 | status: pending
```

HR has review cycles:

```intenttext
deadline: Q2 performance reviews | due: 2026-06-30 | status: pending
deadline: Annual compensation review | due: 2026-12-01 | status: pending
```

### Query upcoming deadlines

```bash
# All deadlines across the company
intenttext query ./company --type deadline --format table
```

```
File                              Type      Content                   Due          Status
contracts/acme.it                 deadline  Payment due               2026-04-15   pending
contracts/globaltech.it           deadline  Contract renewal          2027-03-31   pending
projects/cloud-migration.it      deadline  Phase 1 complete          2026-06-01   in-progress
hr/reviews/q2.it                  deadline  Q2 performance reviews    2026-06-30   pending
```

### Natural language

```bash
intenttext ask ./company "What deadlines are coming up in April?" --format text
```

> Two deadlines in April 2026:
>
> 1. Payment due for the Acme contract (April 15, pending)
> 2. Q1 report submission (April 7, pending)

### Filter by status

```bash
# Only pending deadlines
intenttext query ./company --type deadline --status pending --format table

# Overdue deadlines
intenttext ask ./company "What deadlines are overdue?" --format text
```

### Export for calendar integration

```bash
intenttext query ./company --type deadline --format csv > deadlines.csv
```

Import into Google Calendar, Outlook, or any project management tool.

## Proximity color coding

When `deadline:` blocks are rendered, they're color-coded by proximity:

| Time remaining | Display                |
| -------------- | ---------------------- |
| > 30 days      | Green — plenty of time |
| 7–30 days      | Yellow — approaching   |
| < 7 days       | Orange — imminent      |
| Overdue        | Red — past due         |

This applies to both HTML and print rendering.

```bash
# Render a document with color-coded deadlines
intenttext project.it --html --theme corporate
```

## The pattern

Same as the [Contact Directory](./contact-directory) — you're not building a deadline tracker as a separate project. You're querying deadlines that already exist in your documents.

Every `deadline:` in every contract, project plan, and review cycle is automatically tracked. Add the keyword to documents you already write. The tracker builds itself.

## Next steps

- [Contact Directory](./contact-directory) — the same pattern for contacts
- [Querying Documents](./querying-documents) — query syntax reference
- [Invoice](../documents/invoice) — invoice with payment deadlines
