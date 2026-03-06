# IntentText Template System

A complete guide to document generation with IntentText: templates, data, rendering, and the merge engine.

---

## How Document Generation Works

IntentText separates **structure** from **data**.

A template is an `.it` file with `{{placeholder}}` syntax wherever real data will go. A data file is plain JSON. The merge engine combines them into a complete document, which the renderer turns into HTML, print-ready HTML, or PDF.

```
template.it  +  data.json  →  mergeData()  →  IntentDocument  →  renderPrint()  →  PDF
```

One template. Any number of data files. Any number of rendered documents.

---

## Template Syntax

Placeholders follow double-brace syntax and work inside any block — content, properties, or table cells.

```
title: Invoice {{invoice.number}}
summary: Issued by {{company.name}} to {{client.name}} on {{invoice.date}}

note: **{{client.name}}**
note: {{client.address}}, {{client.city}}, {{client.country}}

| Description             | Qty             | Unit Price             | Total             |
| {{items.0.description}} | {{items.0.qty}} | {{items.0.unit_price}} | {{items.0.total}} |

note: **Total Due: {{totals.due}} {{invoice.currency}}** | align: right
```

### Variable Resolution

| Syntax                    | Resolves to                   |
| ------------------------- | ----------------------------- |
| `{{name}}`                | `data.name`                   |
| `{{company.name}}`        | `data.company.name`           |
| `{{items.0.description}}` | `data.items[0].description`   |
| `{{date}}`                | Current date (system)         |
| `{{year}}`                | Current year (system)         |
| `{{page}}`                | Page number (print renderer)  |
| `{{pages}}`               | Total pages (print renderer)  |

- **Dot notation** resolves nested objects
- **Index notation** resolves array items (`items.0`, `items.1`, ...)
- **System variables** (`{{date}}`, `{{year}}`) are injected automatically
- **Print variables** (`{{page}}`, `{{pages}}`) are left for the renderer
- **Missing variables** mark the block with `unresolved: 1` — no crash, no silent failure

---

## Layout Blocks

Use `font:` and `page:` at the top of any template to control print output.

```
font: | family: Inter | size: 11pt | leading: 1.6 | mono: JetBrains Mono
page: | size: A4 | margins: 20mm | header: {{company.name}} | footer: Page {{page}} of {{pages}} | orientation: portrait
```

### `font:` Properties

| Property  | Description                        | Example            |
| --------- | ---------------------------------- | ------------------ |
| `family`  | Body font family                   | `Georgia`          |
| `size`    | Base font size                     | `12pt`             |
| `leading` | Line height multiplier             | `1.8`              |
| `heading` | Heading font (defaults to family)  | `Playfair Display` |
| `mono`    | Monospace font for code blocks     | `JetBrains Mono`   |

### `page:` Properties

| Property      | Description          | Example                     |
| ------------- | -------------------- | --------------------------- |
| `size`        | Paper size           | `A4`, `A5`, `Letter`        |
| `margins`     | All margins (uniform)| `20mm`                      |
| `header`      | Running header text  | `{{company.name}}`          |
| `footer`      | Running footer text  | `Page {{page}} of {{pages}}`|
| `orientation` | Page orientation     | `portrait`, `landscape`     |
| `numbering`   | Page number style    | `arabic`, `roman`           |

---

## The API

### `mergeData(document, data)`

Resolves all `{{placeholder}}` references in a parsed document using a data object.

```javascript
import { parseIntentText, mergeData } from "@intenttext/core";

const template = parseIntentText(fs.readFileSync("invoice.it", "utf-8"));
const data = JSON.parse(fs.readFileSync("invoice-data.json", "utf-8"));

const doc = mergeData(template, data);
```

### `parseAndMerge(source, data)`

Parse and merge in one step.

```javascript
import { parseAndMerge, renderPrint } from "@intenttext/core";

const doc = parseAndMerge(itSource, data);
const html = renderPrint(doc);
```

### `renderPrint(document)`

Produces a full `<!DOCTYPE html>` document with embedded CSS, optimised for printing and PDF export. Reads `font:` and `page:` blocks automatically.

```javascript
import { renderPrint } from "@intenttext/core";

const printHTML = renderPrint(doc);
// Ready for browser print, puppeteer PDF, or wkhtmltopdf
```

### CLI

```bash
# Merge template with data, render HTML
node cli.js template.it --data data.json --html

# Merge template with data, render print HTML
node cli.js template.it --data data.json --print

# Generate PDF (requires puppeteer)
node cli.js template.it --data data.json --pdf output.pdf
```

---

## Complete Template Examples

### Invoice

```
font: | family: Inter | size: 11pt | leading: 1.6
page: | size: A4 | margins: 20mm | header: {{company.name}} | footer: Page {{page}} of {{pages}}

title: Invoice {{invoice.number}}
summary: Issued by {{company.name}} to {{client.name}} — {{invoice.date}}

---

section: Issued By
note: **{{company.name}}**
note: {{company.address}}, {{company.city}}, {{company.country}}
note: {{company.email}} · {{company.phone}}

section: Billed To
note: **{{client.name}}**
note: {{client.address}}, {{client.city}}, {{client.country}}
note: {{client.email}}

section: Invoice Details
| Field        | Value                |
| Invoice No.  | {{invoice.number}}   |
| Issue Date   | {{invoice.date}}     |
| Due Date     | {{invoice.due_date}} |
| Currency     | {{invoice.currency}} |

section: Services
| Description              | Qty              | Unit Price             | Total             |
| {{items.0.description}}  | {{items.0.qty}}  | {{items.0.unit_price}} | {{items.0.total}} |
| {{items.1.description}}  | {{items.1.qty}}  | {{items.1.unit_price}} | {{items.1.total}} |

---

note: Subtotal: **{{totals.subtotal}} {{invoice.currency}}**               | align: right
note: Tax ({{totals.tax_rate}}%): **{{totals.tax}} {{invoice.currency}}**  | align: right
note: **Total Due: {{totals.due}} {{invoice.currency}}**                   | align: right

---

section: Payment
note: {{payment.instructions}}
note: Bank: **{{payment.bank}}** · IBAN: **{{payment.iban}}** · Ref: **{{invoice.number}}**

section: Notes
note: {{invoice.notes}}
tip: Payment due by {{invoice.due_date}}. Late payments subject to {{payment.late_fee}}% monthly fee.
```

