---
sidebar_position: 10
title: Forms, Review & Compliance
---

# Forms, Review & Compliance

The capabilities that let `.it` replace the business documents people still keep in
Word and PDF — all on the same queryable, sealable format. Everything here is in
`@dotit/core` (1.12+) unless noted.

## Forms — fillable, signable documents

A `meta: type: form` document with `input:` fields is a **form**: design it, send it,
a recipient fills it, and a **complete** form (all required fields answered) stops
being a template and becomes a final, signable record.

```intenttext
meta: | type: form
title: Vendor Onboarding
input: Legal name | key: legal_name | type: text | required: yes
input: Country | key: country | type: choice | options: KW, SA | required: yes
input: VAT number | key: vat | type: text | show-if: country = SA
input: Quantity | key: qty | type: number | value: 4
input: Total | key: total | type: number | compute: qty * 250
input: Evidence | key: cr | type: attachment
```

```ts
import {
  isFormComplete, missingRequiredFields, applyAnswers, formAnswers,
  formVisibility, computeFormValues, sealDocument,
} from "@dotit/core";

missingRequiredFields(form);               // ["legal_name","country"] (hidden/computed skipped)
const filled = applyAnswers(form, { legal_name: "Dalil", country: "KW" });
isFormComplete(filled);                     // true → signable
formAnswers(filled);                        // { legal_name, country, qty, total: "1000" }
formVisibility(filled).vat;                 // false (country ≠ SA → field hidden)
computeFormValues(filled).total;            // "1000"
const record = sealDocument(filled, { signer: "Dalil" }).source;  // tamper-evident
```

**Field types:** text, textarea, date, number, choice, checkbox, signature, table,
attachment. **`show-if:`** shows a field only when a condition holds; **`compute:`**
derives a value from other fields (a safe arithmetic evaluator — never `eval`).

### Two-party trust

A sent form has two trust questions, by two parties. The **author** seals the blank
form's *structure* (a hash that ignores answers, so it survives filling); the
**filler** seals the completed *record* (the answers).

```ts
import { sealFormStructure, verifyFormStructure } from "@dotit/core";
const { source: blank } = sealFormStructure(form, { sealer: "Acme HR" });
// recipient fills + seals; both layers verify, independently:
verifyFormStructure(record).intact;         // structure unchanged (author's claim)
verifyDocument(record).intact;              // answers untampered (filler's claim)
```

## Attachments — `.it` as a container

A form (or any document) can carry a file. Prefer `href:` (a reference) to keep the
document lean and queryable; embed (base64, ≤ 1 MiB) only when it must be
self-contained — the seal then covers the bytes.

```ts
import { addAttachment, getAttachment, attachmentDataUri } from "@dotit/core";
let s = addAttachment(form, { key:"cr", name:"cr.pdf", mime:"application/pdf", size:0, href:"https://store/cr.pdf" });
s = addAttachment(s, { key:"id", name:"id.png", mime:"image/png", size:1234, data: base64 });
attachmentDataUri(getAttachment(s, "id"));  // a data: URI for download/preview
```

## Redline & version compare

Word-style tracked changes (`[new]{track: ins}` / `[old]{track: del}`) + comments,
and a one-call diff of two versions:

```ts
import { compareVersions, acceptChanges, rejectChanges } from "@dotit/core";
const redline = compareVersions(oldVersion, newVersion); // a tracked-changes .it
acceptChanges(redline);                      // === newVersion   (rejectChanges → old)
```

In the editor, `<IntentTextWorkbench mode="review">` renders the accept/reject UI;
File ▸ "Compare versions" runs `compareVersions` for you.

### Co-authoring (async merge)

`mergeThreeWay(base, mine, theirs)` merges two independent edits into one redline:
non-overlapping edits apply automatically; a region both sides changed differently is
a **conflict** offering both variants for a human to resolve. "Git-merge for
documents, but readable."

## Redaction

Legally *remove* content (FOIA / privacy / discovery) — not CSS-hide it.

```ts
import { applyRedactions, verifyRedaction } from "@dotit/core";
// author marks:  text: The agent [John Carter]{redact: PII} met the source.
const { source, receipts } = applyRedactions(marked); // the text is GONE; black-bar marker
verifyRedaction(receipts[0].commit, "John Carter", receipts[0].salt); // prove coverage later
```

Each marker commits to a salted hash of the original; keep the receipts private to
later prove a redaction covered exactly a given text, without the document revealing it.

## Math

```intenttext
math: E = mc^2                 # a display equation
text: mass-energy [E = mc^2]{math: tex} is famous.   # inline
```

Core marks math (a dependency-free `data-tex` placeholder); render it with
[`@dotit/math`](../ecosystem/index.md):

```ts
import { renderMathInHtml } from "@dotit/math"; // lite MathML, or full KaTeX if installed
const html = await renderMathInHtml(coreHtml);
```

## Legal signatures & archival (PDF)

- **PAdES** — export a sealed `.it` as a PDF signature Adobe and courts recognize
  (`@dotit/pades` / `@dotit/pdf renderSignedPDF`): ECDSA P-256 + X.509 + CMS, optional
  RFC-3161 timestamps. A signing cert can be self-issued or issued by the UTS X.509 CA.
- **PDF/A** — archival PDF for auditors (`@dotit/pdf toPdfA`): XMP + sRGB OutputIntent
  + document ID; compliance validated in CI with veraPDF.

```ts
import { renderSignedPDF, toPdfA } from "@dotit/pdf";   // Node
await renderSignedPDF(src, { signer: { certPem, privateKeyPem, tsaUrl } });
await renderPDF(src, { pdfA: { iccProfile, conformance: "3B" } });
```

## Embed it all

Every mode is in one React component — `<IntentTextWorkbench mode="edit|fill|view|review|auto">`.
See the full developer guide at **[ERP integration](/docs/ecosystem/erp-integration)** and
[Ecosystem](../ecosystem/index.md).
