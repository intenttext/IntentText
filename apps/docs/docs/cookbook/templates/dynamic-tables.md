---
sidebar_position: 2
title: Dynamic Tables
---

# Dynamic Tables

## The problem

Your template has a table where the number of rows depends on the data — line items, attendees, deliverables. You can't hardcode the rows.

## The solution

Add `each: arrayName` as the last column header. The merge engine expands the template row once per array element.

```intenttext
| Description | Qty | Price | each: items |
| {{item.description}} | {{item.qty}} | {{item.price}} |
```

With this data:

```json
{
  "items": [
    { "description": "Cloud setup", "qty": "1", "price": "$15,000" },
    { "description": "Data migration", "qty": "1", "price": "$8,000" },
    { "description": "Training", "qty": "4", "price": "$2,000" }
  ]
}
```

Output:

```
| Description | Qty | Price |
| Cloud setup | 1 | $15,000 |
| Data migration | 1 | $8,000 |
| Training | 4 | $2,000 |
```

The `each: items` column is stripped from the output — it's a directive, not a data column.

## Auto-singularization

The loop variable is automatically singularized from the array name:

| Array name     | Loop variable | Usage                  |
| -------------- | ------------- | ---------------------- |
| `items`        | `item`        | `{{item.description}}` |
| `entries`      | `entry`       | `{{entry.title}}`      |
| `categories`   | `category`    | `{{category.name}}`    |
| `deliverables` | `deliverable` | `{{deliverable.due}}`  |
| `addresses`    | `address`     | `{{address.city}}`     |
| `statuses`     | `status`      | `{{status.label}}`     |

## Explicit naming with `as`

When auto-singularization doesn't produce the right name, use `as`:

```intenttext
| Name | Amount | each: line_items as line |
| {{line.name}} | {{line.amount}} |
```

```intenttext
| Task | Owner | each: data as row |
| {{row.task}} | {{row.owner}} |
```

## Empty arrays

If the array is empty or missing, zero data rows are rendered. The header always appears:

```json
{ "items": [] }
```

Output:

```
| Description | Qty | Price |
```

This is intentional — an empty table with a header is more useful than no table at all.

## Nested data in tables

Access nested properties with dot notation:

```intenttext
| Person | Company | Email | each: contacts |
| {{contact.name}} | {{contact.company.name}} | {{contact.company.email}} |
```

```json
{
  "contacts": [
    {
      "name": "Sarah Chen",
      "company": { "name": "Acme Corp", "email": "info@acme.co" }
    }
  ]
}
```

## Multiple dynamic tables

A template can have multiple `each:` tables, each referencing a different array:

```intenttext
section: Team
| Name | Role | each: team_members |
| {{team_member.name}} | {{team_member.role}} |

section: Deliverables
| Description | Due | Status | each: deliverables |
| {{deliverable.description}} | {{deliverable.due}} | {{deliverable.status}} |

section: Expenses
| Item | Amount | Category | each: expenses |
| {{expense.item}} | {{expense.amount}} | {{expense.category}} |
```

## Next steps

- [Merging Data](./merge-data) — full merge workflow, CLI and API
- [Building Templates](./building-templates) — converting documents to templates
- [Invoice](../documents/invoice) — complete invoice with dynamic line items
