# Demo 2 — Query a Folder by Parameter

Point at a directory of mixed `.it` business documents and ask **structured
questions across all of them** — by typed field, not full-text. The files *are* the
database; no schema, no migration, no server.

```bash
node demo/folder-query/search.mjs
```

## The corpus (`docs/`)

Five real-world document types, all plain `.it`:

| File | `meta: type` |
| --- | --- |
| `invoice-acme.it` | invoice (Unpaid) |
| `invoice-globex.it` | invoice (Paid) |
| `contract-acme.it` | contract (signed) |
| `meeting-2026-03.it` | meeting |
| `quote-initech.it` | quote |

## The questions it answers

1. **Every payment deadline** across all documents, sorted by date.
2. **Overdue deadlines** (`date < today`) — a query grep fundamentally can't do,
   because "overdue" is a comparison on a typed field.
3. **Every signature on file** — who signed what, when (block-level query).
4. **All high-priority tasks** across every document, by owner.
5. **Unpaid receivables** — a *document-level* metadata query (`status = Unpaid`)
   joined to each invoice's total.

Two query surfaces, both from the index:

- **Block queries** (`queryComposed`) — deadlines, signatures, tasks: things *inside*
  documents.
- **Document-metadata queries** — type/status/client from each file's `meta:` block:
  attributes *about* documents.

## Why it matters

This is the "searchable/queryable by design" promise made concrete. The same folder
you store your invoices and contracts in answers questions like *"what's overdue?"*,
*"who signed the Acme contract?"*, and *"how much is outstanding?"* — without exporting
to a database or writing a parser. Build the index once; query it many ways.
