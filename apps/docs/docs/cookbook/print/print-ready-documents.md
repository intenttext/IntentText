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
header: CONFIDENTIAL — Service Agreement
footer: Page {{page}} of {{pages}}

// Watermark (remove for final version)
watermark: DRAFT | color: rgba(0,0,0,0.06)

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

deadline: Contract effective | date: 2026-04-01
deadline: Contract renewal | date: 2027-03-31

// Page break before signatures
break:

section: Signatures

approve: Legal review | by: Sarah Chen | role: General Counsel | at: 2026-03-20
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-22 | hash: sha256:a1b2c3d4 | spec: 4

signline: Ahmed Al-Rashid | role: CEO, Acme Corp | label: Provider Signature
signline: | label: Date | width: 30%

signline: Maria Santos | role: COO, GlobalTech | label: Client Signature
signline: | label: Date | width: 30%

freeze: | at: 2026-03-22T15:00:00Z | hash: sha256:e5f6a7b8 | spec: 4 | status: locked
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
header: Company Name — Document Title
footer: Page {{page}} of {{pages}}
```

`{{page}}` and `{{pages}}` compile to live CSS page counters in print output — the editor and `renderPrint` share the same engine. For three-zone layouts, use zone properties instead of content: `footer: | left: INV-1 | center: Page {{page}} of {{pages}} | right: Confidential`.

### Page breaks

```intenttext
break:
```

Forces a page break at that point. Use before signature sections to keep them on a clean page.

### Signature lines

```intenttext
signline: Name | role: Title | label: Signature | width: 60%
```

Creates a horizontal line on the printed page for wet-ink signatures. Combine `signline:` (physical) with `sign:` (digital) for contracts that need both.

## Render

```bash
# Print HTML (open in browser, Ctrl+P)
dotit contract.it --print --theme corporate

# Direct PDF
dotit contract.it --pdf --theme corporate
```

## Next steps

- [Watermark reference](../../reference/keywords/layout#watermark) — DRAFT, CONFIDENTIAL, VOID overlays
- [PDF Export](./pdf-export) — PDF export with themes
- [Contract](../documents/contract) — complete contract example
