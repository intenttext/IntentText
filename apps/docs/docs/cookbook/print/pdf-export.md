---
sidebar_position: 3
title: PDF Export
---

# PDF Export

## The problem

You need a `.it` document as a PDF — for email, print, archive, or legal filing.

## The solution

```bash
dotit document.it --pdf --theme corporate
```

This renders the document to PDF using the print renderer with full layout support: page size, fonts, headers, footers, watermarks, and signature lines.

## Basic export

```bash
# Default theme
dotit document.it --pdf

# With a specific theme
dotit document.it --pdf --theme legal

# Template merge to PDF
dotit template.it --data data.json --pdf --theme corporate
```

## Theme selection

Choose a theme that matches the document type:

| Theme       | Best for                               |
| ----------- | -------------------------------------- |
| `corporate` | Business documents, reports, proposals |
| `legal`     | Contracts, agreements, compliance docs |
| `minimal`   | Clean, simple documents                |
| `print`     | Maximum readability on paper           |
| `editorial` | Newsletters, articles                  |
| `warm`      | Friendly communications, HR docs       |
| `technical` | Specs, runbooks, architecture docs     |
| `dark`      | Screen reading (not great for print)   |

```bash
dotit report.it --pdf --theme corporate
dotit contract.it --pdf --theme legal
dotit newsletter.it --pdf --theme editorial
```

## PDF metadata

The PDF inherits metadata from the `.it` file:

| `.it` block                 | PDF metadata |
| --------------------------- | ------------ |
| `title:`                    | PDF Title    |
| `summary:`                  | PDF Subject  |
| `meta: \| author: name`     | PDF Author   |
| `meta: \| domain: category` | PDF Keywords |

## Print layout in the source

Control the PDF layout from inside the `.it` file:

```intenttext
page: | size: A4 | margins: 2.54cm
font: | body: Inter | heading: Inter | size: 11pt
header: Company Name
footer: Page {{page}} of {{pages}}
watermark: CONFIDENTIAL | color: rgba(0,0,0,0.05)
```

These keywords only affect print/PDF output. They're ignored in standard HTML rendering.

## Prerequisites

PDF generation requires Puppeteer:

```bash
npm install puppeteer
```

Puppeteer uses a headless Chromium instance to convert the print HTML to PDF. It's an optional dependency — not needed for parsing, rendering to HTML, or any other operation.

## Server-side PDFs: `@dotit/pdf`

For programmatic PDF generation (emailing invoices, compliance archiving, batch runs), use the dedicated package — core stays zero-dependency:

```bash
npm install @dotit/pdf
```

```javascript
import { issuePDF } from "@dotit/pdf";

// merge → seal (tamper-evident SHA-256) → real PDF bytes, in one call
const { source, hash, at, pdf } = await issuePDF(templateSource, data, {
  signer: "Billing System",
  role: "Issuer",
  theme: "corporate",
});
// store the sealed .it `source` on the record; email/archive the `pdf` bytes
```

`issueDocument()` does the same flow minus Chrome (returns print-ready HTML), and `renderPDF()` / `createPdfRenderer()` are the lower-level primitives (the latter reuses one Chrome instance for batch runs).

## Batch export

Export multiple documents:

```bash
# Export all contracts
for f in contracts/*.it; do
  intenttext "$f" --pdf --theme legal
done

# Export all with a template
for f in invoices/*.it; do
  intenttext "$f" --data clients.json --pdf --theme corporate
done
```

## Next steps

- [Print-Ready Documents](./print-ready-documents) — full print layout configuration
- [Watermark reference](../../reference/keywords/layout#watermark) — marking drafts and confidential documents
- [Contract](../documents/contract) — complete contract with PDF-ready layout
