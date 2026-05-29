---
sidebar_position: 8
title: Python SDK
---

# Python SDK

A pure Python implementation of the IntentText parser, renderer, query engine, merge system, and trust operations.

## Installation

```bash
pip install intenttext
```

Requires Python 3.9+.

## Quick start

```python
from intenttext import parse, render, query, merge, seal, verify, amend

# Parse a .it file
doc = parse(open("document.it").read())
print(doc.title)
print(len(doc.blocks))

# Render to HTML
html = render(doc, theme="corporate")

# Query
results = query("./contracts", type="deadline", format="table")

# Merge template
merged = merge(template_source, {"client": "Acme Corp", "amount": 5000})

# Trust
sealed = seal("contract.it", signer="Ahmed", role="CEO")
is_valid = verify("contract.it")
amended = amend("contract.it", section="Payment", now="Net 15", ref="Amendment #1")
```

## Parsing

```python
from intenttext import parse

source = """
title: Quarterly Report
meta:
  author: Finance Team
  date: 2026-Q1

section: Revenue
text: Total revenue increased 12% year-over-year.
metric: Revenue | value: $4.2M | target: $4.0M | status: above

section: Expenses
text: Operating expenses held flat.
metric: OpEx | value: $2.1M | target: $2.3M | status: below
"""

doc = parse(source)
print(doc.title)          # "Quarterly Report"
print(doc.meta["author"]) # "Finance Team"

for block in doc.blocks:
    print(f"{block.keyword}: {block.value}")
```

### Parser options

```python
doc = parse(source, strict=True)      # Raise on unknown keywords
doc = parse(source, resolve_aliases=True)  # Convert aliases to canonical keywords
```

## Rendering

```python
from intenttext import parse, render

doc = parse(source)

# HTML with theme
html = render(doc, format="html", theme="corporate")

# Plain text
text = render(doc, format="text")

# JSON AST
json_str = render(doc, format="json")
```

### Available themes

`corporate`, `minimal`, `warm`, `technical`, `print`, `legal`, `editorial`, `dark`

## Querying

```python
from intenttext import query

# Query a single file
results = query("contract.it", type="deadline")

# Query a directory
results = query("./company", type="contact", recursive=True)

# Filter
results = query("./company", type="metric", filter="status:above")

# Output formats
table = query("./company", type="deadline", format="table")
csv = query("./company", type="contact", format="csv")
```

## Template merging

```python
from intenttext import merge

template = """
title: Invoice {{number}}
meta:
  client: {{client}}
  date: {{date}}

text: Amount due: {{amount}}

{{each: items}}
  | Item | Qty | Price |
  | {{name}} | {{qty}} | {{price}} |
{{/each}}
"""

data = {
    "number": "INV-2847",
    "client": "Acme Corp",
    "date": "2026-03-15",
    "amount": "$5,000",
    "items": [
        {"name": "Consulting", "qty": "40h", "price": "$4,000"},
        {"name": "Materials", "qty": "1", "price": "$1,000"}
    ]
}

result = merge(template, data)
# result is the merged .it source string
```

## Trust operations

```python
from intenttext import seal, verify, history, amend

# Seal
result = seal("contract.it", signer="Ahmed Al-Rashid", role="CEO")
print(result.hash)      # SHA-256 hash
print(result.sealed)    # True

# Verify
check = verify("contract.it")
print(check.valid)      # True/False
print(check.signers)    # ["Ahmed Al-Rashid"]

# History
hist = history("contract.it")
for entry in hist.entries:
    print(f"{entry.action} by {entry.signer} at {entry.timestamp}")

# Amend
result = amend(
    "contract.it",
    section="Payment Terms",
    was="Net 30",
    now="Net 15",
    ref="Amendment #1"
)
```

## Type reference

```python
from intenttext.types import (
    Document,       # Parsed document
    Block,          # Individual keyword block
    Meta,           # Document metadata
    QueryResult,    # Query response
    SealResult,     # Seal operation result
    VerifyResult,   # Verification result
    HistoryEntry,   # Trust history entry
    AmendResult,    # Amendment result
    MergeResult,    # Template merge result
)
```

## Integration example

```python
from intenttext import parse, render, query
from pathlib import Path

# Build a dashboard from all metric documents
metrics_dir = Path("./company/reports")
results = query(str(metrics_dir), type="metric", recursive=True, format="json")

for metric in results:
    print(f"{metric['name']}: {metric['value']} (target: {metric['target']}, status: {metric['status']})")
```

## Source

Repository: [intenttext-python](https://github.com/intenttext/intenttext-python)
