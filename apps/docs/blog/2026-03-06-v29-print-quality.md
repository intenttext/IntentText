---
slug: v29-print-quality
title: "v2.9: Print-Quality Layout — Documents Worth Printing"
authors: [intenttext]
tags: [release, print]
---

v2.9 adds print-quality layout keywords: `page`, `font`, `header`, `footer`, `watermark`, and `break`. Your `.it` files now produce documents that look like they came from a design agency.

<!-- truncate -->

## The print problem

Every organization eventually needs to print something. A contract for signing. An invoice for records. A report for the board. Until v2.9, IntentText rendered clean HTML but had no concept of page layout.

Word processors solve this with WYSIWYG editors. LaTeX solves it with a typesetting language. Both are overkill for structured documents. You shouldn't need a page layout tool to put a logo in the header.

## Six new keywords

### `page:`

Set paper size and margins:

```
page: | size: A4 | margin: 1in
```

### `font:`

Control typography:

```
font: | body: Georgia | heading: Helvetica | size: 11pt
```

### `header:`

Three-zone page header (left, center, right):

```
header: | left: Acme Corp | center: CONFIDENTIAL | right: {{date}}
```

### `footer:`

Three-zone page footer:

```
footer: | left: Page {{page}} of {{pages}} | right: Ref: CONTRACT-042
```

### `watermark:`

Diagonal text overlay:

```
watermark: DRAFT | opacity: 0.08
```

### `break:`

Force a page break:

```
break: page
```

## The three-zone layout

Headers and footers use a three-zone model: left, center, right. This covers 95% of real document headers without requiring a layout engine:

```
header: | left: Company Name | center: Document Title | right: Page {{page}}
footer: | left: Confidential | right: Printed: {{date}}
```

The renderer maps these to CSS `@page` rules with running headers and footers. The result works in `print-to-PDF` workflows and dedicated PDF exporters.

## Real examples

A legal contract with full layout:

```
title: Master Service Agreement
page: | size: letter | margin: 1.25in 1in
font: | body: Times New Roman | heading: Arial | size: 11pt
header: | left: Acme Corp | right: MSA-2026-042
footer: | left: Confidential | center: Page {{page}} of {{pages}} | right: v1.0
watermark: DRAFT

section: Terms
text: ...
```

Render with `intenttext contract.it --print --theme legal` and you get a document that looks like it came from outside counsel.

[See the print cookbook →](/docs/cookbook/print/print-ready-documents)
