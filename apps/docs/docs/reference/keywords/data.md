---
sidebar_position: 7
title: Data Keywords
---

# Data Keywords

Three keywords for structured data — tables, rows, and quantitative metrics.

## `columns:`

**Category:** Data
**Since:** v1.0
**Aliases:** `headers:`

Table column definitions — declares column names for the following `row:` blocks.

### Syntax

```
columns: Col1 | Col2 | Col3
```

### Examples

```intenttext
columns: Department | Budget | Spent | Remaining
row: Engineering | USD 500,000 | USD 320,000 | USD 180,000
row: Marketing | USD 200,000 | USD 175,000 | USD 25,000
row: Operations | USD 150,000 | USD 98,000 | USD 52,000
```

### Notes

- `columns:` declares the headers; `row:` provides the data
- Tables can also be written using Markdown pipe syntax (see below)

---

## `row:`

**Category:** Data
**Since:** v1.0

Table data row — pipe-separated cell values. Must follow a `columns:` declaration.

### Syntax

```
row: Cell1 | Cell2 | Cell3
```

### Examples

```intenttext
columns: Name | Role | Email
row: Ahmed Al-Rashid | CEO | ahmed@acme.com
row: Sarah Chen | General Counsel | sarah@acme.com
```

---

## Markdown pipe tables

Tables can also be written using standard Markdown pipe syntax. The parser produces the same internal `table` structure.

```intenttext
| Header 1 | Header 2 | Header 3 |
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
```

### Dynamic table (templates)

The `each:` property on the header row enables dynamic row expansion:

```intenttext
| Description          | Qty          | Rate          | Total          | each: items |
| {{item.description}} | {{item.qty}} | {{item.rate}} | {{item.total}} |
```

1. Parser reads the `each:` array from data
2. Auto-singularizes: `items` → `item`, `orders` → `order`
3. Explicit naming: `each: orders as order`
4. Expands one row per array element
5. Zero items = zero rows; header always present

---

## `metric:`

**Category:** Data
**Since:** v2.11
**Aliases:** `kpi:`, `measure:`, `indicator:`

Quantitative measurement or KPI. Queryable, renderable as cards or grids, with optional target comparison and trend indicators.

### Syntax

```
metric: label | value: number | unit: string | period: timeframe | as-of: date | target: number | trend: direction | owner: team | source: origin
```

### Properties

| Property | Type   | Required | Description                                  |
| -------- | ------ | -------- | -------------------------------------------- |
| `value`  | string | yes      | The measured value                           |
| `unit`   | string | no       | Unit of measurement (USD, %, hours, etc.)    |
| `period` | string | no       | Reporting period (Q1 2026, March 2026, etc.) |
| `as-of`  | string | no       | Date the measurement was taken               |
| `target` | string | no       | Target or goal value                         |
| `trend`  | string | no       | `up`, `down`, `flat`                         |
| `owner`  | string | no       | Responsible team or person                   |
| `source` | string | no       | Data source                                  |

### Examples

```intenttext
metric: Revenue | value: 1200000 | unit: USD | period: Q1 2026 | target: 1000000 | trend: up
metric: Customer Satisfaction | value: 4.6 | unit: /5 | period: March 2026 | target: 4.5
metric: Sprint Velocity | value: 42 | unit: points | period: Sprint 14 | target: 40 | trend: flat
metric: Subtotal | value: 24000 | unit: USD
```

---

## Extension keywords

Experimental I/O blocks are available in the `x-exp:` namespace.

| Extension       | Purpose                                      |
| --------------- | -------------------------------------------- |
| `x-exp: input`  | Declare a workflow input parameter           |
| `x-exp: output` | Declare a workflow output parameter          |
| `x-exp: assert` | Testable assertion — evaluable by CI         |
| `x-exp: secret` | Secret or credential reference (always redacted) |

See [Extension Keywords →](./extensions) for full syntax documentation.
