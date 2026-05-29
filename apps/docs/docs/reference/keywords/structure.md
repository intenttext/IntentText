---
sidebar_position: 4
title: Structure Keywords
---

# Structure Keywords

Three keywords for organizing the document — sections, subsections, and a table of contents.

## `section:`

**Category:** Structure
**Since:** v1.0
**Aliases:** `h2:`, `heading:`, `chapter:`

Section heading. Renders as H2. Blocks below belong to this section until the next `section:`.

### Syntax

```
section: heading text
```

### Examples

```intenttext
section: Scope of Work
section: Payment Terms
section: Definitions
```

### Notes

- Sections create logical groupings for queries — `--section "Payment"` filters to blocks within that section
- Use `sub:` for H3 within a section

---

## `sub:`

**Category:** Structure
**Since:** v1.0
**Aliases:** `h3:`, `subheading:`

Subsection heading. Renders as H3.

### Syntax

```
sub: heading text
```

### Examples

```intenttext
section: Payment Terms
sub: Invoice Schedule
text: Invoices are issued on the 1st of each month.
sub: Late Fees
text: A fee of 1.5% per month applies to overdue payments.
```

---

## `toc:`

**Category:** Structure
**Since:** v2.5

Auto-generated table of contents based on `section:` and `sub:` headings in the document.

### Syntax

```
toc:
toc: | depth: number
```

### Properties

| Property | Type   | Default | Description                                                              |
| -------- | ------ | ------- | ------------------------------------------------------------------------ |
| `depth`  | number | `3`     | Maximum heading depth (2 = sections only, 3 = include subsections)       |

### Examples

```intenttext
title: Service Agreement
toc:

section: Scope of Work
sub: Deliverables
text: ...
```

---

## Extension keywords

Document cross-reference and annotation blocks are available in the `x-doc:` namespace.

| Extension           | Purpose                                          |
| ------------------- | ------------------------------------------------ |
| `x-doc: ref`        | Cross-document reference with typed relationship |
| `x-doc: deadline`   | Date-bound milestone or due date                 |
| `x-doc: def`        | Term definition / glossary entry                 |
| `x-doc: contact`    | Person or organization contact information       |
| `x-doc: signline`   | Signature line for print documents               |

See [Extension Keywords →](./extensions) for full syntax documentation.
