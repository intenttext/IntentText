# @dotit/pdf

Server-side PDF generation for [IntentText](https://github.com/intenttext/IntentText)
(`.it`) documents — for the moments **no human is at a browser**: emailing an invoice,
archiving for compliance, month-end batch statements.

`@dotit/core` stays zero-dependency; this is the opt-in enterprise companion.

```bash
npm i @dotit/pdf
# plus ONE of:
npm i puppeteer        # bundles Chromium — zero config
npm i puppeteer-core   # uses your existing Chrome (set CHROME_PATH if not auto-found)
```

## The enterprise "issue" flow — one call

Merge data into the template → **seal** the merged document (tamper-evident SHA-256)
→ real PDF bytes:

```js
import { issuePDF } from "@dotit/pdf";

const { source, hash, at, pdf } = await issuePDF(template.source, invoiceData, {
  signer: "Jadwal Billing",
  role: "Finance",
  theme: "corporate",
});

await db.invoices.updateOne({ _id }, { $set: { itSource: source, itHash: hash, issuedAt: at } });
await s3.putObject({ Key: `invoices/${number}.pdf`, Body: pdf });   // archive what was sent
await mailer.send({ attachments: [{ filename: `${number}.pdf`, content: pdf }] });
```

- **`source`** — the sealed `.it` text. Store it on the record: it's the queryable,
  hash-verifiable **legal artifact** (a few KB of text). Years later,
  `verifyDocument(source)` from `@dotit/core` proves it unaltered.
- **`pdf`** — the bytes you email/archive.
- Unresolved `{{fields}}` render **blank** (it's a finished document), pass
  `missing: "keep"` to override.

## Without Chrome in this process (Gotenberg & friends)

`issueDocument()` is the same flow minus the PDF — pure, synchronous, no Chrome:

```js
import { issueDocument } from "@dotit/pdf";

const { source, hash, html } = issueDocument(template.source, data, { signer: "Jadwal Billing" });
// POST `html` to your HTML→PDF sidecar (e.g. Gotenberg), store `source` yourself.
```

## Other entry points

```js
import { renderPDF, htmlToPDF, createPdfRenderer } from "@dotit/pdf";

await renderPDF(itSource, { theme: "corporate" });   // finished .it → PDF bytes
await htmlToPDF(printHtml);                           // bring-your-own HTML → PDF bytes

// Batch (reuses one Chrome — launching costs ~1s):
const r = await createPdfRenderer({ theme: "corporate" });
for (const s of statements) {
  const { pdf } = await r.issuePDF(tmpl, s, { signer: "Jadwal Billing" });
  await s3.putObject({ Key: `statements/${s.id}.pdf`, Body: pdf });
}
await r.close();
```

## Chrome resolution

1. `puppeteer` if installed (its bundled Chromium).
2. `puppeteer-core` + a binary from: `executablePath` option →
   `$PUPPETEER_EXECUTABLE_PATH` → `$CHROME_PATH` → common install paths
   (macOS/Linux/Windows).
3. Neither → a clear error telling you what to install.

In containers, pass `launchArgs: ["--no-sandbox"]` if your image requires it.

## Docs

Full integration guide (storage model, Mongo shapes, receipts, Arabic/RTL):
**ecosystem → ERP / App Integration** in the IntentText docs.
