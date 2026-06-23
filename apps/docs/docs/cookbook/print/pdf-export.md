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

## Accessible (tagged) PDFs

`@dotit/pdf` emits **tagged PDFs** by default — Chrome renders the semantic HTML
(`renderPrint` produces real headings, lists, tables, and `alt` text) into a PDF
**structure tree**, so the output carries `/MarkInfo /Marked true` and a `/StructTreeRoot`.
That's what a screen reader, a "reflow" view, or an accessibility checker needs to read a
PDF as a document rather than a flat image of text.

Tagging is automatic — there's no flag to set:

```javascript
import { renderPDF } from "@dotit/pdf";

const pdf = await renderPDF(source, { theme: "corporate" });
// the PDF is tagged: /Marked true + /StructTreeRoot are present
```

Because the tags come from the rendered HTML, **good `.it` authoring is good
accessibility**:

- Use `section:` / `sub:` for real headings (they become the document's heading
  structure), not bold text.
- Give every `image:` and `x-writer: figure` meaningful **alt text** — the content before
  the first `|` is the alt text:
  ```intenttext
  image: Q3 revenue by region, bar chart — EU leads at 41% | src: ./charts/q3.png
  ```
- Use `headers:` / `row:` for tabular data so it tags as a real table with header cells,
  not as positioned text.

For archival on top of accessibility, pair tagged output with **PDF/A** (`toPdfA` /
`renderPDF(..., { pdfA })`), which adds the XMP metadata, sRGB OutputIntent, and document
ID auditors expect — validated in CI with veraPDF. See
[Forms, Review & Compliance](../../guide/forms-and-workflows#legal-signatures--archival-pdf).

## Batch export

Export multiple documents:

```bash
# Export all contracts
for f in contracts/*.it; do
  dotit "$f" --pdf --theme legal
done

# Export all with a template
for f in invoices/*.it; do
  dotit "$f" --data clients.json --pdf --theme corporate
done
```

## Next steps

- [Print-Ready Documents](./print-ready-documents) — full print layout configuration
- [Watermark reference](../../reference/keywords/layout#watermark) — marking drafts and confidential documents
- [Contract](../documents/contract) — complete contract with PDF-ready layout