**Data file** (`invoice-data.json`):

```json
{
  "company": {
    "name": "Acme Corp",
    "address": "123 Main St",
    "city": "Doha",
    "country": "Qatar",
    "email": "billing@acme.com",
    "phone": "+974 1234 5678"
  },
  "client": {
    "name": "Client Co.",
    "address": "456 Other St",
    "city": "Dubai",
    "country": "UAE",
    "email": "accounts@client.com"
  },
  "invoice": {
    "number": "INV-2026-042",
    "date": "2026-03-01",
    "due_date": "2026-03-31",
    "currency": "USD",
    "notes": "Thank you for your business."
  },
  "items": [
    { "description": "Consulting — March", "qty": "10", "unit_price": "500", "total": "5,000" },
    { "description": "Design work",        "qty": "5",  "unit_price": "300", "total": "1,500" }
  ],
  "totals": {
    "subtotal": "6,500",
    "tax_rate": "5",
    "tax": "325",
    "due": "6,825"
  },
  "payment": {
    "bank": "Qatar National Bank",
    "iban": "QA12QNBA000000001234567890",
    "instructions": "Transfer to the account below referencing your invoice number.",
    "late_fee": "2"
  }
}
```

---

### Meeting Report

```
font: | family: Georgia | size: 12pt | leading: 1.7
page: | size: A4 | margins: 25mm | footer: {{date}} — {{meeting.title}}

title: {{meeting.title}}
summary: {{meeting.date}} · {{meeting.location}} · {{meeting.attendees}}

---

section: Attendees
note: {{meeting.attendees}}

section: Agenda
{{agenda}}

section: Key Decisions
{{decisions}}

section: Action Items
{{tasks}}

section: Next Meeting
note: {{next_meeting.date}} — {{next_meeting.location}}
```

---

### Contract

```
font: | family: Georgia | size: 12pt | leading: 1.8
page: | size: A4 | margins: 30mm | footer: {{contract.reference}} — Page {{page}} of {{pages}}

title: {{contract.title}}
summary: Between {{party_a.name}} and {{party_b.name}} — Effective {{contract.effective_date}}

---

section: Parties
note: **Party A:** {{party_a.name}}, {{party_a.address}}, {{party_a.registration}}
note: **Party B:** {{party_b.name}}, {{party_b.address}}, {{party_b.registration}}

section: Scope of Work
note: {{scope.description}}

section: Term
note: This agreement is effective from {{contract.effective_date}} until {{contract.end_date}}.

section: Payment Terms
note: {{payment.terms}}
note: Amount: **{{payment.amount}} {{payment.currency}}**
note: Schedule: {{payment.schedule}}

section: Signatures
note: **{{party_a.name}}** · Date: _______________
note: **{{party_b.name}}** · Date: _______________
```

---

### Weekly Report

```
font: | family: Inter | size: 11pt | leading: 1.6
page: | size: A4 | margins: 22mm | header: {{team.name}} Weekly Report | footer: Week of {{week.start}}

title: Weekly Report — Week of {{week.start}}
summary: {{team.name}} · {{week.start}} to {{week.end}}

---

section: Highlights
note: {{highlights}}

section: Completed This Week
{{completed_tasks}}

section: In Progress
{{in_progress_tasks}}

section: Blocked
{{blocked_tasks}}

section: Next Week
{{next_week_tasks}}

section: Metrics
| Metric           | This Week        | Last Week        |
| Tasks completed  | {{metrics.done}} | {{metrics.prev_done}} |
| Blockers         | {{metrics.blocked}} | {{metrics.prev_blocked}} |

note: {{week.notes}}
```

---

## Hub Templates

The [IntentText Hub](https://intenttext-hub.vercel.app/) hosts ready-to-use templates you can browse, copy, and adapt. Categories include:

- **Agents** — customer support, onboarding, content moderation
- **Workflows** — deployment pipelines, invoice approval, lead qualification
- **Documents** — meeting notes, technical specs, weekly reports

---

## Tips

**Keep templates clean.** Only put structure and placeholders in the template. All real values belong in the data file. A template with hardcoded content defeats the purpose.

**Use sections.** Sections in a template map to sections in the rendered document. They make the template readable without the data.

**Test with missing data.** Run the merge with an incomplete data file deliberately. Blocks with unresolved variables get flagged — this is how you find every placeholder before going to production.

**Version your data files.** A template is reusable forever. Data files are snapshots — name them with dates or reference numbers (`invoice-INV-2026-042.json`) and keep them.

**Store templates as JSON.** Once parsed, a template is a plain JSON document. Store it in your database alongside your data. Generate any document on demand with no binary files, no Word, no Google Docs.
