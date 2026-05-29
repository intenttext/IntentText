---
sidebar_position: 1
title: Building Templates
---

# Building Templates

## The problem

You have a document that works well — an invoice, a contract, a report — and you want to reuse it with different data each time.

## The solution

Take any `.it` file, replace the specific values with `{{variables}}`, and it becomes a template.

### Before: a document

```intenttext
title: Invoice #2026-0042
summary: Cloud migration services for GlobalTech Industries

section: Parties
contact: Acme Corp | role: Provider | email: billing@acme.co
contact: GlobalTech Industries | role: Client | email: accounts@globaltech.co

section: Line Items
| Description | Qty | Price | Total |
| Cloud setup | 1 | $15,000 | $15,000 |
| Data migration | 1 | $8,000 | $8,000 |

section: Payment
metric: Total Due | value: 23000 | unit: USD
deadline: Payment due | due: 2026-04-15
```

### After: a template

```intenttext
title: Invoice #{{invoice_number}}
summary: {{description}} for {{client_name}}
meta: | type: template | domain: finance

section: Parties
contact: {{provider_name}} | role: Provider | email: {{provider_email}}
contact: {{client_name}} | role: Client | email: {{client_email}}

section: Line Items
| Description | Qty | Price | Total | each: items |
| {{item.description}} | {{item.qty}} | {{item.price}} | {{item.total}} |

section: Payment
metric: Total Due | value: {{total}} | unit: {{currency}}
deadline: Payment due | due: {{payment_due}}
```

### The data

```json
{
  "invoice_number": "2026-0043",
  "description": "Security audit services",
  "client_name": "NextGen Corp",
  "client_email": "ap@nextgen.co",
  "provider_name": "Acme Corp",
  "provider_email": "billing@acme.co",
  "items": [
    {
      "description": "Penetration testing",
      "qty": "1",
      "price": "$12,000",
      "total": "$12,000"
    },
    {
      "description": "Vulnerability report",
      "qty": "1",
      "price": "$3,000",
      "total": "$3,000"
    }
  ],
  "total": "15000",
  "currency": "USD",
  "payment_due": "2026-05-01"
}
```

## Step by step

1. **Start with a working document** — make sure it renders correctly before converting
2. **Identify the variable parts** — client names, dates, amounts, line items
3. **Replace with `{{variables}}`** — use descriptive names: `{{client_name}}` not `{{cn}}`
4. **Add `each:` to tables** — for repeating rows, add `each: arrayName` as the last column header
5. **Add `meta: | type: template`** — marks it as a template in queries
6. **Test with data** — merge and check the output

## Merge

### CLI

```bash
# Parse merged document (JSON output)
intenttext template.it --data data.json

# Render to HTML
intenttext template.it --data data.json --html --theme corporate

# Render to PDF
intenttext template.it --data data.json --pdf --theme corporate
```

### JavaScript

```javascript
import { parseAndMerge, render } from "intenttext";

const doc = parseAndMerge(templateSource, data);
const html = render(doc, { theme: "corporate" });
```

## What happens to missing variables

If a variable has no matching data, the `{{variable}}` text stays visible in the output and the block gets an `unresolved: 1` property. No crash, no silent removal.

```bash
# Find blocks with missing data
intenttext template.it --data partial-data.json --query "unresolved=1"
```

## Publish to the Hub

```bash
# Upload to the IntentText Hub
intenttext hub publish invoice-template.it --domain finance
```

The template becomes available for anyone to browse, fork, and use.

## Next steps

- [Dynamic Tables](./dynamic-tables) — deep dive on `each:` and singularization
- [Merging Data](./merge-data) — nested data, API merge, error handling
- [Template Library](./template-library) — browse the 76 Hub templates
