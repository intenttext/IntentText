---
sidebar_position: 1
title: Print-Ready Documents
---

# Print-Ready Documents

## The problem

You need a `.it` document that produces a professional printed page — with headers, footers, page numbers, signature lines, and proper margins.

## The solution

Use the six layout keywords: `page:`, `font:`, `header:`, `footer:`, `watermark:`, `signline:`.

```intenttext
title: Service Agreement
summary: Annual IT support contract between Acme Corp and GlobalTech Industries
meta: | type: contract | domain: legal

// Page setup
page: | size: A4 | margins: 2.54cm
font: | body: Inter | heading: Inter | mono: JetBrains Mono | size: 11pt

// Running header and footer
header: CONFIDENTIAL — Service Agreement | align: left | size: 8pt
footer: Page {page} of {pages} | align: center | size: 8pt

// Watermark (remove for final version)
watermark: DRAFT | color: #cccccc | opacity: 0.06

section: Parties

contact: Acme Corp | role: Provider | email: legal@acme.co
contact: GlobalTech Industries | role: Client | email: contracts@globaltech.co

section: Terms

text: Provider shall deliver monthly IT support services for the duration of the Term.
text: Payment within 30 days of each monthly invoice.

section: Financial Summary

metric: Monthly retainer | value: 15000 | unit: USD
metric: Annual value | value: 180000 | unit: USD | weight: bold

section: Timeline

deadline: Contract effective | due: 2026-04-01
deadline: Contract renewal | due: 2027-03-31

// Page break before signatures
break: | before: page

section: Signatures

approve: Legal review | by: Sarah Chen | role: General Counsel | at: 2026-03-20
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-22 | hash: sha256:a1b2c3d4

signline: Ahmed Al-Rashid | role: CEO, Acme Corp | label: Provider Signature
signline: | label: Date | width: 30%

break: | before: 2cm

signline: Maria Santos | role: COO, GlobalTech | label: Client Signature
signline: | label: Date | width: 30%

freeze: | status: locked | at: 2026-03-22T15:00:00Z | hash: sha256:e5f6a7b8
```

## Step by step

### Page setup

```intenttext
page: | size: A4 | margins: 2.54cm
```

| Size     | Dimensions    |
| -------- | ------------- |
| `A4`     | 210mm × 297mm |
| `Letter` | 8.5in × 11in  |
| `Legal`  | 8.5in × 14in  |
| `A3`     | 297mm × 420mm |
| `A5`     | 148mm × 210mm |

Margins accept 1 value (all sides), 2 values (vertical horizontal), or 4 values (top right bottom left):

```intenttext
page: | size: A4 | margins: 20mm 25mm 30mm 25mm
```

### Fonts

```intenttext
font: | body: Inter | heading: Inter | size: 11pt
```

Print rendering uses system fonts. Specify fonts available on the target machine.

### Headers and footers

```intenttext
header: Company Name — Document Title | align: left | size: 8pt
footer: Page {page} of {pages} | align: center | size: 8pt
```

`{page}` and `{pages}` are auto-replaced with the current page number and total pages.

### Page breaks

```intenttext
break: | before: page
```

Forces a page break before the next block. Use before signature sections to keep them on a clean page.

### Signature lines

```intenttext
signline: Name | role: Title | label: Signature | width: 60%
```

Creates a horizontal line on the printed page for wet-ink signatures. Combine `signline:` (physical) with `sign:` (digital) for contracts that need both.

## Render

```bash
# Print HTML (open in browser, Ctrl+P)
intenttext contract.it --print --theme corporate

# Direct PDF
intenttext contract.it --pdf --theme corporate
```

## Next steps

- [Watermarks](./watermarks) — DRAFT, CONFIDENTIAL, VOID overlays
- [PDF Export](./pdf-export) — PDF export with themes
- [Contract](../documents/contract) — complete contract example
