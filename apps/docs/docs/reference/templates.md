---
sidebar_position: 12
title: Templates
---

# Template System

Any `.it` file with `{{placeholders}}` is a template. Feed it data, get a document.

```
template.it  +  data.json  →  merge  →  document  →  render  →  output
```

## Variable syntax

Variables use double curly braces: `{{variableName}}`.

| Syntax                    | Resolution                  | Example                         |
| ------------------------- | --------------------------- | ------------------------------- |
| `{{name}}`                | `data.name`                 | `"Acme Corp"`                   |
| `{{company.name}}`        | `data.company.name`         | Dot notation for nested objects |
| `{{items.0.description}}` | `data.items[0].description` | Array index access              |
| `{{date}}`                | System: current date        | Auto-generated                  |
| `{{year}}`                | System: current year        | Auto-generated                  |
| `{{timestamp}}`           | System: ISO timestamp       | Auto-generated                  |
| `{{agent}}`               | `doc.metadata.agent`        | From document metadata          |
| `{{page}}`                | Runtime — page number       | Left for print renderer         |
| `{{pages}}`               | Runtime — total pages       | Left for print renderer         |

### Missing variables

When a variable has no matching data, the block gets an `unresolved: 1` property. No crash, no silent removal — the `{{variable}}` text remains visible, and the block is flagged.

### Security

- Path depth capped at **20** levels
- `__proto__`, `constructor`, `prototype` keys are blocked
- Path length capped at **200** characters

## Writing a template

```intenttext
title: {{document_type}} for {{client_name}}
summary: {{description}}
meta: | type: template | domain: {{domain}}

section: Parties
contact: {{client_name}} | role: Client | email: {{client_email}}
contact: {{provider_name}} | role: Provider | email: {{provider_email}}

section: Terms
text: This {{document_type}} is effective as of {{effective_date}}.
text: {{terms}}

section: Deliverables
| Description | Due Date | Amount | each: deliverables |
| {{deliverable.description}} | {{deliverable.due}} | {{deliverable.amount}} |

section: Total
metric: Total Value | value: {{total}} | unit: {{currency}}
```

## `each:` dynamic table rows

Add `each: arrayName` as the last column header to repeat rows for each item in an array.

```intenttext
| Item | Qty | Price | each: items |
| {{item.description}} | {{item.qty}} | {{item.price}} |
```

### How `each:` works

1. The merge engine reads the array from `data.items`
2. The template row (first row after header) is expanded once per array element
3. The loop variable is **auto-singularized**: `items` → `item`, `entries` → `entry`, `categories` → `category`
4. The `each:` column is stripped from the output — it's a directive, not a column

### Explicit naming

If auto-singularization doesn't produce the right name:

```intenttext
| Description | Amount | each: line_items as line |
| {{line.description}} | {{line.amount}} |
```

### Zero items

If the array is empty, zero data rows are rendered. The table header always appears.

## Data format

Data is a JSON object:

```json
{
  "client_name": "GlobalTech Industries",
  "client_email": "contracts@globaltech.co",
  "provider_name": "Acme Corp",
  "provider_email": "legal@acme.co",
  "document_type": "Service Agreement",
  "description": "Annual IT support contract",
  "domain": "legal",
  "effective_date": "2026-04-01",
  "terms": "Payment within 30 days of invoice.",
  "deliverables": [
    {
      "description": "Cloud migration",
      "due": "2026-06-01",
      "amount": "$50,000"
    },
    {
      "description": "Security audit",
      "due": "2026-08-01",
      "amount": "$25,000"
    },
    { "description": "Training", "due": "2026-09-01", "amount": "$10,000" }
  ],
  "total": "85000",
  "currency": "USD"
}
```

## Merge API

### CLI

```bash
# Merge to JSON
intenttext template.it --data data.json

# Merge and render HTML
intenttext template.it --data data.json --html

# Merge and render with theme
intenttext template.it --data data.json --html --theme corporate

# Merge to print HTML
intenttext template.it --data data.json --print

# Merge to PDF (requires puppeteer)
intenttext template.it --data data.json --pdf
```

### JavaScript

```javascript
import { parseIntentText, mergeData, render, renderPrint } from "intenttext";

const doc = parseIntentText(templateSource);
const merged = mergeData(doc, data);

// Or one-step:
const merged = parseAndMerge(templateSource, data);

// Render
const html = render(merged);
const printHtml = renderPrint(merged, { theme: "corporate" });
```

### Notes

- `mergeData` is a pure function — it never mutates the input document
- Merge order: `each:` table rows are expanded first, then all `{{}}` are resolved
- Variables work in content, properties, table cells, and inline nodes
- Metadata `title:` and `summary:` are also resolved

## Hub templates

The [IntentText Hub](https://hub.intenttext.io) hosts **76 seeded templates** across 8 domains:

| Domain     | Templates                          | Examples                             |
| ---------- | ---------------------------------- | ------------------------------------ |
| Legal      | Contracts, NDAs, terms of service  | Service agreement, NDA               |
| Business   | Proposals, reports, plans          | Quarterly report, business plan      |
| HR         | Offer letters, reviews, policies   | Employment offer, performance review |
| Education  | Syllabi, lesson plans, assessments | Course syllabus, rubric              |
| Technical  | Architecture docs, RFCs, runbooks  | API specification, incident report   |
| Finance    | Invoices, budgets, forecasts       | Standard invoice, budget proposal    |
| Healthcare | Consent forms, care plans          | Patient consent, treatment plan      |
| Government | Permits, compliance docs           | Building permit, FOIA request        |

Browse, fork, and merge templates directly from the Hub.
