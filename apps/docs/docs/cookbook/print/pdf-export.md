---
sidebar_position: 3
title: PDF Export
---

# PDF Export

## The problem

You need a `.it` document as a PDF — for email, print, archive, or legal filing.

## The solution

```bash
intenttext document.it --pdf --theme corporate
```

This renders the document to PDF using the print renderer with full layout support: page size, fonts, headers, footers, watermarks, and signature lines.

## Basic export

```bash
# Default theme
intenttext document.it --pdf

# With a specific theme
intenttext document.it --pdf --theme legal

# Template merge to PDF
intenttext template.it --data data.json --pdf --theme corporate
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
intenttext report.it --pdf --theme corporate
intenttext contract.it --pdf --theme legal
intenttext newsletter.it --pdf --theme editorial
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
header: Company Name | align: left | size: 8pt
footer: Page {page} of {pages} | align: center | size: 8pt
watermark: CONFIDENTIAL | opacity: 0.05
```

These keywords only affect print/PDF output. They're ignored in standard HTML rendering.

## Prerequisites

PDF generation requires Puppeteer:

```bash
npm install puppeteer
```

Puppeteer uses a headless Chromium instance to convert the print HTML to PDF. It's a dev dependency — not needed for parsing, rendering to HTML, or any other operation.

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
- [Watermarks](./watermarks) — marking drafts and confidential documents
- [Contract](../documents/contract) — complete contract with PDF-ready layout
