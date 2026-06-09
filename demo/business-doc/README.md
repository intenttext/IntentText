# Demo 1 — Template → Merge → Sign → Query

The IntentText wedge in one runnable file: the pipeline that normally needs a
**template engine + a PDF library + a signing vendor + a query layer** collapses
into one dependency — `@intenttext/core`.

```bash
node demo/business-doc/pipeline.mjs
```

## What it shows

| File | Role |
| --- | --- |
| `invoice-template.it` | The template — stored once (think: a row in your DB). |
| `invoice-data.json` | One data row (think: a `SELECT` result). |
| `pipeline.mjs` | The whole pipeline. |

The five stages:

1. **Merge** — fill the template with the data row. The `each: items` table header
   expands one row template into N line items automatically — no loop code.
2. **Render** — the finished document → standalone HTML you can print to PDF as-is.
   No PDF library.
3. **Sign + seal** — freeze the content with a SHA-256, tamper-evident hash, recorded
   against a signer.
4. **Verify** — recompute the hash and confirm integrity. The demo also tampers with
   the total and shows verification **fail**, proving the seal works.
5. **Query** — ask the document questions *by meaning* (`type=metric`,
   `type=deadline`, `type=contact`), not by string matching. The same file is a
   document and a database.

## Why it matters

The output `out.invoice.signed.it` is, simultaneously:

- a **readable document** (open it in any text editor),
- a **signed, verifiable artifact** (tamper-evident),
- a **queryable record** (filter by typed fields).

No other document format gives you all three from one plain-text file. The sealing is
open and reproducible (anyone with the core can verify) — the commercial layer is a
hosted notary/timestamp authority, not the algorithm.

## Generated outputs (gitignored)

- `out.invoice.html` — rendered, printable.
- `out.invoice.signed.it` — signed, verifiable, queryable.
