---
sidebar_position: 5
title: Your First Template
---

# Your First Template

Turn the invoice from the previous page into a reusable template that anyone can fill with data.

## What makes a template

A template is a `.it` file with two additions:

1. `meta: | type: template` — declares intent
2. `{{variables}}` — placeholders for data

## Convert the invoice

Replace concrete values with `{{placeholders}}`:

```intenttext
title: Invoice {{invoice.number}}
summary: {{invoice.description}} — {{client.name}}
meta: | type: template | domain: finance | currency: {{invoice.currency}}
track: | version: 1.0 | by: {{company.contact}}

section: Parties
contact: {{company.contact}} | role: {{company.role}} | email: {{company.email}} | org: {{company.name}}
contact: {{client.contact}} | role: {{client.role}} | email: {{client.email}} | org: {{client.name}}

section: Line Items
| Description | Hours | Rate | Total | each: items |
| {{item.description}} | {{item.hours}} | {{item.rate}} | {{item.total}} |

section: Summary
metric: Subtotal | value: {{totals.subtotal}} | unit: {{invoice.currency}}
metric: Tax ({{totals.tax_rate}}) | value: {{totals.tax}} | unit: {{invoice.currency}}
metric: Total Due | value: {{totals.due}} | unit: {{invoice.currency}}

deadline: Payment due | date: {{invoice.due_date}} | consequence: {{payment.late_fee}}
```

## Create the data file

Create `invoice-data.json`:

```json
{
  "company": {
    "name": "Acme Corp",
    "contact": "Ahmed Al-Rashid",
    "role": "CEO",
    "email": "ahmed@acme.com"
  },
  "client": {
    "name": "GlobalTech Inc.",
    "contact": "James Miller",
    "role": "CFO",
    "email": "j.miller@globaltech.co"
  },
  "invoice": {
    "number": "INV-2026-042",
    "description": "Consulting services Q2 2026",
    "currency": "USD",
    "due_date": "2026-04-30"
  },
  "items": [
    {
      "description": "Strategy consultation",
      "hours": "40",
      "rate": "USD 150",
      "total": "USD 6,000"
    },
    {
      "description": "Technical implementation",
      "hours": "80",
      "rate": "USD 150",
      "total": "USD 12,000"
    },
    {
      "description": "Project management",
      "hours": "40",
      "rate": "USD 150",
      "total": "USD 6,000"
    }
  ],
  "totals": {
    "subtotal": "24000",
    "tax_rate": "5%",
    "tax": "1200",
    "due": "25200"
  },
  "payment": {
    "late_fee": "Late fee of 1.5% per month"
  }
}
```

## Merge and render

```bash
# Preview the merged JSON
intenttext invoice-template.it --data invoice-data.json

# Render to HTML
intenttext invoice-template.it --data invoice-data.json --html

# Render with a theme
intenttext invoice-template.it --data invoice-data.json --html --theme corporate

# Export to PDF
intenttext invoice-template.it --data invoice-data.json --pdf invoice.pdf
```

## How `each:` works

The table has `each: items` on the header row. The parser:

1. Reads the `items` array from the data
2. Auto-singularizes to `item` (the loop variable)
3. Expands one row per array element
4. Zero items = zero rows (header always present)

For explicit naming: `each: orders as order`.

## How variables resolve

| Syntax           | Example                   | Resolves from     |
| ---------------- | ------------------------- | ----------------- |
| `{{name}}`       | `{{company.name}}`        | Dot notation      |
| `{{arr.0.prop}}` | `{{items.0.description}}` | Array index       |
| `{{date}}`       | System variable           | Current date      |
| `{{year}}`       | System variable           | Current year      |
| `{{page}}`       | Print variable            | Left for renderer |

Missing variables don't crash — the block gets marked `unresolved: 1` so you can catch it.

## Merge in code

```typescript
import { parseAndMerge, renderHTML } from "@intenttext/core";
import data from "./invoice-data.json";
import { readFileSync } from "fs";

const template = readFileSync("invoice-template.it", "utf-8");
const doc = parseAndMerge(template, data);
const html = renderHTML(doc);
```

## Publish to the Hub

Once your template is polished, share it:

```bash
intenttext template publish invoice-template.it
intenttext template submit username/invoice-standard --for-review
```

Community templates are available instantly. Curated templates are reviewed for quality and appear in the official collection.

---

**Next:** See what IntentText offers for your specific role:

- [For Organizations →](./for-organizations)
- [For Agents →](./for-agents)
- [For Writers →](./for-writers)
