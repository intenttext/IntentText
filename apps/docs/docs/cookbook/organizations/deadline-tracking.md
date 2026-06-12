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
deadline: Contract renewal | date: 2027-03-31 | status: pending
deadline: Payment due | date: 2026-04-15 | status: pending
```

Projects have milestones:

```intenttext
deadline: Phase 1 complete | date: 2026-06-01 | status: in-progress
deadline: Beta launch | date: 2026-07-15 | status: pending
```

HR has review cycles:

```intenttext
deadline: Q2 performance reviews | date: 2026-06-30 | status: pending
deadline: Annual compensation review | date: 2026-12-01 | status: pending
```

Arabic documents use the `مهلة` alias — same canonical `deadline` semantics, same queries, and the keyword round-trips exactly as written. Dates are always ISO `YYYY-MM-DD`:

```intenttext
مهلة: تجديد الرخصة التجارية | date: 2026-09-30 | status: pending
مهلة: سداد دفعة المورد | date: 2026-07-15 | status: pending
مهلة: انتهاء عقد الإيجار | date: 2027-01-31 | status: pending
```

### Query upcoming deadlines

```bash
# All deadlines across the company
dotit query ./company --type deadline --format table
```

```
File                              Type      Content                   Date         Status
contracts/acme.it                 deadline  Payment due               2026-04-15   pending
contracts/globaltech.it           deadline  Contract renewal          2027-03-31   pending
contracts/gulf-tech.it            deadline  تجديد الرخصة التجارية      2026-09-30   pending
projects/cloud-migration.it      deadline  Phase 1 complete          2026-06-01   in-progress
hr/reviews/q2.it                  deadline  Q2 performance reviews    2026-06-30   pending
```

One query spans every language — `مهلة` blocks index as `deadline`, so Arabic and English deadlines land in the same table. ISO dates are what make the date comparisons and sorting work.

### Natural language

```bash
dotit ask ./company "What deadlines are coming up in April?" --format text
```

> Two deadlines in April 2026:
>
> 1. Payment due for the Acme contract (April 15, pending)
> 2. Q1 report submission (April 7, pending)

### Filter by status

```bash
# Only pending deadlines
dotit query ./company --type deadline --status pending --format table

# Overdue deadlines
dotit ask ./company "What deadlines are overdue?" --format text
```

### Export for calendar integration

```bash
dotit query ./company --type deadline --format csv > deadlines.csv
```

Import into Google Calendar, Outlook, or any project management tool.

## Proximity color coding

When `deadline:` blocks are rendered, they're color-coded by proximity:

| Time remaining            | Display                |
| ------------------------- | ---------------------- |
| > 30 days                 | Green — plenty of time |
| 7–30 days                 | Amber — approaching    |
| < 7 days (incl. overdue)  | Red — imminent or past |

This applies to both HTML and print rendering.

```bash
# Render a document with color-coded deadlines
dotit project.it --html --theme corporate
```

## The pattern

Same as the [Contact Directory](./contact-directory) — you're not building a deadline tracker as a separate project. You're querying deadlines that already exist in your documents.

Every `deadline:` in every contract, project plan, and review cycle is automatically tracked. Add the keyword to documents you already write. The tracker builds itself.

## Next steps

- [Contact Directory](./contact-directory) — the same pattern for contacts
- [Query reference](../../reference/query) — query syntax
- [Your First Document](../../guide/first-document) — invoice with payment deadlines
