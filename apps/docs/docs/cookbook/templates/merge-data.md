---
sidebar_position: 3
title: Merging Data
---

# Merging Data

## The problem

You have a template and a JSON data file (or a JavaScript object). You need to merge them into a finished document and render the result.

## The solution

### CLI merge

```bash
# Merge and output JSON AST
intenttext template.it --data data.json

# Merge and render HTML
intenttext template.it --data data.json --html

# Merge, render with theme
intenttext template.it --data data.json --html --theme corporate

# Merge to print HTML
intenttext template.it --data data.json --print --theme legal

# Merge to PDF
intenttext template.it --data data.json --pdf --theme corporate
```

### JavaScript merge

```javascript
import { parseIntentText, mergeData, render, renderPrint } from "intenttext";

// Two-step merge
const doc = parseIntentText(templateSource);
const merged = mergeData(doc, data);

// Or one-step
import { parseAndMerge } from "intenttext";
const merged = parseAndMerge(templateSource, data);

// Render
const html = render(merged);
const printHtml = renderPrint(merged, { theme: "corporate" });
```

## How merge works

1. `each:` table rows are expanded first (one row per array element)
2. All `{{variable}}` occurrences are resolved — in content, properties, table cells, and inline nodes
3. `title:` and `summary:` metadata are also resolved
4. Missing variables leave `{{variable}}` visible and add `unresolved: 1` to the block

`mergeData` is a pure function — it never mutates the input document.

## Nested data

Use dot notation for nested objects:

```json
{
  "company": {
    "name": "Acme Corp",
    "address": {
      "city": "San Francisco",
      "state": "CA"
    }
  }
}
```

```intenttext
text: {{company.name}} is headquartered in {{company.address.city}}, {{company.address.state}}.
```

## Array index access

Access specific array elements by index:

```json
{
  "contacts": [
    { "name": "Sarah Chen", "role": "CEO" },
    { "name": "James Miller", "role": "CFO" }
  ]
}
```

```intenttext
contact: {{contacts.0.name}} | role: {{contacts.0.role}}
contact: {{contacts.1.name}} | role: {{contacts.1.role}}
```

## System variables

These variables are auto-populated without data:

| Variable        | Value                                 |
| --------------- | ------------------------------------- |
| `{{date}}`      | Current date (ISO format)             |
| `{{year}}`      | Current year                          |
| `{{timestamp}}` | Current ISO timestamp                 |
| `{{agent}}`     | From `doc.metadata.agent`             |
| `{{page}}`      | Page number (left for print renderer) |
| `{{pages}}`     | Total pages (left for print renderer) |

## Variables in properties

Variables work everywhere — not just in content:

```intenttext
contact: {{client_name}} | role: {{client_role}} | email: {{client_email}}
deadline: {{milestone_name}} | due: {{milestone_date}} | status: {{milestone_status}}
metric: {{kpi_name}} | value: {{kpi_value}} | target: {{kpi_target}} | unit: {{kpi_unit}}
```

## Handling missing data

When a variable has no matching value, the block gets `unresolved: 1`:

```javascript
const merged = mergeData(doc, { name: "Acme" });

// Blocks with missing variables have:
// { unresolved: 1, content: "Contact {{missing_email}} for details" }
```

Find unresolved blocks:

```bash
intenttext template.it --data partial.json --query "unresolved=1"
```

This is intentional design. A template with partial data should still produce a useful document — not crash.

## Security

The merge engine enforces limits:

- **Path depth**: maximum 20 levels of nesting
- **Path length**: maximum 200 characters
- **Blocked keys**: `__proto__`, `constructor`, `prototype`

These limits prevent prototype pollution and excessive resource consumption.

## Next steps

- [Dynamic Tables](./dynamic-tables) — the `each:` property in detail
- [Building Templates](./building-templates) — converting documents to templates
- [Template Library](./template-library) — browse pre-built templates on the Hub
